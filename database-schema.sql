-- Supabase 데이터베이스 스키마 생성
-- 이 SQL 스크립트를 Supabase SQL 에디터에서 실행하세요

-- 사용자 테이블 (회사별 분리)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL, -- 회사 내에서만 유니크
    email VARCHAR(255), -- 이메일 주소
    phone VARCHAR(20), -- 전화번호
    password VARCHAR(255) NOT NULL, -- 실제 환경에서는 해시화된 비밀번호 저장
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'employee',
    department VARCHAR(100),
    position VARCHAR(100),
    employee_id VARCHAR(50),
    profile_image TEXT, -- 프로필 이미지 (Base64 또는 URL)
    company_domain VARCHAR(100) NOT NULL, -- 회사 도메인으로 테넌트 구분
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(username, company_domain), -- 회사별로 유니크한 사용자명
    UNIQUE(email), -- 이메일은 전체적으로 유니크
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 이메일에 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

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

-- 알림 테이블 (회사별 분리)
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- info, warning, error, success
    user_id VARCHAR(50), -- 특정 사용자용 알림 (NULL이면 회사 전체 알림)
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    company_domain VARCHAR(100) NOT NULL, -- 회사 도메인으로 테넌트 구분
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

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

-- 문서 관리 테이블 (회사별 분리)
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    document_type VARCHAR(50), -- contract, manual, policy, etc.
    file_url TEXT,
    file_name VARCHAR(200),
    file_size BIGINT,
    uploaded_by VARCHAR(100),
    department VARCHAR(100),
    is_public BOOLEAN DEFAULT false,
    tags TEXT[], -- 태그 배열
    version INTEGER DEFAULT 1,
    parent_document_id BIGINT REFERENCES documents(id),
    company_domain VARCHAR(100) NOT NULL, -- 회사 도메인으로 테넌트 구분
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 승인 워크플로 테이블
CREATE TABLE IF NOT EXISTS approval_workflows (
    id BIGSERIAL PRIMARY KEY,
    request_type VARCHAR(50) NOT NULL, -- leave_request, card_usage, document, etc.
    request_id BIGINT NOT NULL,
    requester VARCHAR(100) NOT NULL,
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',
    approvers JSONB NOT NULL, -- 승인자 정보 배열
    approval_history JSONB DEFAULT '[]', -- 승인 이력
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

CREATE INDEX IF NOT EXISTS idx_card_usage_employee ON corporate_card_usage(employee_name);
CREATE INDEX IF NOT EXISTS idx_card_usage_date ON corporate_card_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_card_usage_status ON corporate_card_usage(status);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_name);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_department ON documents(department);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_type_id ON approval_workflows(request_type, request_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_status ON approval_workflows(status);

-- RLS (Row Level Security) 정책 설정 (멀티 테넌트 보안 강화)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_card_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 회사 정보 정책 (각 회사는 자신의 정보만 볼 수 있음)
CREATE POLICY "Companies can view own data" ON companies
    FOR ALL USING (
        -- 마스터 관리자는 모든 회사 정보 접근 가능
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'master'
        ) OR
        -- 해당 회사의 관리자는 자신의 회사 정보만 접근 가능
        domain = (
            SELECT company_domain FROM users 
            WHERE id::text = auth.uid()::text
        )
    );

-- 사용자 정책 (회사별 데이터 분리)
CREATE POLICY "Users can view company data" ON users
    FOR ALL USING (
        -- 마스터 관리자는 모든 데이터 접근 가능
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'master'
        ) OR
        -- 같은 회사 내에서만 데이터 접근 가능
        company_domain = (
            SELECT company_domain FROM users 
            WHERE id::text = auth.uid()::text
        ) AND (
            -- 자신의 정보는 항상 접근 가능
            id::text = auth.uid()::text OR
            -- 회사 관리자는 같은 회사 모든 사용자 정보 접근 가능
            EXISTS (
                SELECT 1 FROM users 
                WHERE id::text = auth.uid()::text 
                AND role IN ('company_admin', 'company_manager')
                AND company_domain = users.company_domain
            )
        )
    );

-- 법인카드 사용내역 정책 (회사별 데이터 분리)
CREATE POLICY "Card usage company isolation" ON corporate_card_usage
    FOR ALL USING (
        -- 마스터 관리자는 모든 데이터 접근 가능
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'master'
        ) OR
        -- 같은 회사 내에서만 데이터 접근 가능
        company_domain = (
            SELECT company_domain FROM users 
            WHERE id::text = auth.uid()::text
        ) AND (
            -- 자신의 사용내역은 항상 접근 가능
            employee_name = (
                SELECT name FROM users WHERE id::text = auth.uid()::text
            ) OR
            -- 회사 관리자는 같은 회사 모든 사용내역 접근 가능
            EXISTS (
                SELECT 1 FROM users 
                WHERE id::text = auth.uid()::text 
                AND role IN ('company_admin', 'company_manager')
                AND company_domain = corporate_card_usage.company_domain
            )
        )
    );

-- 휴가 신청 정책 (회사별 데이터 분리)
CREATE POLICY "Leave requests company isolation" ON leave_requests
    FOR ALL USING (
        -- 마스터 관리자는 모든 데이터 접근 가능
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'master'
        ) OR
        -- 같은 회사 내에서만 데이터 접근 가능
        company_domain = (
            SELECT company_domain FROM users 
            WHERE id::text = auth.uid()::text
        ) AND (
            -- 자신의 휴가신청은 항상 접근 가능
            employee_name = (
                SELECT name FROM users WHERE id::text = auth.uid()::text
            ) OR
            -- 회사 관리자는 같은 회사 모든 휴가신청 접근 가능
            EXISTS (
                SELECT 1 FROM users 
                WHERE id::text = auth.uid()::text 
                AND role IN ('company_admin', 'company_manager')
                AND company_domain = leave_requests.company_domain
            )
        )
    );

-- 알림 정책 (회사별 데이터 분리)
CREATE POLICY "Notifications company isolation" ON notifications
    FOR ALL USING (
        -- 마스터 관리자는 모든 알림 접근 가능
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'master'
        ) OR
        -- 같은 회사 내에서만 알림 접근 가능
        company_domain = (
            SELECT company_domain FROM users 
            WHERE id::text = auth.uid()::text
        ) AND (
            -- 전체 알림 또는 자신에게 온 알림
            user_id IS NULL OR 
            user_id = (SELECT username FROM users WHERE id::text = auth.uid()::text)
        )
    );

-- 문서 정책 (회사별 데이터 분리)
CREATE POLICY "Documents company isolation" ON documents
    FOR ALL USING (
        -- 마스터 관리자는 모든 문서 접근 가능
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'master'
        ) OR
        -- 같은 회사 내에서만 문서 접근 가능
        company_domain = (
            SELECT company_domain FROM users 
            WHERE id::text = auth.uid()::text
        ) AND (
            -- 공개 문서이거나 회사 관리자인 경우
            is_public = true OR
            EXISTS (
                SELECT 1 FROM users 
                WHERE id::text = auth.uid()::text 
                AND role IN ('company_admin', 'company_manager')
                AND company_domain = documents.company_domain
            )
        )
    );

-- 활동 로그 정책 (회사별 데이터 분리)
CREATE POLICY "Activity logs company isolation" ON activity_logs
    FOR SELECT USING (
        -- 마스터 관리자만 모든 로그 접근 가능
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'master'
        ) OR
        -- 회사 관리자는 자신의 회사 로그만 접근 가능
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role IN ('company_admin', 'company_manager')
            AND company_domain = (activity_logs.details->>'domain')::text
        )
    );

-- 트리거 함수 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_card_usage_updated_at BEFORE UPDATE ON corporate_card_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON approval_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기본 데이터 삽입 (옵션)
INSERT INTO system_settings (setting_key, setting_value, description, is_public) VALUES
('app_name', '"SteelWorks Platform"', '애플리케이션 이름', true),
('app_version', '"1.0.0"', '애플리케이션 버전', true),
('max_file_size', '10485760', '최대 파일 크기 (10MB)', false),
('allowed_file_types', '["jpg", "jpeg", "png", "pdf", "doc", "docx", "xls", "xlsx"]', '허용된 파일 형식', false)
ON CONFLICT (setting_key) DO NOTHING;

-- 기본 회사 등록 (남경스틸)
INSERT INTO companies (company_id, company_name, domain, subdomain, business_number, address, phone, email, website) VALUES
('COMP_NAMKYUNG', '남경스틸(주)', 'namkyungsteel.com', 'namkyung', '123-45-67890', '서울시 강남구', '02-1234-5678', 'info@namkyungsteel.com', 'https://namkyungsteel.com')
ON CONFLICT (domain) DO NOTHING;

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

-- 거래처 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_client_companies_name ON client_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_client_companies_region ON client_companies(region);
CREATE INDEX IF NOT EXISTS idx_client_companies_user_id ON client_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_client_companies_domain ON client_companies(company_domain);

-- 거래처 RLS 정책
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client companies personal isolation" ON client_companies
    FOR ALL USING (
        -- 마스터 관리자는 모든 데이터 접근 가능
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'master'
        ) OR
        -- 본인이 등록한 업체만 접근 가능
        user_id = (
            SELECT id FROM users 
            WHERE id::text = auth.uid()::text
        )
    );

-- 거래처 업데이트 트리거
CREATE TRIGGER update_client_companies_updated_at BEFORE UPDATE ON client_companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기본 관리자 계정 생성 (비밀번호는 변경 필요)
INSERT INTO users (username, password, name, role, department, position, company_domain, is_active) VALUES
('master', 'master123', '마스터 관리자', 'master', '관리부', '마스터', 'namkyungsteel.com', true),
('admin', 'admin123', '시스템 관리자', 'company_admin', '관리부', '관리자', 'namkyungsteel.com', true)
ON CONFLICT (username, company_domain) DO NOTHING;

-- 뷰 생성 (자주 사용되는 조회 쿼리 최적화)
CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT 
    'card_usage' as type,
    id,
    employee_name as requester,
    amount as amount,
    usage_date as request_date,
    status,
    created_at
FROM corporate_card_usage 
WHERE status = 'pending'
UNION ALL
SELECT 
    'leave_request' as type,
    id,
    employee_name as requester,
    NULL as amount,
    start_date as request_date,
    status,
    created_at
FROM leave_requests 
WHERE status = 'pending'
ORDER BY created_at DESC;

-- 통계 뷰
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
    (SELECT COUNT(*) FROM corporate_card_usage WHERE status = 'pending') as pending_card_usage,
    (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending') as pending_leave_requests,
    (SELECT COUNT(*) FROM notifications WHERE is_read = false) as unread_notifications,
    (SELECT COALESCE(SUM(amount), 0) FROM corporate_card_usage WHERE status = 'approved' AND usage_date >= DATE_TRUNC('month', CURRENT_DATE)) as monthly_card_amount;

-- 정기적인 데이터 정리를 위한 함수 (선택사항)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- 6개월 이상 된 읽은 알림 삭제
    DELETE FROM notifications 
    WHERE is_read = true 
    AND read_at < NOW() - INTERVAL '6 months';
    
    -- 1년 이상 된 활동 로그 삭제
    DELETE FROM activity_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    -- 만료된 알림 삭제
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 주석: 이 스크립트를 실행한 후 다음 단계를 진행하세요:
-- 1. Supabase 프로젝트에서 실제 URL과 anon key를 확인
-- 2. database.js 파일의 SUPABASE_URL과 SUPABASE_ANON_KEY 값 업데이트
-- 3. HTML 파일들에 Supabase CDN 링크 추가
-- 4. RLS 정책을 프로젝트 요구사항에 맞게 조정