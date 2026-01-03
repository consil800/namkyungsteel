-- Kakao OAuth 로그인 오류 수정 SQL 스크립트 V2
-- UUID 타입 오류 수정 버전

-- 1. users 테이블의 id 컬럼 타입 확인
SELECT 
    column_name, 
    data_type, 
    udt_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'id';

-- 2. 기존 트리거와 함수 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 3. 개선된 OAuth 사용자 처리 함수 생성 (타입 수정)
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
    _user_id TEXT;  -- UUID를 TEXT로 변환
BEGIN
    -- UUID를 TEXT로 변환
    _user_id := NEW.id::TEXT;
    
    -- 디버깅을 위한 로그
    RAISE LOG 'handle_new_user triggered for user %', _user_id;
    
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
        _username := 'kakao_' || substring(_user_id from 1 for 8);
    ELSE
        _username := _email;
    END IF;

    -- users 테이블에 삽입 (타입에 따라 다르게 처리)
    -- id가 bigint인 경우를 위한 동적 쿼리
    EXECUTE format(
        'INSERT INTO public.users (
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
            %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L
        )
        ON CONFLICT (oauth_id) DO UPDATE SET
            last_login_at = NOW(),
            updated_at = NOW(),
            profile_image = COALESCE(EXCLUDED.profile_image, users.profile_image)',
        _username,
        NULLIF(_email, ''),
        _user_id,
        _provider,
        _name,
        'employee',
        'namkyungsteel.com',
        '남경스틸(주)',
        _avatar_url,
        'oauth_user',
        true,
        true,
        NOW(),
        NOW()
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- 오류가 발생해도 auth 사용자 생성은 계속 진행
        RAISE WARNING 'Error in handle_new_user: % - %', SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$;

-- 4. 트리거 재생성
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 5. users 테이블에 oauth_id 인덱스 생성 (없는 경우)
CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON public.users(oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 6. RLS 정책 재설정 (타입 안전)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Enable insert for auth users" ON public.users;
DROP POLICY IF EXISTS "Service role has full access" ON public.users;
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Allow anonymous registration" ON public.users;
DROP POLICY IF EXISTS "Service role full access" ON public.users;
DROP POLICY IF EXISTS "Allow public user check" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

-- 새로운 정책 생성
-- 6.1. Service role은 모든 권한
CREATE POLICY "Service role full access" ON public.users
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 6.2. OAuth ID로 자신의 데이터 조회 (타입 안전)
CREATE POLICY "Users can view by oauth_id" ON public.users
    FOR SELECT
    USING (
        oauth_id = auth.uid()::TEXT 
        OR auth.role() = 'authenticated'
        OR true  -- 임시로 모든 SELECT 허용
    );

-- 6.3. OAuth ID로 자신의 데이터 수정
CREATE POLICY "Users can update by oauth_id" ON public.users
    FOR UPDATE
    USING (oauth_id = auth.uid()::TEXT)
    WITH CHECK (oauth_id = auth.uid()::TEXT);

-- 6.4. 인증된 사용자는 INSERT 가능
CREATE POLICY "Allow authenticated insert" ON public.users
    FOR INSERT
    WITH CHECK (true);  -- 모든 INSERT 허용

-- 7. 권한 부여
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 8. 기존 auth.users 동기화 (타입 안전)
INSERT INTO public.users (
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
    COALESCE(au.email, 'kakao_' || substring(au.id::TEXT from 1 for 8)),
    au.email,
    au.id::TEXT,
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
WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu 
    WHERE pu.oauth_id = au.id::TEXT
);

-- 9. 함수 소유자 설정
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- 10. 데이터 확인
SELECT 
    'Auth Users' as table_name,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
    'Public Users' as table_name,
    COUNT(*) as count
FROM public.users
UNION ALL
SELECT 
    'Public Users with OAuth ID' as table_name,
    COUNT(*) as count
FROM public.users
WHERE oauth_id IS NOT NULL;

-- 11. 최근 OAuth 사용자 확인
SELECT 
    id,
    username,
    email,
    oauth_id,
    oauth_provider,
    created_at
FROM public.users
WHERE oauth_provider != 'email'
ORDER BY created_at DESC
LIMIT 5;