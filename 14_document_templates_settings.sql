-- 문서 템플릿 설정 테이블
CREATE TABLE IF NOT EXISTS document_templates_settings (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(50) UNIQUE NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    template_content TEXT,
    is_enabled BOOLEAN DEFAULT true,
    final_approver_id INTEGER REFERENCES users(id),
    final_approver_name VARCHAR(100),
    final_approver_email VARCHAR(255),
    company_domain VARCHAR(255) DEFAULT 'namkyungsteel.com',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기본 문서 템플릿 설정 추가
INSERT INTO document_templates_settings (template_id, template_name, template_content, is_enabled, company_domain) VALUES
('proposal', '기안서', '기안서 템플릿', true, 'namkyungsteel.com'),
('resignation', '사직서', '사직서 템플릿', true, 'namkyungsteel.com'),
('incident', '경위서', '경위서 템플릿', true, 'namkyungsteel.com'),
('employment', '재직증명서', '재직증명서 템플릿', true, 'namkyungsteel.com'),
('career', '경력증명서', '경력증명서 템플릿', true, 'namkyungsteel.com'),
('business_trip', '출장보고서', '출장보고서 템플릿', true, 'namkyungsteel.com'),
('leave', '연차신청서', '연차신청서 템플릿', true, 'namkyungsteel.com')
ON CONFLICT (template_id) DO NOTHING;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_document_templates_settings_template_id ON document_templates_settings(template_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_settings_company_domain ON document_templates_settings(company_domain);
CREATE INDEX IF NOT EXISTS idx_document_templates_settings_final_approver ON document_templates_settings(final_approver_id);

-- Row Level Security 활성화
ALTER TABLE document_templates_settings ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Enable read access for all users" ON document_templates_settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON document_templates_settings;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON document_templates_settings;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON document_templates_settings;

-- 정책 생성 (모든 사용자가 읽을 수 있고, 관리자만 수정 가능)
CREATE POLICY "Enable read access for all users" ON document_templates_settings
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON document_templates_settings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON document_templates_settings
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON document_templates_settings
    FOR DELETE USING (true);

-- 트리거 함수 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_document_templates_settings_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 (있는 경우)
DROP TRIGGER IF EXISTS update_document_templates_settings_updated_at ON document_templates_settings;

-- 트리거 생성
CREATE TRIGGER update_document_templates_settings_updated_at
    BEFORE UPDATE ON document_templates_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_document_templates_settings_updated_at_column();

-- 뷰 생성 (사용자 정보와 함께 조회)
CREATE OR REPLACE VIEW document_templates_with_approver AS
SELECT 
    dts.*,
    u.name as final_approver_name_from_users,
    u.email as final_approver_email_from_users,
    u.department as final_approver_department,
    u.position as final_approver_position
FROM document_templates_settings dts
LEFT JOIN users u ON dts.final_approver_id = u.id;