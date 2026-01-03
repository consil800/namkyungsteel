# Supabase Kakao OAuth 설정 가이드

## 1. Supabase Dashboard에서 Kakao Provider 설정

1. [Supabase Dashboard](https://supabase.com/dashboard/project/zgyawfmjconubxaiamod) 접속
2. **Authentication > Providers** 메뉴로 이동
3. **Kakao** 섹션 찾기
4. 다음 정보 입력:
   - **Client ID (REST API Key)**: `ef7b7c0eb7603105ee9ce4da186d9b0c`
   - **Client Secret**: `mydKOSJUZP4CyFZSC3XkirI9V3m8Jp8y`
   - **Enabled**: 토글 ON
5. **Save** 클릭

## 2. Kakao Developers 설정 확인

1. [Kakao Developers](https://developers.kakao.com) 접속
2. 해당 애플리케이션 선택
3. **앱 설정 > 플랫폼** 에서 Web 플랫폼 등록 확인:
   - 사이트 도메인: `https://namkyungsteel.com`
   - 추가로 `https://zgyawfmjconubxaiamod.supabase.co` 도 등록

4. **제품 설정 > 카카오 로그인** 에서:
   - 활성화 설정: ON
   - Redirect URI 등록: `https://zgyawfmjconubxaiamod.supabase.co/auth/v1/callback`
   - 동의 항목 설정:
     - 닉네임: 필수 동의
     - 프로필 사진: 선택 동의
     - 카카오계정(이메일): 선택 동의 (카카오는 이메일이 없을 수 있음)

## 3. SQL 스크립트 실행

1. Supabase Dashboard에서 **SQL Editor** 메뉴로 이동
2. `fix-kakao-oauth-sql.sql` 파일의 내용을 복사하여 붙여넣기
3. **Run** 버튼 클릭하여 실행

## 4. 오류 해결 확인사항

### A. Database Logs 확인
1. **Logs > Database** 메뉴로 이동
2. 다음 필터 적용:
   - Severity: `error`, `warning`
   - Search: `handle_new_user` 또는 `auth.users`

### B. Auth Logs 확인
1. **Authentication > Logs** 메뉴로 이동
2. 최근 로그인 시도 확인
3. "Database error granting user" 오류의 상세 내용 확인

### C. 일반적인 오류 원인

1. **Database Quota 초과**
   - Free tier의 경우 500MB 제한
   - **Settings > Billing** 에서 사용량 확인

2. **Auth 사용자 수 제한**
   - Free tier의 경우 50,000 MAU 제한
   - **Authentication > Users** 에서 사용자 수 확인

3. **RLS 정책 충돌**
   - SQL Editor에서 다음 실행:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'users';
   ```

4. **트리거 함수 오류**
   - SQL Editor에서 다음 실행:
   ```sql
   SELECT proname, pg_get_functiondef(oid) 
   FROM pg_proc 
   WHERE proname = 'handle_new_user';
   ```

## 5. 테스트 방법

1. 브라우저의 시크릿/프라이빗 모드로 접속
2. 개발자 도구(F12) > Console 탭 열기
3. https://namkyungsteel.com 접속
4. 카카오 로그인 시도
5. Console에 출력되는 로그 확인

## 6. 임시 해결책

만약 여전히 오류가 발생한다면:

1. **Supabase Dashboard > Authentication > Settings**
2. **Email Auth** 섹션에서:
   - "Enable email confirmations" 비활성화
   - "Enable email sign-ups" 활성화

3. **Advanced Settings**:
   - "Enable manual linking" 활성화

## 7. 지원 요청

위 방법으로도 해결되지 않으면:

1. Supabase Support 티켓 생성
2. 다음 정보 포함:
   - Project ID: `zgyawfmjconubxaiamod`
   - Error: "Database error granting user"
   - Provider: Kakao OAuth
   - 발생 시간 및 빈도

## 8. 디버깅 쿼리

```sql
-- Auth 사용자와 Public 사용자 불일치 확인
SELECT 
    au.id,
    au.email,
    au.raw_app_meta_data->>'provider' as provider,
    pu.id as public_user_id
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC
LIMIT 10;

-- 최근 생성된 사용자 확인
SELECT 
    id,
    email,
    oauth_provider,
    created_at,
    is_approved
FROM public.users
ORDER BY created_at DESC
LIMIT 10;
```