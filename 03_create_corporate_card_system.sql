-- 3단계: 법인카드 관리 시스템 테이블

-- 법인카드 정보 테이블
CREATE TABLE IF NOT EXISTS corporate_cards (
    id BIGSERIAL PRIMARY KEY,
    card_number VARCHAR(20) UNIQUE NOT NULL, -- 마스킹된 카드번호 (예: ****-****-****-1234)
    card_name VARCHAR(100) NOT NULL,
    card_type VARCHAR(50) DEFAULT 'credit', -- credit, debit, prepaid
    bank_name VARCHAR(100),
    card_limit DECIMAL(15,2),
    current_balance DECIMAL(15,2) DEFAULT 0,
    holder_name VARCHAR(100),
    expiry_date DATE,
    is_active BOOLEAN DEFAULT true,
    company_domain VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 법인카드 사용 내역 테이블
CREATE TABLE IF NOT EXISTS corporate_card_transactions (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES corporate_cards(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- 사용자 ID
    user_name VARCHAR(100) NOT NULL,
    
    -- 거래 정보
    transaction_date TIMESTAMPTZ NOT NULL,
    merchant_name VARCHAR(200) NOT NULL, -- 가맹점명
    merchant_category VARCHAR(100), -- 업종
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KRW',
    
    -- 사용 목적 및 분류
    purpose VARCHAR(200) NOT NULL, -- 사용 목적
    category VARCHAR(100), -- 비용 분류 (식비, 교통비, 사무용품 등)
    project_code VARCHAR(50), -- 프로젝트 코드
    department VARCHAR(100), -- 부서
    
    -- 영수증 및 승인
    receipt_image_url TEXT, -- 영수증 이미지 URL
    receipt_number VARCHAR(100), -- 영수증 번호
    approval_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    approved_by VARCHAR(255), -- 승인자 ID
    approved_at TIMESTAMPTZ,
    approval_comment TEXT,
    
    -- 회계 처리
    accounting_code VARCHAR(50), -- 회계코드
    tax_amount DECIMAL(15,2) DEFAULT 0, -- 세액
    is_tax_deductible BOOLEAN DEFAULT true, -- 세액공제 가능 여부
    
    -- 메타데이터
    company_domain VARCHAR(100) NOT NULL,
    notes TEXT, -- 특이사항
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 법인카드 사용 요청 테이블 (사전 승인용)
CREATE TABLE IF NOT EXISTS corporate_card_requests (
    id BIGSERIAL PRIMARY KEY,
    requester_id VARCHAR(255) NOT NULL,
    requester_name VARCHAR(100) NOT NULL,
    
    -- 요청 정보
    requested_amount DECIMAL(15,2) NOT NULL,
    purpose TEXT NOT NULL,
    expected_date DATE NOT NULL,
    merchant_name VARCHAR(200),
    category VARCHAR(100),
    project_code VARCHAR(50),
    
    -- 승인 정보
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, used
    approver_id VARCHAR(255),
    approver_name VARCHAR(100),
    approved_at TIMESTAMPTZ,
    approval_comment TEXT,
    
    -- 사용 완료 시 연결
    transaction_id BIGINT REFERENCES corporate_card_transactions(id),
    used_at TIMESTAMPTZ,
    
    company_domain VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 카드 사용 한도 설정 테이블 (사용자별)
CREATE TABLE IF NOT EXISTS corporate_card_limits (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    card_id BIGINT NOT NULL REFERENCES corporate_cards(id) ON DELETE CASCADE,
    
    -- 한도 설정
    daily_limit DECIMAL(15,2),
    monthly_limit DECIMAL(15,2),
    annual_limit DECIMAL(15,2),
    
    -- 현재 사용량
    daily_used DECIMAL(15,2) DEFAULT 0,
    monthly_used DECIMAL(15,2) DEFAULT 0,
    annual_used DECIMAL(15,2) DEFAULT 0,
    
    -- 리셋 날짜
    last_daily_reset DATE DEFAULT CURRENT_DATE,
    last_monthly_reset DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE),
    last_annual_reset DATE DEFAULT DATE_TRUNC('year', CURRENT_DATE),
    
    is_active BOOLEAN DEFAULT true,
    company_domain VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, card_id),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_corporate_cards_company_domain ON corporate_cards(company_domain);
CREATE INDEX IF NOT EXISTS idx_corporate_cards_is_active ON corporate_cards(is_active);
CREATE INDEX IF NOT EXISTS idx_corporate_card_transactions_card_id ON corporate_card_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_corporate_card_transactions_user_id ON corporate_card_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_corporate_card_transactions_date ON corporate_card_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_corporate_card_transactions_category ON corporate_card_transactions(category);
CREATE INDEX IF NOT EXISTS idx_corporate_card_transactions_approval_status ON corporate_card_transactions(approval_status);
CREATE INDEX IF NOT EXISTS idx_corporate_card_transactions_company_domain ON corporate_card_transactions(company_domain);
CREATE INDEX IF NOT EXISTS idx_corporate_card_requests_requester_id ON corporate_card_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_corporate_card_requests_status ON corporate_card_requests(status);
CREATE INDEX IF NOT EXISTS idx_corporate_card_requests_company_domain ON corporate_card_requests(company_domain);
CREATE INDEX IF NOT EXISTS idx_corporate_card_limits_user_id ON corporate_card_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_corporate_card_limits_card_id ON corporate_card_limits(card_id);

-- 기본 법인카드 추가 (예시)
INSERT INTO corporate_cards (card_number, card_name, card_type, bank_name, card_limit, holder_name, company_domain)
VALUES ('****-****-****-1234', '남경스틸 법인카드 1호', 'credit', '신한은행', 5000000.00, '남경스틸(주)', 'namkyungsteel.com')
ON CONFLICT (card_number) DO NOTHING;