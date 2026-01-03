-- work_logs 테이블 RLS 정책 수정 (간단하고 안전한 버전)

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can insert own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can update own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can delete own work logs" ON work_logs;

-- 새로운 정책 생성 (문자열 비교만 사용)
CREATE POLICY "Users can view own work logs" ON work_logs
    FOR SELECT USING (user_id::text = get_current_user_id());

CREATE POLICY "Users can insert own work logs" ON work_logs
    FOR INSERT WITH CHECK (user_id::text = get_current_user_id());

CREATE POLICY "Users can update own work logs" ON work_logs
    FOR UPDATE USING (user_id::text = get_current_user_id());

CREATE POLICY "Users can delete own work logs" ON work_logs
    FOR DELETE USING (user_id::text = get_current_user_id());