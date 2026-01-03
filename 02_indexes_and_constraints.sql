-- 02. 인덱스 및 제약조건 생성
-- 성능 최적화를 위한 인덱스들

-- users 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON users(oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_company_domain ON users(company_domain);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- client_companies 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_client_companies_user_id ON client_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_client_companies_company_name ON client_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_client_companies_region ON client_companies(region);
CREATE INDEX IF NOT EXISTS idx_client_companies_business_type ON client_companies(business_type);
CREATE INDEX IF NOT EXISTS idx_client_companies_payment_terms ON client_companies(payment_terms);
CREATE INDEX IF NOT EXISTS idx_client_companies_color_code ON client_companies(color_code);

-- work_logs 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_work_logs_company_id ON work_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_id ON work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_visit_date ON work_logs(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_logs_visit_purpose ON work_logs(visit_purpose);

-- user_settings 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_type ON user_settings(setting_type);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_type ON user_settings(user_id, setting_type);

-- 복합 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_client_companies_user_region ON client_companies(user_id, region);
CREATE INDEX IF NOT EXISTS idx_client_companies_user_business_type ON client_companies(user_id, business_type);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_date ON work_logs(user_id, visit_date DESC);

-- 텍스트 검색을 위한 인덱스 (한국어 지원)
CREATE INDEX IF NOT EXISTS idx_client_companies_company_name_text ON client_companies USING gin(to_tsvector('korean', company_name));
CREATE INDEX IF NOT EXISTS idx_client_companies_notes_text ON client_companies USING gin(to_tsvector('korean', notes));
CREATE INDEX IF NOT EXISTS idx_work_logs_content_text ON work_logs USING gin(to_tsvector('korean', discussion_content));

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_companies_updated_at BEFORE UPDATE ON client_companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_logs_updated_at BEFORE UPDATE ON work_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON FUNCTION update_updated_at_column IS '테이블 업데이트 시 updated_at 필드를 자동으로 현재 시간으로 설정';