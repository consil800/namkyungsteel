-- client_companies 테이블에 사업자번호 컬럼 추가

ALTER TABLE client_companies
ADD COLUMN IF NOT EXISTS business_no VARCHAR(20);

-- 인덱스 추가 (사업자번호 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_client_companies_business_no
ON client_companies(business_no);

-- 컬럼 설명 추가
COMMENT ON COLUMN client_companies.business_no IS '사업자번호 (000-00-00000 형식)';

-- 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'client_companies'
AND column_name = 'business_no';
