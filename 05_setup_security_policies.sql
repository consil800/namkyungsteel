-- 5단계: Row Level Security (RLS) 정책 설정

-- RLS 비활성화 (팀 작업을 위해 모든 데이터 접근 허용)
-- 실제 운영환경에서는 적절한 RLS 정책을 설정하는 것을 권장합니다.

ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_approval_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_card_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_card_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_card_limits DISABLE ROW LEVEL SECURITY;

-- 필요시 RLS를 활성화하고 정책을 설정하려면 아래 주석을 해제하세요:

/*
-- 1. companies 테이블 RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies are viewable by everyone" ON companies FOR SELECT USING (true);
CREATE POLICY "Companies are editable by masters only" ON companies FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid()::text::bigint 
        AND users.role = 'master'
    )
);

-- 2. users 테이블 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own data" ON users FOR SELECT USING (
    id = auth.uid()::text::bigint OR 
    EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid()::text::bigint 
        AND u.role IN ('master', 'company_admin')
    )
);
CREATE POLICY "Users can update their own data" ON users FOR UPDATE USING (
    id = auth.uid()::text::bigint
);

-- 3. client_companies 테이블 RLS
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies are viewable by company members" ON client_companies FOR SELECT USING (
    company_domain = (
        SELECT company_domain FROM users 
        WHERE id = auth.uid()::text::bigint
    )
);
CREATE POLICY "Companies are editable by company members" ON client_companies FOR ALL USING (
    company_domain = (
        SELECT company_domain FROM users 
        WHERE id = auth.uid()::text::bigint
    )
);

-- 4. work_logs 테이블 RLS
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Work logs are viewable by company members" ON work_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM client_companies cc
        JOIN users u ON u.company_domain = cc.company_domain
        WHERE cc.id = work_logs.company_id
        AND u.id = auth.uid()::text::bigint
    )
);
CREATE POLICY "Work logs are editable by company members" ON work_logs FOR ALL USING (
    EXISTS (
        SELECT 1 FROM client_companies cc
        JOIN users u ON u.company_domain = cc.company_domain
        WHERE cc.id = work_logs.company_id
        AND u.id = auth.uid()::text::bigint
    )
);

-- 5. document_requests 테이블 RLS
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Document requests are viewable by company members" ON document_requests FOR SELECT USING (
    company_domain = (
        SELECT company_domain FROM users 
        WHERE id = auth.uid()::text::bigint
    )
);
CREATE POLICY "Users can create document requests" ON document_requests FOR INSERT WITH CHECK (
    requester_id = auth.uid()::text::bigint
);
CREATE POLICY "Users can update their own requests" ON document_requests FOR UPDATE USING (
    requester_id = auth.uid()::text::bigint OR
    current_approver_id = auth.uid()::text::bigint OR
    approver_1_id = auth.uid()::text::bigint OR
    approver_2_id = auth.uid()::text::bigint
);

-- 6. corporate_card_transactions 테이블 RLS
ALTER TABLE corporate_card_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Card transactions viewable by company members" ON corporate_card_transactions FOR SELECT USING (
    company_domain = (
        SELECT company_domain FROM users 
        WHERE id = auth.uid()::text::bigint
    )
);
CREATE POLICY "Users can create their own transactions" ON corporate_card_transactions FOR INSERT WITH CHECK (
    user_id = auth.uid()::text
);
*/

-- 뷰 생성 (자주 사용되는 조인 쿼리들)

-- 사용자와 회사 정보 통합 뷰
CREATE OR REPLACE VIEW user_company_view AS
SELECT 
    u.*,
    c.name as company_full_name,
    c.display_name as company_display_name,
    c.company_type,
    c.contact_email as company_email,
    c.contact_phone as company_phone
FROM users u
LEFT JOIN companies c ON u.company_domain = c.domain;

-- 업체와 최근 업무일지 통합 뷰
CREATE OR REPLACE VIEW company_worklog_summary AS
SELECT 
    cc.*,
    COUNT(wl.id) as actual_visit_count,
    MAX(wl.visit_date) as actual_last_visit_date,
    STRING_AGG(DISTINCT wl.user_id, ', ') as visitors
FROM client_companies cc
LEFT JOIN work_logs wl ON cc.id = wl.company_id
GROUP BY cc.id;

-- 서류 승인 현황 뷰
CREATE OR REPLACE VIEW document_approval_status AS
SELECT 
    dr.*,
    CASE 
        WHEN dr.status = 'approved' THEN 'completed'
        WHEN dr.status = 'rejected' THEN 'rejected'
        WHEN dr.approver_2_id IS NOT NULL AND dr.approver_1_status = 'approved' THEN 'waiting_second_approval'
        WHEN dr.approver_1_id IS NOT NULL THEN 'waiting_first_approval'
        ELSE 'pending'
    END as approval_stage,
    (CASE WHEN dr.approver_1_status = 'approved' THEN 1 ELSE 0 END +
     CASE WHEN dr.approver_2_status = 'approved' THEN 1 ELSE 0 END) as approvals_received,
    (CASE WHEN dr.approver_1_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN dr.approver_2_id IS NOT NULL THEN 1 ELSE 0 END) as approvals_required
FROM document_requests dr;

-- 법인카드 사용 통계 뷰
CREATE OR REPLACE VIEW corporate_card_usage_stats AS
SELECT 
    cc.id as card_id,
    cc.card_name,
    COUNT(cct.id) as transaction_count,
    SUM(cct.amount) as total_amount,
    AVG(cct.amount) as avg_amount,
    MIN(cct.transaction_date) as first_transaction,
    MAX(cct.transaction_date) as last_transaction,
    COUNT(DISTINCT cct.user_id) as unique_users
FROM corporate_cards cc
LEFT JOIN corporate_card_transactions cct ON cc.id = cct.card_id
WHERE cc.is_active = true
GROUP BY cc.id, cc.card_name;

COMMENT ON VIEW user_company_view IS '사용자와 회사 정보를 통합한 뷰';
COMMENT ON VIEW company_worklog_summary IS '업체별 업무일지 요약 통계 뷰';
COMMENT ON VIEW document_approval_status IS '서류 승인 현황을 보여주는 뷰';
COMMENT ON VIEW corporate_card_usage_stats IS '법인카드 사용 통계 뷰';