-- 11단계: client_companies 테이블의 user_id 컬럼을 UUID 타입으로 변경
-- Supabase SQL Editor에서 실행하세요

-- 기존 외래키 제약조건 제거
ALTER TABLE client_companies DROP CONSTRAINT IF EXISTS client_companies_user_id_fkey;

-- user_id 컬럼을 VARCHAR(255)로 변경 (UUID 문자열 저장용)
ALTER TABLE client_companies ALTER COLUMN user_id TYPE VARCHAR(255);

-- 새로운 외래키 제약조건 추가 (oauth_id 또는 이메일 기반)
-- 주의: users 테이블에서 OAuth 사용자는 oauth_id로, 일반 사용자는 id로 식별되므로
-- 외래키 제약조건은 일시적으로 제거하고 애플리케이션 레벨에서 관리

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_client_companies_user_id ON client_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_client_companies_company_domain ON client_companies(company_domain);

-- 컬럼 설명 추가
COMMENT ON COLUMN client_companies.user_id IS 'User identifier - can be bigint (for regular users) or UUID string (for OAuth users)';