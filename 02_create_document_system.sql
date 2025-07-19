-- 2단계: 문서 관리 및 승인 시스템 테이블

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

-- 문서 관리 테이블 (회사별 분리)
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    file_path VARCHAR(500),
    file_size BIGINT,
    file_type VARCHAR(100),
    category VARCHAR(100) DEFAULT 'general',
    tags TEXT[], -- 태그 배열
    is_public BOOLEAN DEFAULT false,
    uploader_id VARCHAR(50) NOT NULL,
    uploader_name VARCHAR(100) NOT NULL,
    company_domain VARCHAR(100) NOT NULL,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 서류 요청 테이블 (모든 종류의 서류를 통합 관리)
CREATE TABLE IF NOT EXISTS document_requests (
    id BIGSERIAL PRIMARY KEY,
    document_type VARCHAR(50) NOT NULL, -- resignation, incident, employment, career, business_trip, proposal, leave
    title VARCHAR(200) NOT NULL,
    content JSONB NOT NULL, -- 서류별 상세 내용을 JSON으로 저장
    requester_id BIGINT NOT NULL,
    requester_name VARCHAR(100) NOT NULL,
    requester_email VARCHAR(200) NOT NULL,
    company_domain VARCHAR(100) NOT NULL,
    
    -- 승인 관련 필드
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, canceled
    current_approver_id BIGINT,
    current_approver_name VARCHAR(100),
    approver_1_id BIGINT,
    approver_1_name VARCHAR(100),
    approver_1_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    approver_1_comment TEXT,
    approver_1_approved_at TIMESTAMPTZ,
    approver_2_id BIGINT,
    approver_2_name VARCHAR(100),
    approver_2_status VARCHAR(20) DEFAULT 'pending',
    approver_2_comment TEXT,
    approver_2_approved_at TIMESTAMPTZ,
    
    -- 메타데이터
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    estimated_completion DATE,
    attachment_urls TEXT[], -- 첨부파일 URL 배열
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 서류 승인 히스토리 테이블
CREATE TABLE IF NOT EXISTS document_approval_history (
    id BIGSERIAL PRIMARY KEY,
    document_request_id BIGINT NOT NULL REFERENCES document_requests(id) ON DELETE CASCADE,
    approver_id BIGINT NOT NULL,
    approver_name VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL, -- approved, rejected, requested_changes
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 문서 템플릿 테이블
CREATE TABLE IF NOT EXISTS document_templates (
    id BIGSERIAL PRIMARY KEY,
    document_type VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    template_content JSONB NOT NULL, -- 템플릿 구조를 JSON으로 저장
    is_active BOOLEAN DEFAULT true,
    company_domain VARCHAR(100) NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 권한 시스템 테이블
CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    resource_type VARCHAR(100) NOT NULL, -- document_requests, notifications, documents 등
    resource_id BIGINT, -- 특정 리소스 ID (NULL이면 타입 전체)
    permission_type VARCHAR(50) NOT NULL, -- read, write, delete, approve
    granted_by BIGINT, -- 권한을 부여한 사용자 ID
    company_domain VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_domain ON notifications(company_domain);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_documents_uploader_id ON documents(uploader_id);
CREATE INDEX IF NOT EXISTS idx_documents_company_domain ON documents(company_domain);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_document_requests_requester_id ON document_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_status ON document_requests(status);
CREATE INDEX IF NOT EXISTS idx_document_requests_document_type ON document_requests(document_type);
CREATE INDEX IF NOT EXISTS idx_document_requests_company_domain ON document_requests(company_domain);
CREATE INDEX IF NOT EXISTS idx_document_approval_history_document_request_id ON document_approval_history(document_request_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_document_type ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_company_domain ON document_templates(company_domain);
CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_type ON permissions(resource_type);
CREATE INDEX IF NOT EXISTS idx_permissions_company_domain ON permissions(company_domain);