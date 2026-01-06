-- 사업자번호 컬럼 추가 및 중복 체크를 위한 인덱스 생성
-- 실행일: 2026-01-06
-- 설명: PDF 드래그 앤 드롭 기능에서 사업자번호 추출 및 중복 체크용

-- 1. business_no 컬럼 추가 (VARCHAR(12) - 하이픈 포함 형식: 000-00-00000)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS business_no VARCHAR(12);

-- 2. 사업자번호 중복 체크를 위한 UNIQUE 인덱스 생성
-- NULL 값은 중복 체크에서 제외됨
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_business_no
ON companies (business_no)
WHERE business_no IS NOT NULL AND business_no != '';

-- 3. 검색 성능 향상을 위한 일반 인덱스
CREATE INDEX IF NOT EXISTS idx_companies_business_no_search
ON companies (business_no);

-- 4. 확인용 쿼리
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'companies' AND column_name = 'business_no';

COMMENT ON COLUMN companies.business_no IS '사업자등록번호 (형식: 000-00-00000)';
