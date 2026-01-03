-- client_companies 테이블에 PDF 파일 저장용 컬럼 추가
-- PDF 파일 정보를 JSON 형태로 저장 (파일명, URL 등)

ALTER TABLE client_companies 
ADD COLUMN IF NOT EXISTS pdf_files JSONB DEFAULT '[]'::jsonb;

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_client_companies_pdf_files 
ON client_companies USING gin(pdf_files);

-- 컬럼에 대한 설명 추가
COMMENT ON COLUMN client_companies.pdf_files IS 'PDF 파일 정보를 JSON 배열로 저장. 각 객체는 {filename, url, uploadedAt} 포함';