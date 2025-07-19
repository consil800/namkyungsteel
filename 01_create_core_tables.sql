-- 1단계: 핵심 테이블들 생성
-- 회사, 사용자, 업체, 업무일지 테이블

-- 회사 정보 테이블
CREATE TABLE IF NOT EXISTS companies (
    id BIGSERIAL PRIMARY KEY,
    domain VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    display_name VARCHAR(200),
    company_type VARCHAR(50) DEFAULT 'general',
    contact_email VARCHAR(200),
    contact_phone VARCHAR(50),
    address TEXT,
    business_registration_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 회사 정보 추가
INSERT INTO companies (domain, name, display_name, company_type, contact_email, is_active) 
VALUES ('namkyungsteel.com', '남경스틸(주)', '남경스틸(주)', 'steel', 'info@namkyungsteel.com', true)
ON CONFLICT (domain) DO NOTHING;

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    oauth_id VARCHAR(255) UNIQUE,
    oauth_provider VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    department VARCHAR(100),
    position VARCHAR(100),
    role VARCHAR(50) DEFAULT 'employee',
    company_domain VARCHAR(255) DEFAULT 'namkyungsteel.com',
    company_name VARCHAR(255) DEFAULT '남경스틸(주)',
    profile_image TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 기본 마스터 사용자 추가 (비밀번호: admin123)
INSERT INTO users (username, email, password, name, role, company_domain, company_name) 
VALUES ('admin', 'admin@namkyungsteel.com', '$2b$10$9vKzP7wX8YnJ2bZ4QhL1GuOYvBwXqR3mK4sT6uV5nW2xE8yA7cF9S', '시스템 관리자', 'master', 'namkyungsteel.com', '남경스틸(주)')
ON CONFLICT (email) DO NOTHING;

-- 업체 정보 테이블
CREATE TABLE IF NOT EXISTS client_companies (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,  -- 등록한 사용자 ID
    company_name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    address TEXT,
    phone VARCHAR(50),
    contact_person VARCHAR(100),
    mobile VARCHAR(50),
    email VARCHAR(255),
    payment_terms VARCHAR(100),
    debt_amount VARCHAR(100),
    business_type VARCHAR(100),
    products TEXT,
    usage_items TEXT,
    notes TEXT,
    color_code VARCHAR(20) DEFAULT 'blue',
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATE,
    company_domain VARCHAR(255) DEFAULT 'namkyungsteel.com',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 업무일지 테이블
CREATE TABLE IF NOT EXISTS work_logs (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,  -- 작성자 ID
    visit_date DATE NOT NULL,
    visit_purpose VARCHAR(255),
    meeting_person VARCHAR(255),
    discussion_content TEXT,
    next_action TEXT,
    follow_up_date DATE,
    additional_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON users(oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_company_domain ON users(company_domain);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_client_companies_user_id ON client_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_client_companies_company_name ON client_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_client_companies_region ON client_companies(region);
CREATE INDEX IF NOT EXISTS idx_client_companies_company_domain ON client_companies(company_domain);
CREATE INDEX IF NOT EXISTS idx_work_logs_company_id ON work_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_id ON work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_visit_date ON work_logs(visit_date DESC);