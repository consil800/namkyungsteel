-- 회사정보 테이블 생성
CREATE TABLE IF NOT EXISTS company_info (
    id BIGSERIAL PRIMARY KEY,
    company_type VARCHAR(20) NOT NULL DEFAULT '법인사업자',
    company_name VARCHAR(100) NOT NULL,
    representative_name VARCHAR(50) NOT NULL,
    business_number VARCHAR(20) NOT NULL UNIQUE,
    corporate_number VARCHAR(20),
    company_phone VARCHAR(20),
    company_fax VARCHAR(20),
    company_email VARCHAR(100),
    company_address TEXT,
    business_type VARCHAR(100),
    business_category VARCHAR(100),
    establishment_date DATE,
    capital BIGINT,
    employee_count INTEGER,
    website VARCHAR(255),
    company_notes TEXT,
    company_seal_url TEXT, -- 법인 사용인감 이미지 URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by BIGINT REFERENCES users(id)
);

-- 기본 회사정보 데이터 삽입 (남경스틸(주))
INSERT INTO company_info (
    company_type,
    company_name,
    representative_name,
    business_number,
    corporate_number,
    company_phone,
    company_fax,
    company_email,
    company_address,
    business_type,
    business_category,
    establishment_date,
    capital,
    employee_count,
    website,
    company_notes
) VALUES (
    '법인사업자',
    '남경스틸(주)',
    '고 강 석',
    '123-45-67890',
    '000000-0000000',
    '031-123-4567',
    '031-123-4568',
    'info@namkyungsteel.com',
    '경기도 안산시 단원구 원시동 123-45',
    '철강 제조업',
    '철강 제조, 가공',
    '2010-01-01',
    1000000000,
    50,
    'https://namkyungsteel.com',
    '철강 제조 및 가공 전문 업체'
) ON CONFLICT (business_number) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    representative_name = EXCLUDED.representative_name,
    corporate_number = EXCLUDED.corporate_number,
    company_phone = EXCLUDED.company_phone,
    company_fax = EXCLUDED.company_fax,
    company_email = EXCLUDED.company_email,
    company_address = EXCLUDED.company_address,
    business_type = EXCLUDED.business_type,
    business_category = EXCLUDED.business_category,
    establishment_date = EXCLUDED.establishment_date,
    capital = EXCLUDED.capital,
    employee_count = EXCLUDED.employee_count,
    website = EXCLUDED.website,
    company_notes = EXCLUDED.company_notes,
    updated_at = NOW();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_company_info_business_number ON company_info(business_number);
CREATE INDEX IF NOT EXISTS idx_company_info_company_name ON company_info(company_name);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE company_info ENABLE ROW LEVEL SECURITY;

-- 읽기 정책: 모든 인증된 사용자가 회사정보를 읽을 수 있음
CREATE POLICY "Enable read access for all authenticated users" ON company_info
    FOR SELECT USING (auth.role() = 'authenticated');

-- 쓰기 정책: 마스터, 회사 대표, 관리자만 회사정보를 수정할 수 있음
CREATE POLICY "Enable write access for admins" ON company_info
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.oauth_id = auth.uid()::text
            AND users.role IN ('master', 'company_CEO', 'company_manager')
        ) OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.email()
            AND users.role IN ('master', 'company_CEO', 'company_manager')
        )
    );

-- 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_company_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 업데이트 트리거 생성
CREATE TRIGGER update_company_info_updated_at_trigger
    BEFORE UPDATE ON company_info
    FOR EACH ROW
    EXECUTE FUNCTION update_company_info_updated_at();