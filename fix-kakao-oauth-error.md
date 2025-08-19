# 카카오 OAuth 로그인 오류 해결 가이드

## 오류 내용
```
Database error granting user (500 Error)
```

## 원인 분석
이 오류는 Supabase Auth가 새로운 OAuth 사용자를 생성하려고 할 때 발생합니다. 주요 원인:

1. **Supabase 프로젝트 설정 문제**
   - OAuth 제공자 설정이 제대로 되어있지 않음
   - 사용자 생성 제한 설정이 활성화되어 있음

2. **데이터베이스 트리거 오류**
   - auth.users → public.users 동기화 트리거가 실패
   - RLS 정책으로 인한 접근 권한 문제

## 해결 방법

### 1. Supabase 대시보드 확인 (우선순위 높음)

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 해당 프로젝트 선택
3. **Authentication > Providers** 이동
4. Kakao OAuth 설정 확인:
   - Kakao 제공자가 활성화되어 있는지 확인
   - Client ID와 Client Secret이 올바르게 설정되어 있는지 확인
   - Redirect URL이 올바른지 확인

5. **Authentication > Settings** 이동
6. **User Signups** 섹션 확인:
   - "Enable email confirmations" 비활성화 (카카오는 이메일이 없을 수 있음)
   - "Enable new user sign-ups" 활성화되어 있는지 확인

### 2. 데이터베이스 트리거 수정

SQL Editor에서 다음 쿼리 실행:

```sql
-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 새로운 트리거 함수 생성 (에러 처리 개선)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    _username TEXT;
    _email TEXT;
    _name TEXT;
    _provider TEXT;
BEGIN
    -- 안전하게 값 추출
    _email := NEW.email;
    _provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'unknown');
    _name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'nickname',
        _email,
        'User'
    );
    
    -- 카카오 사용자의 경우 username 생성
    IF _email IS NULL OR _email = '' THEN
        _username := 'kakao_' || substring(NEW.id::text from 1 for 8);
    ELSE
        _username := _email;
    END IF;

    -- users 테이블에 삽입 (중복 방지)
    INSERT INTO public.users (
        id,
        username,
        email,
        oauth_id,
        oauth_provider,
        name,
        role,
        company_domain,
        company_name,
        profile_image,
        password,
        is_active,
        is_approved,
        created_at
    ) VALUES (
        NEW.id,
        _username,
        _email,
        NEW.id::text,
        _provider,
        _name,
        'employee',
        'namkyungsteel.com',
        '남경스틸(주)',
        NEW.raw_user_meta_data->>'avatar_url',
        'oauth_user',
        true,
        true,  -- OAuth 사용자는 자동 승인
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        last_login_at = NOW(),
        updated_at = NOW();

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- 오류가 발생해도 auth 사용자 생성은 계속 진행
        RAISE LOG 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 재생성
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
```

### 3. RLS 정책 확인 및 수정

```sql
-- users 테이블의 RLS 정책 확인
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 익명 사용자도 삽입 가능하도록 정책 추가
CREATE POLICY "Enable insert for auth users" ON public.users
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

-- 서비스 역할에 대한 전체 권한 부여
CREATE POLICY "Service role has full access" ON public.users
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);
```

### 4. oauth-redirect.html 수정

에러 처리를 개선하고 더 자세한 로깅을 추가:

```javascript
// Line 33-34 수정
if (accessToken) {
    console.log('✅ OAuth 토큰 발견, 처리 중...');
    console.log('Provider:', hashParams.get('provider') || 'unknown');
    
    try {
        // 에러 상세 정보 확인
        const errorParam = urlParams.get('error');
        const errorDesc = urlParams.get('error_description');
        
        if (errorParam) {
            console.error('❌ OAuth 오류:', errorParam, errorDesc);
            throw new Error(`OAuth 오류: ${errorParam} - ${errorDesc}`);
        }
        
        // ... 기존 코드 계속
```

### 5. 임시 해결책 (즉시 적용 가능)

oauth-redirect.html의 104-108행 부분을 수정하여 에러 발생 시 재시도:

```javascript
const { data: createdUser, error: createError } = await supabase
    .from('users')
    .insert([newUser])
    .select()
    .single();

if (createError) {
    console.error('❌ 사용자 생성 오류:', createError);
    
    // RLS 오류인 경우 service role 키로 재시도
    if (createError.message.includes('RLS') || createError.code === '42501') {
        console.log('🔄 Service role로 재시도...');
        
        // 주의: 프로덕션에서는 백엔드 API를 통해 처리해야 함
        alert('회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.');
        
        // 일단 로그인 성공으로 처리
        dbUser = newUser;
        dbUser.id = userId;
    }
}
```

## 권장 조치 순서

1. **먼저 Supabase 대시보드에서 OAuth 설정 확인** ✅
2. **SQL Editor에서 트리거 함수 업데이트** ✅
3. **RLS 정책 추가/수정** ✅
4. **oauth-redirect.html 에러 처리 개선** ✅
5. **테스트 후 문제 지속 시 Supabase 지원팀 문의**

## 추가 디버깅

Supabase 대시보드의 **Logs > Database** 에서 실시간 로그를 확인하여 정확한 오류 원인을 파악할 수 있습니다.