-- document_requests 테이블 생성 (간소화된 버전)
-- 타입 호환성 문제 해결

-- 1. 기존 테이블 삭제 (있는 경우)
DROP TABLE IF EXISTS document_requests;

-- 2. document_requests 테이블 생성 (users 테이블 타입에 맞춤)
CREATE TABLE document_requests (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    content TEXT,
    requester_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    current_approver_id BIGINT REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(10) DEFAULT 'normal',
    company_domain TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- 제약조건
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'draft')),
    CONSTRAINT valid_priority CHECK (priority IN ('high', 'normal', 'low')),
    CONSTRAINT valid_document_type CHECK (document_type IN ('proposal', 'resignation', 'incident', 'employment', 'career', 'business_trip', 'leave'))
);

-- 3. 인덱스 생성
CREATE INDEX idx_document_requests_status ON document_requests(status);
CREATE INDEX idx_document_requests_requester ON document_requests(requester_id);
CREATE INDEX idx_document_requests_approver ON document_requests(current_approver_id);
CREATE INDEX idx_document_requests_company ON document_requests(company_domain);
CREATE INDEX idx_document_requests_created ON document_requests(created_at DESC);

-- 4. RLS 활성화 (간단한 정책)
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

-- 5. 모든 인증된 사용자에게 허용 (개발용 - 나중에 제한 가능)
CREATE POLICY "document_requests_all_authenticated" ON document_requests
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 6. 업데이트 트리거
CREATE OR REPLACE FUNCTION update_document_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_requests_updated_at
    BEFORE UPDATE ON document_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_document_requests_updated_at();

-- 성공 메시지
SELECT 'document_requests 테이블이 성공적으로 생성되었습니다.' as message;