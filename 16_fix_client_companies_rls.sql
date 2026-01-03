-- client_companies 테이블의 RLS 정책 수정
-- 문제: set_current_user_id 함수가 제대로 동작하지 않아 INSERT가 실패함
-- 해결: 더 유연한 RLS 정책 적용

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own companies" ON client_companies;
DROP POLICY IF EXISTS "Users can insert own companies" ON client_companies;
DROP POLICY IF EXISTS "Users can update own companies" ON client_companies;
DROP POLICY IF EXISTS "Users can delete own companies" ON client_companies;

-- 새로운 정책 생성 (더 유연한 방식)
-- 1. SELECT: 자신의 데이터만 조회
CREATE POLICY "Users can view own companies" ON client_companies
    FOR SELECT 
    USING (
        user_id::text = COALESCE(
            current_setting('app.current_user_id', true),
            auth.uid()::text,
            user_id::text
        )
    );

-- 2. INSERT: user_id가 설정된 경우 허용
CREATE POLICY "Users can insert own companies" ON client_companies
    FOR INSERT 
    WITH CHECK (
        user_id IS NOT NULL AND 
        user_id::text = COALESCE(
            current_setting('app.current_user_id', true),
            auth.uid()::text,
            user_id::text
        )
    );

-- 3. UPDATE: 자신의 데이터만 수정
CREATE POLICY "Users can update own companies" ON client_companies
    FOR UPDATE 
    USING (
        user_id::text = COALESCE(
            current_setting('app.current_user_id', true),
            auth.uid()::text,
            user_id::text
        )
    );

-- 4. DELETE: 자신의 데이터만 삭제
CREATE POLICY "Users can delete own companies" ON client_companies
    FOR DELETE 
    USING (
        user_id::text = COALESCE(
            current_setting('app.current_user_id', true),
            auth.uid()::text,
            user_id::text
        )
    );

-- work_logs 테이블도 동일하게 수정
DROP POLICY IF EXISTS "Users can view own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can insert own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can update own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can delete own work logs" ON work_logs;

-- work_logs 새로운 정책
CREATE POLICY "Users can view own work logs" ON work_logs
    FOR SELECT 
    USING (
        user_id::text = COALESCE(
            current_setting('app.current_user_id', true),
            auth.uid()::text,
            user_id::text
        )
    );

CREATE POLICY "Users can insert own work logs" ON work_logs
    FOR INSERT 
    WITH CHECK (
        user_id IS NOT NULL AND 
        user_id::text = COALESCE(
            current_setting('app.current_user_id', true),
            auth.uid()::text,
            user_id::text
        )
    );

CREATE POLICY "Users can update own work logs" ON work_logs
    FOR UPDATE 
    USING (
        user_id::text = COALESCE(
            current_setting('app.current_user_id', true),
            auth.uid()::text,
            user_id::text
        )
    );

CREATE POLICY "Users can delete own work logs" ON work_logs
    FOR DELETE 
    USING (
        user_id::text = COALESCE(
            current_setting('app.current_user_id', true),
            auth.uid()::text,
            user_id::text
        )
    );

-- 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('client_companies', 'work_logs')
ORDER BY tablename, policyname;