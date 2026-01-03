-- 01. 핵심 테이블 생성
-- 사용자, 업체, 업무일지, 설정 테이블

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(200),
    password VARCHAR(255),
    oauth_id VARCHAR(255) UNIQUE,
    oauth_provider VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    department VARCHAR(100),
    position VARCHAR(100),
    role VARCHAR(50) DEFAULT 'employee',
    company_domain VARCHAR(100) DEFAULT 'namkyungsteel.com',
    company_name VARCHAR(200) DEFAULT '남경스틸(주)',
    profile_image TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 업체 정보 테이블
CREATE TABLE IF NOT EXISTS client_companies (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    region VARCHAR(100),
    address TEXT,
    phone VARCHAR(50),
    contact_person VARCHAR(100),
    mobile VARCHAR(50),
    email VARCHAR(200),
    payment_terms VARCHAR(100),
    debt_amount DECIMAL(15,2) DEFAULT 0,
    business_type VARCHAR(100),
    products TEXT,
    usage_items TEXT,
    notes TEXT,
    color_code VARCHAR(10) DEFAULT 'gray',
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATE,
    company_domain VARCHAR(100) DEFAULT 'namkyungsteel.com',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 업무일지 테이블
CREATE TABLE IF NOT EXISTS work_logs (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
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

-- 사용자 설정 테이블
CREATE TABLE IF NOT EXISTS user_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    setting_type VARCHAR(50) NOT NULL, -- 'region', 'payment_terms', 'business_type', 'visit_purpose', 'color'
    setting_value TEXT NOT NULL,
    display_name TEXT, -- 화면에 표시될 이름 (색상의 경우)
    color_value TEXT,  -- 색상 코드 (색상의 경우만)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 중복 방지를 위한 유니크 제약
    UNIQUE(user_id, setting_type, setting_value)
);

-- 테이블 설명
COMMENT ON TABLE users IS '사용자 정보 테이블';
COMMENT ON TABLE client_companies IS '사용자별 개인 업체 관리 테이블';
COMMENT ON TABLE work_logs IS '사용자별 업체 방문 업무일지 테이블';
COMMENT ON TABLE user_settings IS '사용자별 드롭다운 설정 전용 테이블';

COMMENT ON COLUMN user_settings.setting_type IS '설정 타입: region, payment_terms, business_type, visit_purpose, color';
COMMENT ON COLUMN user_settings.setting_value IS '설정 값 (색상의 경우 색상명)';
COMMENT ON COLUMN user_settings.display_name IS '화면 표시명 (색상 전용)';
COMMENT ON COLUMN user_settings.color_value IS '색상 코드 값 (색상 전용, #포함)';