-- 1단계: 회사 정보 테이블 생성
-- Supabase SQL Editor에서 실행하세요

-- 회사 정보 테이블 (멀티 테넌트 지원)
CREATE TABLE IF NOT EXISTS companies (
    id BIGSERIAL PRIMARY KEY,
    company_id VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    domain VARCHAR(100) UNIQUE NOT NULL, -- 회사 도메인 (예: namkyungsteel.com)
    subdomain VARCHAR(50) UNIQUE, -- 서브도메인 (예: namkyung)
    business_number VARCHAR(50),
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    website VARCHAR(200),
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    tenant_settings JSONB DEFAULT '{}', -- 회사별 설정
    subscription_plan VARCHAR(50) DEFAULT 'basic', -- 구독 플랜
    max_employees INTEGER DEFAULT 100, -- 최대 직원 수
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 회사 등록 (남경스틸)
INSERT INTO companies (company_id, company_name, domain, subdomain, business_number, address, phone, email, website) VALUES
('COMP_NAMKYUNG', '남경스틸(주)', 'namkyungsteel.com', 'namkyung', '123-45-67890', '서울시 강남구', '02-1234-5678', 'info@namkyungsteel.com', 'https://namkyungsteel.com')
ON CONFLICT (domain) DO NOTHING;