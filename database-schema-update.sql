-- 기존 users 테이블에 company_name 필드 추가
-- Supabase SQL 에디터에서 실행하세요

-- company_name 컬럼이 없으면 추가
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='company_name'
    ) THEN
        ALTER TABLE users ADD COLUMN company_name VARCHAR(200);
    END IF;
END $$;

-- 기존 데이터에 대해 company_name 설정 (namkyungsteel.com 도메인인 경우)
UPDATE users 
SET company_name = '남경스틸(주)' 
WHERE company_domain = 'namkyungsteel.com' 
AND company_name IS NULL;

-- RLS 정책 일시 비활성화 (테스트 목적)
-- 주의: 운영 환경에서는 보안을 위해 RLS를 활성화해야 합니다
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Google OAuth 설정을 위한 Supabase Auth 설정
-- 이는 Supabase 대시보드에서 수동으로 설정해야 합니다:
-- 
-- 1. Supabase 프로젝트 대시보드로 이동
-- 2. Authentication > Settings > Auth Providers
-- 3. Google을 활성화하고 다음 정보 입력:
--    - Client ID: Google Console에서 발급받은 Client ID
--    - Client Secret: Google Console에서 발급받은 Client Secret
--    - Redirect URL: https://your-project.supabase.co/auth/v1/callback
-- 4. Site URL 설정: 
--    - http://localhost:3000 (개발환경)
--    - https://namkyungsteel.com (운영환경)

-- 테스트용 사용자 추가 (옵션)
INSERT INTO users (
    username, 
    email, 
    password, 
    name, 
    role, 
    department, 
    position, 
    company_domain,
    company_name,
    is_active
) VALUES (
    'test@namkyungsteel.com',
    'test@namkyungsteel.com', 
    'password123', 
    '테스트 사용자', 
    'employee', 
    '기술부', 
    '사원',
    'namkyungsteel.com',
    '남경스틸(주)',
    true
) ON CONFLICT (email) DO NOTHING;

-- 기존 master 사용자에 company_name 추가
UPDATE users 
SET company_name = '남경스틸(주)', email = 'master@namkyungsteel.com'
WHERE username = 'master' 
AND company_domain = 'namkyungsteel.com';

-- admin 사용자에 company_name 추가
UPDATE users 
SET company_name = '남경스틸(주)', email = 'admin@namkyungsteel.com'
WHERE username = 'admin' 
AND company_domain = 'namkyungsteel.com';