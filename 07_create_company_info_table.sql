-- 회사 상세 정보 테이블 생성
-- admin-dashboard.html의 회사정보 관리를 위한 테이블

CREATE TABLE IF NOT EXISTS company_info (
    id BIGSERIAL PRIMARY KEY,
    company_domain VARCHAR(255) UNIQUE NOT NULL DEFAULT 'namkyungsteel.com',
    company_type VARCHAR(50) NOT NULL, -- 'corporation', 'partnership', 'sole_proprietorship'
    company_name VARCHAR(255) NOT NULL,
    representative_name VARCHAR(100),
    business_number VARCHAR(20), -- 사업자번호
    corporate_number VARCHAR(20), -- 법인번호
    establishment_date DATE,
    address TEXT,
    detailed_address TEXT,
    contact_phone VARCHAR(50),
    fax_number VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    business_type VARCHAR(255), -- 업종
    business_items TEXT, -- 사업내용
    capital_amount BIGINT, -- 자본금
    employee_count INTEGER,
    annual_revenue BIGINT, -- 연간 매출
    bank_name VARCHAR(100),
    account_number VARCHAR(100),
    account_holder VARCHAR(100),
    tax_invoice_email VARCHAR(255),
    accounting_manager VARCHAR(100),
    accounting_phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 남경스틸 기본 정보 삽입
INSERT INTO company_info (
    company_domain,
    company_type,
    company_name,
    representative_name,
    business_number,
    corporate_number,
    establishment_date,
    address,
    contact_phone,
    email,
    website,
    business_type,
    business_items
) VALUES (
    'namkyungsteel.com',
    'corporation',
    '남경스틸(주)',
    '',
    '',
    '',
    '2018-01-11',
    '경기도 안산시 단원구 목내동 697-1',
    '031-XXX-XXXX',
    'info@namkyungsteel.com',
    'https://namkyungsteel.com',
    '철강제품 제조 및 가공업',
    '철강제품 제조, 가공, 판매'
) ON CONFLICT (company_domain) DO NOTHING;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_company_info_domain ON company_info(company_domain);
CREATE INDEX IF NOT EXISTS idx_company_info_business_number ON company_info(business_number);

-- 업데이트 트리거 추가
CREATE OR REPLACE FUNCTION update_company_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_info_updated_at
    BEFORE UPDATE ON company_info
    FOR EACH ROW
    EXECUTE FUNCTION update_company_info_updated_at();