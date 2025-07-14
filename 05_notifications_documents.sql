-- 5단계: 알림 및 문서 테이블 생성
-- Supabase SQL Editor에서 실행하세요

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