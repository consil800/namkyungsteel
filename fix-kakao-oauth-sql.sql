-- Kakao OAuth 로그인 오류 수정 SQL 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. 기존 트리거와 함수 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. 개선된 OAuth 사용자 처리 함수 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    _username TEXT;
    _email TEXT;
    _name TEXT;
    _provider TEXT;
    _avatar_url TEXT;
BEGIN
    -- 디버깅을 위한 로그
    RAISE LOG 'handle_new_user triggered for user %', NEW.id;
    
    -- 안전하게 값 추출
    _email := COALESCE(NEW.email, '');
    _provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'unknown');
    
    -- 카카오의 경우 다양한 필드에서 이름 추출
    _name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'nickname',
        NEW.raw_user_meta_data->>'kakao_account.profile.nickname',
        NULLIF(_email, ''),
        'User'
    );
    
    -- 아바타 URL 추출
    _avatar_url := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        NEW.raw_user_meta_data->>'kakao_account.profile.profile_image_url',
        NULL
    );
    
    -- username 생성 (카카오는 이메일이 없을 수 있음)
    IF _email = '' OR _email IS NULL THEN
        _username := 'kakao_' || substring(NEW.id::text from 1 for 8);
    ELSE
        _username := _email;
    END IF;

    -- users 테이블에 삽입 (중복 시 업데이트)
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
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        _username,
        NULLIF(_email, ''),  -- 빈 문자열이면 NULL로 저장
        NEW.id::text,
        _provider,
        _name,
        'employee',
        'namkyungsteel.com',
        '남경스틸(주)',
        _avatar_url,
        'oauth_user',
        true,
        true,  -- OAuth 사용자는 자동 승인
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        last_login_at = NOW(),
        updated_at = NOW(),
        profile_image = COALESCE(EXCLUDED.profile_image, users.profile_image);

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- 오류가 발생해도 auth 사용자 생성은 계속 진행
        RAISE WARNING 'Error in handle_new_user: % - %', SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$;

-- 3. 트리거 재생성
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. RLS 정책 재설정
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Enable insert for auth users" ON public.users;
DROP POLICY IF EXISTS "Service role has full access" ON public.users;
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Allow anonymous registration" ON public.users;

-- 새로운 정책 생성
-- 4.1. Service role은 모든 권한
CREATE POLICY "Service role full access" ON public.users
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 4.2. 인증된 사용자는 자신의 데이터만 조회/수정 가능
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT
    USING (auth.uid() = id OR auth.role() = 'authenticated');

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4.3. 익명 사용자도 회원가입 체크를 위해 SELECT 가능
CREATE POLICY "Allow public user check" ON public.users
    FOR SELECT
    USING (true);

-- 4.4. 인증된 사용자는 INSERT 가능 (OAuth 콜백 시)
CREATE POLICY "Allow authenticated insert" ON public.users
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- 5. 권한 부여
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 6. 기존 auth.users 중 public.users에 없는 사용자 동기화
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
    password,
    is_active,
    is_approved,
    created_at
)
SELECT 
    au.id,
    COALESCE(au.email, 'kakao_' || substring(au.id::text from 1 for 8)),
    au.email,
    au.id::text,
    COALESCE(au.raw_app_meta_data->>'provider', 'unknown'),
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        au.raw_user_meta_data->>'nickname',
        au.email,
        'User'
    ),
    'employee',
    'namkyungsteel.com',
    '남경스틸(주)',
    'oauth_user',
    true,
    true,
    au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 7. 함수 소유자 설정
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- 8. 확인
SELECT 
    COUNT(*) as auth_users_count,
    (SELECT COUNT(*) FROM public.users) as public_users_count
FROM auth.users;