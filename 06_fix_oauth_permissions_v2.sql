-- OAuth 사용자 생성 권한 수정을 위한 SQL (수정된 버전)

-- 0. 필요한 컬럼 추가 (이미 있을 수 있으므로 조건부로 추가)
DO $$ 
BEGIN
    -- is_approved 컬럼이 없으면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'is_approved') THEN
        ALTER TABLE public.users ADD COLUMN is_approved BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 1. auth.users 테이블에 새 사용자가 생성될 때 public.users에 자동으로 생성하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
    user_name TEXT;
    user_provider TEXT;
BEGIN
    -- 이메일 추출
    user_email := NEW.email;
    
    -- 이름 추출 (여러 소스에서 시도)
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'nickname',
        split_part(user_email, '@', 1)
    );
    
    -- Provider 추출
    user_provider := COALESCE(
        NEW.raw_app_meta_data->>'provider',
        'email'
    );
    
    -- public.users 테이블에 사용자 생성
    INSERT INTO public.users (
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
        COALESCE(user_email, NEW.id::text),
        user_email,
        NEW.id::text,
        user_provider,
        user_name,
        'employee', -- 기본 역할
        'namkyungsteel.com', -- 기본 회사 도메인
        '남경스틸(주)', -- 기본 회사명
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture'
        ),
        'oauth_user', -- OAuth 사용자 표시
        true,
        true, -- OAuth 사용자는 자동 승인
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        oauth_id = EXCLUDED.oauth_id,
        oauth_provider = EXCLUDED.oauth_provider,
        profile_image = COALESCE(EXCLUDED.profile_image, users.profile_image),
        last_login_at = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- 오류 발생 시 로그만 남기고 계속 진행
    RAISE WARNING 'Failed to create user in public.users: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 새 트리거 생성
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. public.users 테이블에 대한 권한 설정
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.users_id_seq TO anon, authenticated;

-- 3. RLS 정책 추가 (비활성화 상태에서도 anon 사용자가 삽입할 수 있도록)
-- 기존 정책 제거
DROP POLICY IF EXISTS "Allow OAuth user creation" ON public.users;
DROP POLICY IF EXISTS "Allow OAuth user update" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.users;

-- users 테이블에 대한 정책
CREATE POLICY "Allow OAuth user creation" ON public.users
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow OAuth user update" ON public.users
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access" ON public.users
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. email 컬럼에 부분 인덱스 추가 (null이 아닌 경우만)
DROP INDEX IF EXISTS idx_users_email_unique;
CREATE UNIQUE INDEX idx_users_email_unique ON public.users(email) WHERE email IS NOT NULL;

-- 5. oauth_id 컬럼에 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON public.users(oauth_id);

-- 6. 기존 auth.users에 있는 사용자들을 public.users로 동기화
INSERT INTO public.users (
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
)
SELECT 
    COALESCE(au.email, au.id::text),
    au.email,
    au.id::text,
    COALESCE(au.raw_app_meta_data->>'provider', 'email'),
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        au.raw_user_meta_data->>'nickname',
        split_part(au.email, '@', 1)
    ),
    'employee',
    'namkyungsteel.com',
    '남경스틸(주)',
    COALESCE(
        au.raw_user_meta_data->>'avatar_url',
        au.raw_user_meta_data->>'picture'
    ),
    'oauth_user',
    true,
    true,
    au.created_at,
    NOW()
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu 
    WHERE pu.email = au.email OR pu.oauth_id = au.id::text
)
ON CONFLICT DO NOTHING;

COMMENT ON FUNCTION public.handle_new_user() IS 'auth.users에 사용자가 생성될 때 public.users에 자동으로 생성';