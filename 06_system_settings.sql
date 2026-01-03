-- 6단계: 시스템 설정 및 로그 테이블 생성
-- Supabase SQL Editor에서 실행하세요

-- 시스템 설정 테이블
CREATE TABLE IF NOT EXISTS system_settings (
    id BIGSERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB,
    description TEXT,
    is_public BOOLEAN DEFAULT false, -- 클라이언트에서 접근 가능한지
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 로그 테이블 (시스템 활동 추적)
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50), -- user, document, card_usage, etc.
    target_id VARCHAR(50),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 데이터 삽입
INSERT INTO system_settings (setting_key, setting_value, description, is_public) VALUES
('app_name', '"SteelWorks Platform"', '애플리케이션 이름', true),
('app_version', '"1.0.0"', '애플리케이션 버전', true),
('max_file_size', '10485760', '최대 파일 크기 (10MB)', false),
('allowed_file_types', '["jpg", "jpeg", "png", "pdf", "doc", "docx", "xls", "xlsx"]', '허용된 파일 형식', false)
ON CONFLICT (setting_key) DO NOTHING;