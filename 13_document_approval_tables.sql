-- 13단계: 서류 승인 시스템을 위한 테이블 생성
-- Supabase SQL Editor에서 실행하세요

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
    approver_1_status VARCHAR(20), -- pending, approved, rejected
    approver_1_comment TEXT,
    approver_1_date TIMESTAMPTZ,
    approver_2_id BIGINT,
    approver_2_name VARCHAR(100),
    approver_2_status VARCHAR(20),
    approver_2_comment TEXT,
    approver_2_date TIMESTAMPTZ,
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 서류별 통계를 위한 뷰
CREATE OR REPLACE VIEW document_statistics AS
SELECT 
    company_domain,
    COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as monthly_total,
    COUNT(*) FILTER (WHERE status = 'pending' AND created_at >= date_trunc('month', CURRENT_DATE)) as monthly_pending,
    COUNT(*) FILTER (WHERE status = 'approved' AND created_at >= date_trunc('month', CURRENT_DATE)) as monthly_approved,
    COUNT(*) FILTER (WHERE status = 'rejected' AND created_at >= date_trunc('month', CURRENT_DATE)) as monthly_rejected,
    COUNT(*) FILTER (WHERE document_type = 'leave' AND created_at >= date_trunc('month', CURRENT_DATE)) as monthly_leave,
    COUNT(*) FILTER (WHERE document_type = 'proposal' AND created_at >= date_trunc('month', CURRENT_DATE)) as monthly_proposal
FROM document_requests
GROUP BY company_domain;

-- 최근 활동을 위한 뷰
CREATE OR REPLACE VIEW recent_activities AS
SELECT 
    id,
    document_type,
    title,
    requester_name,
    status,
    created_at,
    company_domain,
    CASE 
        WHEN status = 'pending' THEN '승인 대기중'
        WHEN status = 'approved' THEN '승인됨'
        WHEN status = 'rejected' THEN '반려됨'
        ELSE status
    END as status_text
FROM document_requests
ORDER BY created_at DESC;

-- 인덱스 생성
CREATE INDEX idx_document_requests_company ON document_requests(company_domain);
CREATE INDEX idx_document_requests_requester ON document_requests(requester_id);
CREATE INDEX idx_document_requests_status ON document_requests(status);
CREATE INDEX idx_document_requests_created ON document_requests(created_at);
CREATE INDEX idx_document_requests_approver1 ON document_requests(approver_1_id);
CREATE INDEX idx_document_requests_approver2 ON document_requests(approver_2_id);

-- RLS 정책 비활성화 (개발 단계)
ALTER TABLE document_requests DISABLE ROW LEVEL SECURITY;