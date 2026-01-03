-- 10단계 (마지막): RLS 비활성화 (개발용)
-- Supabase SQL Editor에서 실행하세요

-- 모든 테이블의 RLS 비활성화 (개발 환경용)
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_card_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs DISABLE ROW LEVEL SECURITY;

-- 확인 쿼리 (RLS 상태 확인)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('companies', 'users', 'corporate_card_usage', 'leave_requests', 'notifications', 'documents', 'approval_workflows', 'system_settings', 'activity_logs', 'client_companies', 'work_logs')
ORDER BY tablename;