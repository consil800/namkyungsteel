-- 응급 RLS 수정 - work_logs 테이블만 임시로 더 관대한 정책 적용

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can insert own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can update own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can delete own work logs" ON work_logs;

-- 임시로 더 관대한 정책 생성 (여러 타입 허용)
CREATE POLICY "Users can view own work logs" ON work_logs
    FOR SELECT USING (
        -- 다양한 타입 비교 허용
        user_id::text = get_current_user_id()
        OR user_id = get_current_user_id()::integer
        OR get_current_user_id() IS NULL  -- RLS 설정이 없으면 허용 (임시)
    );

CREATE POLICY "Users can insert own work logs" ON work_logs
    FOR INSERT WITH CHECK (
        -- 다양한 타입 비교 허용
        user_id::text = get_current_user_id()
        OR user_id = get_current_user_id()::integer
        OR get_current_user_id() IS NULL  -- RLS 설정이 없으면 허용 (임시)
    );

CREATE POLICY "Users can update own work logs" ON work_logs
    FOR UPDATE USING (
        -- 다양한 타입 비교 허용
        user_id::text = get_current_user_id()
        OR user_id = get_current_user_id()::integer
        OR get_current_user_id() IS NULL  -- RLS 설정이 없으면 허용 (임시)
    );

CREATE POLICY "Users can delete own work logs" ON work_logs
    FOR DELETE USING (
        -- 다양한 타입 비교 허용
        user_id::text = get_current_user_id()
        OR user_id = get_current_user_id()::integer
        OR get_current_user_id() IS NULL  -- RLS 설정이 없으면 허용 (임시)
    );