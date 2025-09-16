-- 최종 완전한 RLS 해결책
-- 이 SQL은 모든 테이블에 대해 일관된 RLS 정책을 적용합니다.

-- 1. 기존 모든 RLS 정책 삭제
DROP POLICY IF EXISTS "Users can view own companies" ON client_companies;
DROP POLICY IF EXISTS "Users can insert own companies" ON client_companies;
DROP POLICY IF EXISTS "Users can update own companies" ON client_companies;
DROP POLICY IF EXISTS "Users can delete own companies" ON client_companies;

DROP POLICY IF EXISTS "Users can view own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can insert own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can update own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can delete own work logs" ON work_logs;

DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;

-- 2. 헬퍼 함수 생성 - 현재 사용자의 내부 ID 가져오기
CREATE OR REPLACE FUNCTION get_current_internal_user_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    internal_user_id TEXT;
    auth_user_id TEXT;
BEGIN
    -- 현재 인증된 사용자 ID 가져오기
    auth_user_id := auth.uid()::text;
    
    IF auth_user_id IS NULL THEN
        -- 레거시 방식 (set_current_user_id로 설정된 경우)
        RETURN current_setting('app.current_user_id', true);
    END IF;
    
    -- users 테이블에서 내부 ID 조회
    SELECT id::text INTO internal_user_id
    FROM users
    WHERE oauth_id = auth_user_id
       OR (email IS NOT NULL AND email = auth.jwt() ->> 'email')
    LIMIT 1;
    
    RETURN internal_user_id;
END;
$$;

-- 3. client_companies 테이블 RLS 정책
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;

-- SELECT: 자신의 데이터만 조회
CREATE POLICY "Users can view own companies" ON client_companies
    FOR SELECT
    USING (user_id::text = get_current_internal_user_id());

-- INSERT: 자신의 user_id로만 삽입
CREATE POLICY "Users can insert own companies" ON client_companies
    FOR INSERT
    WITH CHECK (user_id::text = get_current_internal_user_id());

-- UPDATE: 자신의 데이터만 수정
CREATE POLICY "Users can update own companies" ON client_companies
    FOR UPDATE
    USING (user_id::text = get_current_internal_user_id());

-- DELETE: 자신의 데이터만 삭제
CREATE POLICY "Users can delete own companies" ON client_companies
    FOR DELETE
    USING (user_id::text = get_current_internal_user_id());

-- 4. work_logs 테이블 RLS 정책
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own work logs" ON work_logs
    FOR SELECT
    USING (user_id::text = get_current_internal_user_id());

CREATE POLICY "Users can insert own work logs" ON work_logs
    FOR INSERT
    WITH CHECK (user_id::text = get_current_internal_user_id());

CREATE POLICY "Users can update own work logs" ON work_logs
    FOR UPDATE
    USING (user_id::text = get_current_internal_user_id());

CREATE POLICY "Users can delete own work logs" ON work_logs
    FOR DELETE
    USING (user_id::text = get_current_internal_user_id());

-- 5. user_settings 테이블 RLS 정책
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT
    USING (user_id::text = get_current_internal_user_id());

CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT
    WITH CHECK (user_id::text = get_current_internal_user_id());

CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE
    USING (user_id::text = get_current_internal_user_id());

CREATE POLICY "Users can delete own settings" ON user_settings
    FOR DELETE
    USING (user_id::text = get_current_internal_user_id());

-- 6. documents 테이블 RLS 정책 (있는 경우)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
        ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Users can view own documents" ON documents;
        DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
        DROP POLICY IF EXISTS "Users can update own documents" ON documents;
        DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
        
        CREATE POLICY "Users can view own documents" ON documents
            FOR SELECT
            USING (user_id::text = get_current_internal_user_id());
            
        CREATE POLICY "Users can insert own documents" ON documents
            FOR INSERT
            WITH CHECK (user_id::text = get_current_internal_user_id());
            
        CREATE POLICY "Users can update own documents" ON documents
            FOR UPDATE
            USING (user_id::text = get_current_internal_user_id());
            
        CREATE POLICY "Users can delete own documents" ON documents
            FOR DELETE
            USING (user_id::text = get_current_internal_user_id());
    END IF;
END $$;

-- 7. 인덱스 생성/업데이트 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON users(oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_client_companies_user_id ON client_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_id ON work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 8. 함수 권한 설정
GRANT EXECUTE ON FUNCTION get_current_internal_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_internal_user_id() TO anon;

-- 9. 레거시 함수 업데이트 (하위 호환성 유지)
CREATE OR REPLACE FUNCTION set_current_user_id(user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 레거시 지원을 위해 유지하되, 실제로는 세션 변수만 설정
    PERFORM set_config('app.current_user_id', user_id, false);
END;
$$;

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- 새로운 헬퍼 함수를 호출하여 일관성 유지
    RETURN get_current_internal_user_id();
END;
$$;

-- 10. RLS 정책 확인
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename IN ('client_companies', 'work_logs', 'user_settings', 'documents')
ORDER BY tablename, policyname;

-- 11. 시스템 상태 확인
SELECT 
    t.tablename,
    t.rowsecurity as "RLS Enabled",
    COUNT(p.policyname) as "Policy Count"
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.tablename IN ('client_companies', 'work_logs', 'user_settings', 'documents')
  AND t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- 사용 방법:
-- 1. 이 SQL을 Supabase SQL Editor에서 실행
-- 2. 모든 쿼리가 성공적으로 실행되었는지 확인
-- 3. 마지막 두 SELECT 쿼리 결과를 확인하여 RLS가 제대로 설정되었는지 검증

-- 주의사항:
-- - Supabase Auth를 사용하여 로그인해야 RLS가 제대로 작동합니다
-- - Kakao/Google OAuth 로그인 시 자동으로 Supabase Auth 세션이 생성됩니다
-- - 레거시 set_current_user_id 함수는 하위 호환성을 위해 유지되지만, 
--   새로운 시스템에서는 auth.uid()를 기반으로 작동합니다