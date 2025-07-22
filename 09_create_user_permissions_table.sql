-- 09_create_user_permissions_table.sql
-- OR 기반 권한 시스템을 위한 user_permissions 테이블 생성
-- 부서별, 직급별, 개인별 권한 중 하나라도 있으면 접근 가능

-- user_permissions 테이블 생성
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    menu VARCHAR(50) NOT NULL,           -- 메뉴/기능 구분 (worklog, corporate-card, documents)
    permission_type VARCHAR(20) NOT NULL, -- 권한 타입 (department, position, individual)
    target_id VARCHAR(100) NOT NULL,      -- 대상 ID (부서명, 직급명, 또는 사용자 ID)
    permission VARCHAR(20) NOT NULL,      -- 권한 종류 (읽기, 쓰기, 수정, 삭제, 관리)
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),              -- 권한을 설정한 관리자
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(255),              -- 권한을 수정한 관리자
    UNIQUE(menu, permission_type, target_id, permission)
);

-- 권한 타입 체크 제약 조건
ALTER TABLE user_permissions 
ADD CONSTRAINT check_permission_type 
CHECK (permission_type IN ('department', 'position', 'individual'));

-- 권한 종류 체크 제약 조건
ALTER TABLE user_permissions 
ADD CONSTRAINT check_permission 
CHECK (permission IN ('읽기', '쓰기', '수정', '삭제', '관리'));

-- 메뉴 체크 제약 조건
ALTER TABLE user_permissions 
ADD CONSTRAINT check_menu 
CHECK (menu IN ('worklog', 'corporate-card', 'documents'));

-- 인덱스 추가 (성능 향상)
CREATE INDEX idx_user_permissions_menu ON user_permissions(menu);
CREATE INDEX idx_user_permissions_type_target ON user_permissions(permission_type, target_id);
CREATE INDEX idx_user_permissions_permission ON user_permissions(permission);

-- 코멘트 추가
COMMENT ON TABLE user_permissions IS 'OR 기반 사용자 권한 관리 테이블';
COMMENT ON COLUMN user_permissions.menu IS '메뉴/기능 식별자 (worklog: 업무일지, corporate-card: 법인카드, documents: 결제서류)';
COMMENT ON COLUMN user_permissions.permission_type IS '권한 부여 방식 (department: 부서별, position: 직급별, individual: 개인별)';
COMMENT ON COLUMN user_permissions.target_id IS '권한 대상 ID (부서명, 직급명, 또는 사용자 ID)';
COMMENT ON COLUMN user_permissions.permission IS '권한 종류 (읽기, 쓰기, 수정, 삭제, 관리)';

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_permissions_timestamp
    BEFORE UPDATE ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_permissions_updated_at();

-- 샘플 데이터 (예시)
-- INSERT INTO user_permissions (menu, permission_type, target_id, permission, created_by) VALUES
-- ('worklog', 'department', '영업부', '읽기', 'admin@company.com'),
-- ('worklog', 'department', '영업부', '쓰기', 'admin@company.com'),
-- ('worklog', 'position', '대리', '읽기', 'admin@company.com'),
-- ('worklog', 'position', '과장', '관리', 'admin@company.com'),
-- ('corporate-card', 'individual', '123', '읽기', 'admin@company.com'),
-- ('corporate-card', 'individual', '123', '쓰기', 'admin@company.com');

-- RLS 정책 설정
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- 관리자만 권한 테이블을 조회/수정할 수 있도록 정책 설정
CREATE POLICY "관리자는 모든 권한 설정 조회 가능" ON user_permissions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.email = auth.email()
            AND users.role IN ('master', 'company_CEO', 'company_admin')
        )
    );

CREATE POLICY "관리자는 권한 설정 추가 가능" ON user_permissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.email = auth.email()
            AND users.role IN ('master', 'company_CEO', 'company_admin')
        )
    );

CREATE POLICY "관리자는 권한 설정 수정 가능" ON user_permissions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.email = auth.email()
            AND users.role IN ('master', 'company_CEO', 'company_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.email = auth.email()
            AND users.role IN ('master', 'company_CEO', 'company_admin')
        )
    );

CREATE POLICY "관리자는 권한 설정 삭제 가능" ON user_permissions
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.email = auth.email()
            AND users.role IN ('master', 'company_CEO', 'company_admin')
        )
    );

-- 권한 확인을 위한 뷰 생성 (선택사항)
CREATE OR REPLACE VIEW user_permission_check AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email,
    u.department,
    u.position,
    u.role,
    up.menu,
    up.permission,
    up.permission_type,
    CASE 
        WHEN up.permission_type = 'department' THEN u.department = up.target_id
        WHEN up.permission_type = 'position' THEN u.position = up.target_id
        WHEN up.permission_type = 'individual' THEN u.id::text = up.target_id
        ELSE false
    END as has_permission
FROM users u
CROSS JOIN user_permissions up;

-- 권한 확인 함수 (OR 방식)
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id INTEGER,
    p_menu VARCHAR(50),
    p_permission VARCHAR(20)
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_record RECORD;
    v_has_permission BOOLEAN := FALSE;
BEGIN
    -- 사용자 정보 조회
    SELECT id, role, department, position 
    INTO v_user_record
    FROM users 
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- 관리자 역할 확인 (master, company_CEO, company_admin은 모든 권한)
    IF v_user_record.role IN ('master', 'company_CEO', 'company_admin') THEN
        RETURN TRUE;
    END IF;
    
    -- OR 방식으로 권한 확인
    SELECT EXISTS (
        SELECT 1
        FROM user_permissions up
        WHERE up.menu = p_menu
        AND up.permission = p_permission
        AND (
            -- 부서별 권한
            (up.permission_type = 'department' AND up.target_id = v_user_record.department)
            OR
            -- 직급별 권한
            (up.permission_type = 'position' AND up.target_id = v_user_record.position)
            OR
            -- 개인별 권한
            (up.permission_type = 'individual' AND up.target_id = v_user_record.id::text)
        )
    ) INTO v_has_permission;
    
    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION check_user_permission TO authenticated;