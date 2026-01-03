-- 카카오 로그인 테스트 및 최종 확인

-- 1. 현재 트리거 상태 확인
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
    AND event_object_table = 'users'
    OR trigger_schema = 'auth' 
    AND event_object_table = 'users';

-- 2. handle_new_user 함수 존재 확인
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 3. RLS 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users';

-- 4. 테스트용 임시 OAuth 사용자 시뮬레이션 (실제 실행하지 말고 구조만 확인)
/*
-- 이것은 실제로는 Supabase Auth가 처리하는 부분입니다
-- 단지 구조 확인용입니다

INSERT INTO auth.users (
    id,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at
) VALUES (
    gen_random_uuid(),
    null,  -- 카카오는 이메일이 없을 수 있음
    '{"provider": "kakao"}'::jsonb,
    '{"nickname": "테스트사용자", "avatar_url": "https://example.com/avatar.jpg"}'::jsonb,
    NOW()
);
*/

-- 5. 최근 auth.users와 public.users 매핑 상태 최종 확인
SELECT 
    'Current Mapping Status' as status,
    COUNT(*) as total_auth_users,
    COUNT(pu.id) as mapped_public_users,
    COUNT(*) - COUNT(pu.id) as unmapped_count
FROM auth.users au
LEFT JOIN public.users pu ON pu.oauth_id = au.id::TEXT;

-- 6. 각 OAuth 제공자별 통계
SELECT 
    COALESCE(au.raw_app_meta_data->>'provider', 'email') as provider,
    COUNT(*) as auth_count,
    COUNT(pu.id) as public_count
FROM auth.users au
LEFT JOIN public.users pu ON pu.oauth_id = au.id::TEXT
GROUP BY COALESCE(au.raw_app_meta_data->>'provider', 'email')
ORDER BY auth_count DESC;

-- 7. 권한 확인
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
    AND table_name = 'users'
    AND grantee IN ('anon', 'authenticated', 'service_role');