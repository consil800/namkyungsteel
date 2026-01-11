-- =========================================
-- 결재 보안 RPC 함수들
-- 작성일: 2026-01-11
-- 보안문제 4: 서버 측 원자적 트랜잭션 처리
-- =========================================

-- =========================================
-- 1) 승인 권한 검증 함수
-- security-utils.js의 verifyApprovalPermission에서 호출
-- =========================================
CREATE OR REPLACE FUNCTION verify_approval_permission(
    p_user_id BIGINT,
    p_document_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_document RECORD;
    v_user RECORD;
    v_result JSONB;
BEGIN
    -- 문서 조회
    SELECT * INTO v_document
    FROM document_requests
    WHERE id = p_document_id;

    IF v_document IS NULL THEN
        RETURN jsonb_build_object(
            'authorized', false,
            'reason', 'document_not_found'
        );
    END IF;

    -- 사용자 조회
    SELECT * INTO v_user
    FROM users
    WHERE id = p_user_id;

    IF v_user IS NULL THEN
        RETURN jsonb_build_object(
            'authorized', false,
            'reason', 'user_not_found'
        );
    END IF;

    -- 권한 검증: 현재 승인자이거나 승인자1, 승인자2인지 확인
    IF v_document.current_approver_id = p_user_id
       OR v_document.approver_1_id = p_user_id
       OR v_document.approver_2_id = p_user_id THEN
        RETURN jsonb_build_object(
            'authorized', true,
            'reason', 'is_approver'
        );
    END IF;

    -- 관리자 권한 확인 (같은 회사 도메인)
    IF v_user.role IN ('master', 'company_CEO', 'company_admin', 'company_manager')
       AND v_user.company_domain = v_document.company_domain THEN
        RETURN jsonb_build_object(
            'authorized', true,
            'reason', 'is_admin'
        );
    END IF;

    -- 마스터 권한
    IF v_user.role = 'master' THEN
        RETURN jsonb_build_object(
            'authorized', true,
            'reason', 'is_master'
        );
    END IF;

    RETURN jsonb_build_object(
        'authorized', false,
        'reason', 'not_authorized'
    );
END;
$$;

-- =========================================
-- 2) 문서 승인 처리 함수 (원자적 트랜잭션)
-- security-utils.js의 processApprovalSecure에서 호출
-- =========================================
CREATE OR REPLACE FUNCTION process_document_approval(
    p_document_id BIGINT,
    p_approver_id BIGINT,
    p_signature TEXT,
    p_comment TEXT DEFAULT NULL,
    p_next_approver_id BIGINT DEFAULT NULL,
    p_content_hash TEXT DEFAULT NULL,
    p_approved_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_document RECORD;
    v_approver RECORD;
    v_permission JSONB;
    v_new_status TEXT;
    v_approval_history JSONB;
BEGIN
    -- 1. 권한 검증
    v_permission := verify_approval_permission(p_approver_id, p_document_id);

    IF NOT (v_permission->>'authorized')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authorized',
            'reason', v_permission->>'reason'
        );
    END IF;

    -- 2. 문서 조회 (FOR UPDATE로 락 획득)
    SELECT * INTO v_document
    FROM document_requests
    WHERE id = p_document_id
    FOR UPDATE;

    IF v_document IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'document_not_found'
        );
    END IF;

    -- 3. 이미 처리된 문서인지 확인
    IF v_document.status IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'already_processed',
            'current_status', v_document.status
        );
    END IF;

    -- 4. 승인자 정보 조회
    SELECT * INTO v_approver
    FROM users
    WHERE id = p_approver_id;

    -- 5. 다음 승인자 결정 및 상태 업데이트
    IF p_next_approver_id IS NOT NULL THEN
        -- 다음 승인자가 있으면 pending 유지
        v_new_status := 'pending';
    ELSE
        -- 다음 승인자 없으면 최종 승인
        v_new_status := 'approved';
    END IF;

    -- 6. 승인 이력 생성
    v_approval_history := COALESCE(v_document.metadata->'approval_history', '[]'::jsonb);
    v_approval_history := v_approval_history || jsonb_build_array(
        jsonb_build_object(
            'approver_id', p_approver_id,
            'approver_name', v_approver.name,
            'action', 'approved',
            'signature', p_signature,
            'comment', p_comment,
            'content_hash', p_content_hash,
            'approved_at', p_approved_at
        )
    );

    -- 7. 문서 업데이트 (원자적)
    UPDATE document_requests
    SET
        status = v_new_status,
        current_approver_id = CASE
            WHEN p_next_approver_id IS NOT NULL THEN p_next_approver_id
            ELSE NULL
        END,
        approved_at = CASE
            WHEN v_new_status = 'approved' THEN p_approved_at
            ELSE approved_at
        END,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'approval_history', v_approval_history,
            'last_content_hash', p_content_hash,
            'last_approved_by', p_approver_id,
            'last_approved_at', p_approved_at
        ),
        updated_at = NOW()
    WHERE id = p_document_id;

    -- 8. 감사 로그 기록 (approval_logs 테이블이 있는 경우)
    BEGIN
        INSERT INTO approval_logs (
            document_id,
            user_id,
            action,
            details,
            created_at
        ) VALUES (
            p_document_id,
            p_approver_id,
            'approved',
            jsonb_build_object(
                'signature', p_signature,
                'comment', p_comment,
                'content_hash', p_content_hash,
                'next_approver_id', p_next_approver_id
            ),
            p_approved_at
        );
    EXCEPTION WHEN undefined_table THEN
        -- approval_logs 테이블이 없으면 무시
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'document_id', p_document_id,
        'new_status', v_new_status,
        'next_approver_id', p_next_approver_id,
        'approved_at', p_approved_at
    );
END;
$$;

-- =========================================
-- 3) 문서 반려 처리 함수 (원자적 트랜잭션)
-- security-utils.js의 processRejectionSecure에서 호출
-- =========================================
CREATE OR REPLACE FUNCTION process_document_rejection(
    p_document_id BIGINT,
    p_approver_id BIGINT,
    p_reason TEXT,
    p_rejected_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_document RECORD;
    v_approver RECORD;
    v_permission JSONB;
    v_rejection_history JSONB;
BEGIN
    -- 1. 반려 사유 검증 (10자 이상)
    IF LENGTH(COALESCE(p_reason, '')) < 10 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_reason',
            'message', '반려 사유는 10자 이상이어야 합니다.'
        );
    END IF;

    -- 2. 권한 검증
    v_permission := verify_approval_permission(p_approver_id, p_document_id);

    IF NOT (v_permission->>'authorized')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authorized',
            'reason', v_permission->>'reason'
        );
    END IF;

    -- 3. 문서 조회 (FOR UPDATE로 락 획득)
    SELECT * INTO v_document
    FROM document_requests
    WHERE id = p_document_id
    FOR UPDATE;

    IF v_document IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'document_not_found'
        );
    END IF;

    -- 4. 이미 처리된 문서인지 확인
    IF v_document.status IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'already_processed',
            'current_status', v_document.status
        );
    END IF;

    -- 5. 승인자 정보 조회
    SELECT * INTO v_approver
    FROM users
    WHERE id = p_approver_id;

    -- 6. 반려 이력 생성
    v_rejection_history := COALESCE(v_document.metadata->'rejection_history', '[]'::jsonb);
    v_rejection_history := v_rejection_history || jsonb_build_array(
        jsonb_build_object(
            'approver_id', p_approver_id,
            'approver_name', v_approver.name,
            'reason', p_reason,
            'rejected_at', p_rejected_at
        )
    );

    -- 7. 문서 업데이트 (원자적)
    UPDATE document_requests
    SET
        status = 'rejected',
        rejection_reason = p_reason,
        rejected_at = p_rejected_at,
        current_approver_id = NULL,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'rejection_history', v_rejection_history,
            'can_resubmit', true,
            'rejected_by', p_approver_id,
            'rejected_at', p_rejected_at
        ),
        updated_at = NOW()
    WHERE id = p_document_id;

    -- 8. 감사 로그 기록 (approval_logs 테이블이 있는 경우)
    BEGIN
        INSERT INTO approval_logs (
            document_id,
            user_id,
            action,
            details,
            created_at
        ) VALUES (
            p_document_id,
            p_approver_id,
            'rejected',
            jsonb_build_object(
                'reason', p_reason
            ),
            p_rejected_at
        );
    EXCEPTION WHEN undefined_table THEN
        -- approval_logs 테이블이 없으면 무시
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'document_id', p_document_id,
        'new_status', 'rejected',
        'rejection_reason', p_reason,
        'can_resubmit', true,
        'rejected_at', p_rejected_at
    );
END;
$$;

-- =========================================
-- 4) 문서 재제출 함수 (반려된 문서 수정 후 재제출)
-- security-utils.js의 resubmitDocument에서 호출
-- =========================================
CREATE OR REPLACE FUNCTION resubmit_document(
    p_original_document_id BIGINT,
    p_requester_id BIGINT,
    p_modified_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_original RECORD;
    v_new_document_id BIGINT;
BEGIN
    -- 1. 원본 문서 조회
    SELECT * INTO v_original
    FROM document_requests
    WHERE id = p_original_document_id;

    IF v_original IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'original_not_found'
        );
    END IF;

    -- 2. 작성자 확인
    IF v_original.requester_id != p_requester_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_owner'
        );
    END IF;

    -- 3. 재제출 가능 여부 확인
    IF v_original.status != 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_rejected',
            'current_status', v_original.status
        );
    END IF;

    IF NOT COALESCE((v_original.metadata->>'can_resubmit')::boolean, false) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'resubmit_not_allowed'
        );
    END IF;

    -- 4. 새 문서 생성 (원본 참조 포함)
    INSERT INTO document_requests (
        title,
        document_type,
        content,
        requester_id,
        current_approver_id,
        approver_1_id,
        approver_2_id,
        status,
        priority,
        company_domain,
        metadata,
        attachments
    ) VALUES (
        COALESCE(p_modified_data->>'title', v_original.title),
        v_original.document_type,
        COALESCE(p_modified_data->>'content', v_original.content),
        p_requester_id,
        v_original.approver_1_id, -- 첫 승인자부터 다시 시작
        v_original.approver_1_id,
        v_original.approver_2_id,
        'pending',
        v_original.priority,
        v_original.company_domain,
        jsonb_build_object(
            'previous_document_id', p_original_document_id,
            'resubmitted_at', NOW(),
            'original_rejection_reason', v_original.rejection_reason,
            'modification_notes', p_modified_data->>'notes'
        ),
        v_original.attachments
    ) RETURNING id INTO v_new_document_id;

    -- 5. 원본 문서 재제출 불가 처리
    UPDATE document_requests
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'can_resubmit', false,
        'resubmitted_as', v_new_document_id,
        'resubmitted_at', NOW()
    )
    WHERE id = p_original_document_id;

    RETURN jsonb_build_object(
        'success', true,
        'new_document_id', v_new_document_id,
        'original_document_id', p_original_document_id
    );
END;
$$;

-- =========================================
-- 5) 감사 로그 테이블 생성 (선택적)
-- =========================================
CREATE TABLE IF NOT EXISTS approval_logs (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT REFERENCES document_requests(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'approved', 'rejected', 'viewed', 'modified'
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 감사 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_approval_logs_document ON approval_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_approval_logs_user ON approval_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_logs_action ON approval_logs(action);
CREATE INDEX IF NOT EXISTS idx_approval_logs_created ON approval_logs(created_at DESC);

-- 감사 로그 RLS
ALTER TABLE approval_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approval_logs_policy" ON approval_logs;
CREATE POLICY "approval_logs_policy" ON approval_logs
FOR ALL TO authenticated
USING (
    -- 관리자만 조회 가능
    EXISTS (
        SELECT 1 FROM users
        WHERE email = auth.email()
        AND role IN ('master', 'company_CEO', 'company_admin')
    )
);

-- =========================================
-- 완료 메시지
-- =========================================
SELECT '결재 보안 RPC 함수가 성공적으로 생성되었습니다.' as message;
