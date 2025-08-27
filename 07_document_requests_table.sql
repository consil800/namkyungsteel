-- document_requests 테이블 생성 및 설정
-- 서류 결재 시스템을 위한 테이블

-- 1. document_requests 테이블 생성 (users 테이블의 id 타입에 맞춤)
CREATE TABLE IF NOT EXISTS document_requests (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'proposal', 'resignation', 'incident', 'employment', 'career', 'business_trip', 'leave'
    content TEXT,
    requester_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    current_approver_id BIGINT REFERENCES users(id),
    approver_1_id BIGINT REFERENCES users(id),
    approver_2_id BIGINT REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    priority VARCHAR(10) DEFAULT 'normal', -- 'high', 'normal', 'low'
    company_domain TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- 추가 정보 필드들
    metadata JSONB, -- 서류별 추가 정보 저장
    attachments TEXT[], -- 첨부파일 경로들
    
    -- 제약조건
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'draft')),
    CONSTRAINT valid_priority CHECK (priority IN ('high', 'normal', 'low')),
    CONSTRAINT valid_document_type CHECK (document_type IN ('proposal', 'resignation', 'incident', 'employment', 'career', 'business_trip', 'leave'))
);

-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_document_requests_status ON document_requests(status);
CREATE INDEX IF NOT EXISTS idx_document_requests_requester ON document_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_approver ON document_requests(current_approver_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_company ON document_requests(company_domain);
CREATE INDEX IF NOT EXISTS idx_document_requests_created ON document_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_requests_type ON document_requests(document_type);

-- 복합 인덱스 (자주 함께 사용되는 조건들)
CREATE INDEX IF NOT EXISTS idx_document_requests_status_approver ON document_requests(status, current_approver_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_company_status ON document_requests(company_domain, status);

-- 3. RLS (Row Level Security) 정책 설정
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "document_requests_policy" ON document_requests;

-- 새로운 정책 생성 (bigint 타입에 맞춤)
CREATE POLICY "document_requests_policy" ON document_requests
FOR ALL TO authenticated
USING (
    -- 작성자 본인 (bigint 비교)
    requester_id = (
        SELECT id FROM users WHERE email = auth.email()
    )
    OR 
    -- 현재 승인자
    current_approver_id = (
        SELECT id FROM users WHERE email = auth.email()
    )
    OR
    -- 승인자 1, 2
    approver_1_id = (
        SELECT id FROM users WHERE email = auth.email()
    )
    OR
    approver_2_id = (
        SELECT id FROM users WHERE email = auth.email()
    )
    OR
    -- 같은 회사 도메인의 관리자
    (
        company_domain = (
            SELECT company_domain FROM users WHERE email = auth.email()
        )
        AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE email = auth.email()
            AND role IN ('master', 'company_admin', 'company_manager')
        )
    )
    OR
    -- 마스터 권한
    EXISTS (
        SELECT 1 FROM users 
        WHERE email = auth.email()
        AND role = 'master'
    )
)
WITH CHECK (
    -- 삽입 시에는 자신의 회사 도메인으로만 가능
    company_domain = (
        SELECT company_domain FROM users WHERE email = auth.email()
    )
    OR
    -- 마스터는 모든 도메인에 삽입 가능
    EXISTS (
        SELECT 1 FROM users 
        WHERE email = auth.email()
        AND role = 'master'
    )
);

-- 4. 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_document_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 업데이트 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_document_requests_updated_at ON document_requests;
CREATE TRIGGER trigger_update_document_requests_updated_at
    BEFORE UPDATE ON document_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_document_requests_updated_at();

-- 6. 승인/반려 시 타임스탬프 업데이트 트리거
CREATE OR REPLACE FUNCTION handle_document_approval_status()
RETURNS TRIGGER AS $$
BEGIN
    -- 상태가 승인으로 변경된 경우
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        NEW.approved_at = NOW();
        NEW.rejected_at = NULL;
        NEW.rejection_reason = NULL;
    -- 상태가 반려로 변경된 경우
    ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
        NEW.rejected_at = NOW();
        NEW.approved_at = NULL;
    -- 대기 상태로 변경된 경우
    ELSIF NEW.status = 'pending' THEN
        NEW.approved_at = NULL;
        NEW.rejected_at = NULL;
        NEW.rejection_reason = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_document_approval_status ON document_requests;
CREATE TRIGGER trigger_handle_document_approval_status
    BEFORE UPDATE ON document_requests
    FOR Each ROW
    EXECUTE FUNCTION handle_document_approval_status();

-- 7. 초기 테스트 데이터 (선택적)
-- 실제 운영 환경에서는 이 부분을 제거하세요.
/*
INSERT INTO document_requests (
    title, 
    document_type, 
    content, 
    requester_id,
    current_approver_id,
    company_domain
) SELECT 
    '테스트 기안서',
    'proposal',
    '테스트용 기안서 내용입니다.',
    u1.id,
    u2.id,
    u1.company_domain
FROM users u1, users u2 
WHERE u1.role = 'employee' 
AND u2.role IN ('company_admin', 'company_manager')
AND u1.company_domain = u2.company_domain
LIMIT 1;
*/

-- 성공 메시지
SELECT 'document_requests 테이블이 성공적으로 생성되었습니다.' as message;