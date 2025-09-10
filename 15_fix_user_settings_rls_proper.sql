-- user_settings 테이블 RLS 정책 올바른 수정
-- 문제: 현재 정책이 USING (true)로 되어 있어서 모든 사용자 데이터가 조회됨
-- 해결: 현재 사용자의 데이터만 조회하도록 수정

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON user_settings;

-- RLS 비활성화
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;

-- 올바른 정책 생성 (현재 사용자의 데이터만 조회)
CREATE POLICY "Users can only access own settings" ON user_settings
    FOR ALL 
    USING (user_id::text = current_setting('app.current_user_id', true))
    WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- RLS 다시 활성화
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 확인을 위한 정책 조회
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_settings';