-- 권한 관리 시스템 테이블 생성
-- 부서별/직급별/개인별 OR 조건 기반 접근 권한 관리

-- 1. 권한 유형 테이블 (업무일지, 법인카드, 결제서류 등)
CREATE TABLE IF NOT EXISTS permission_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    company_domain VARCHAR(255) DEFAULT 'namkyungsteel.com',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 사용자 권한 테이블 (OR 조건: 부서별 OR 직급별 OR 개인별)
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    permission_type_id INTEGER REFERENCES permission_types(id) ON DELETE CASCADE,
    
    -- 개인별 권한 (특정 사용자)
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user_email VARCHAR(255),
    
    -- 부서별 권한
    department VARCHAR(100),
    
    -- 직급별 권한
    position VARCHAR(100),
    
    -- 권한 레벨 (read, write, admin)
    permission_level VARCHAR(20) DEFAULT 'read',
    
    -- 메타데이터
    company_domain VARCHAR(255) DEFAULT 'namkyungsteel.com',
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기본 권한 유형 데이터 삽입
INSERT INTO permission_types (name, display_name, description, company_domain) VALUES
('work_log', '업무일지', '업무일지 열람 및 작성 권한', 'namkyungsteel.com'),
('corporate_card', '법인카드 사용', '법인카드 사용 내역 및 관리 권한', 'namkyungsteel.com'),
('payment_documents', '결제 서류', '결제 서류 열람 및 승인 권한', 'namkyungsteel.com'),
('employee_management', '직원 관리', '직원 정보 관리 권한', 'namkyungsteel.com'),
('document_approval', '서류 승인', '각종 서류 승인 권한', 'namkyungsteel.com')
ON CONFLICT (name) DO NOTHING;

-- 예시: 기본 권한 설정 (부서별)
INSERT INTO user_permissions (permission_type_id, department, permission_level, company_domain) VALUES
((SELECT id FROM permission_types WHERE name = 'work_log'), '영업부', 'write', 'namkyungsteel.com'),
((SELECT id FROM permission_types WHERE name = 'work_log'), '관리부', 'admin', 'namkyungsteel.com'),
((SELECT id FROM permission_types WHERE name = 'corporate_card'), '관리부', 'admin', 'namkyungsteel.com'),
((SELECT id FROM permission_types WHERE name = 'payment_documents'), '관리부', 'admin', 'namkyungsteel.com')
ON CONFLICT DO NOTHING;

-- 예시: 직급별 권한 설정
INSERT INTO user_permissions (permission_type_id, position, permission_level, company_domain) VALUES
((SELECT id FROM permission_types WHERE name = 'employee_management'), '팀장', 'write', 'namkyungsteel.com'),
((SELECT id FROM permission_types WHERE name = 'employee_management'), '부장', 'admin', 'namkyungsteel.com'),
((SELECT id FROM permission_types WHERE name = 'document_approval'), '팀장', 'write', 'namkyungsteel.com'),
((SELECT id FROM permission_types WHERE name = 'document_approval'), '부장', 'admin', 'namkyungsteel.com')
ON CONFLICT DO NOTHING;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_department ON user_permissions(department);
CREATE INDEX IF NOT EXISTS idx_user_permissions_position ON user_permissions(position);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_type ON user_permissions(permission_type_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_company ON user_permissions(company_domain);
CREATE INDEX IF NOT EXISTS idx_permission_types_name ON permission_types(name);

-- Row Level Security 활성화
ALTER TABLE permission_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Enable read access for all users" ON permission_types;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON permission_types;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON permission_types;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON permission_types;

DROP POLICY IF EXISTS "Enable read access for all users" ON user_permissions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON user_permissions;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON user_permissions;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON user_permissions;

-- 권한 유형 테이블 정책
CREATE POLICY "Enable read access for all users" ON permission_types
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON permission_types
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON permission_types
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON permission_types
    FOR DELETE USING (true);

-- 사용자 권한 테이블 정책
CREATE POLICY "Enable read access for all users" ON user_permissions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON user_permissions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON user_permissions
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON user_permissions
    FOR DELETE USING (true);

-- 트리거 함수 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_permission_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 (있는 경우)
DROP TRIGGER IF EXISTS update_permission_types_updated_at ON permission_types;
DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;

-- 트리거 생성
CREATE TRIGGER update_permission_types_updated_at
    BEFORE UPDATE ON permission_types
    FOR EACH ROW
    EXECUTE FUNCTION update_permission_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at
    BEFORE UPDATE ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_permission_updated_at_column();

-- 권한 확인을 위한 뷰 생성 (OR 조건 적용)
CREATE OR REPLACE VIEW user_permission_check AS
SELECT DISTINCT
    u.id as user_id,
    u.email,
    u.name,
    u.department,
    u.position,
    u.company_domain,
    pt.name as permission_type,
    pt.display_name as permission_display_name,
    COALESCE(MAX(
        CASE up.permission_level
            WHEN 'admin' THEN 3
            WHEN 'write' THEN 2
            WHEN 'read' THEN 1
            ELSE 0
        END
    ), 0) as max_permission_level,
    CASE 
        WHEN MAX(
            CASE up.permission_level
                WHEN 'admin' THEN 3
                WHEN 'write' THEN 2
                WHEN 'read' THEN 1
                ELSE 0
            END
        ) >= 3 THEN 'admin'
        WHEN MAX(
            CASE up.permission_level
                WHEN 'admin' THEN 3
                WHEN 'write' THEN 2
                WHEN 'read' THEN 1
                ELSE 0
            END
        ) >= 2 THEN 'write'
        WHEN MAX(
            CASE up.permission_level
                WHEN 'admin' THEN 3
                WHEN 'write' THEN 2
                WHEN 'read' THEN 1
                ELSE 0
            END
        ) >= 1 THEN 'read'
        ELSE 'none'
    END as effective_permission_level
FROM users u
CROSS JOIN permission_types pt
LEFT JOIN user_permissions up ON (
    pt.id = up.permission_type_id 
    AND up.is_active = true
    AND u.company_domain = up.company_domain
    AND (
        -- 개인별 권한 (OR 조건 1)
        (up.user_id = u.id OR up.user_email = u.email)
        OR
        -- 부서별 권한 (OR 조건 2)
        (up.department = u.department AND up.user_id IS NULL AND up.user_email IS NULL)
        OR
        -- 직급별 권한 (OR 조건 3)
        (up.position = u.position AND up.user_id IS NULL AND up.user_email IS NULL AND up.department IS NULL)
    )
)
WHERE u.is_active = true AND pt.is_active = true
GROUP BY u.id, u.email, u.name, u.department, u.position, u.company_domain, pt.id, pt.name, pt.display_name;