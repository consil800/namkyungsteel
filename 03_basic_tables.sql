-- 3단계: 기본 업무 테이블들 생성
-- Supabase SQL Editor에서 실행하세요

-- 법인카드 사용내역 테이블 (회사별 분리)
CREATE TABLE IF NOT EXISTS corporate_card_usage (
    id BIGSERIAL PRIMARY KEY,
    employee_name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    merchant VARCHAR(200) NOT NULL,
    purpose TEXT,
    amount DECIMAL(12,2) NOT NULL,
    usage_date DATE NOT NULL,
    usage_time TIME,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    card_number VARCHAR(20),
    receipt_image TEXT, -- Base64 또는 URL
    notes TEXT,
    approved_by VARCHAR(100),
    approved_at TIMESTAMPTZ,
    company_domain VARCHAR(100) NOT NULL, -- 회사 도메인으로 테넌트 구분
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 휴가 신청 테이블 (회사별 분리)
CREATE TABLE IF NOT EXISTS leave_requests (
    id BIGSERIAL PRIMARY KEY,
    employee_name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50),
    department VARCHAR(100),
    position VARCHAR(100),
    leave_type VARCHAR(50) NOT NULL, -- annual, sick, maternity, etc.
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    approved_by VARCHAR(100),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    company_domain VARCHAR(100) NOT NULL, -- 회사 도메인으로 테넌트 구분
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 거래처/업체 목록 테이블 (업무일지용 - 개인별)
CREATE TABLE IF NOT EXISTS client_companies (
    id BIGSERIAL PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL,
    region VARCHAR(100),
    address TEXT,
    phone VARCHAR(20),
    contact_person VARCHAR(100),
    mobile VARCHAR(20),
    email VARCHAR(100),
    payment_terms VARCHAR(50),
    debt_amount VARCHAR(50),
    business_type VARCHAR(100),
    products TEXT,
    usage_items TEXT,
    notes TEXT,
    company_color VARCHAR(20),
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATE,
    user_id BIGINT NOT NULL, -- 업체를 등록한 사용자 ID
    company_domain VARCHAR(100) NOT NULL, -- 회사 도메인으로 테넌트 구분
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);