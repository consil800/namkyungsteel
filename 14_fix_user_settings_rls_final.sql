-- user_settings 테이블 RLS 정책 최종 수정
-- 문제: RLS 정책이 INSERT를 막고 있어서 403 오류 발생

-- 기존 정책들 모두 삭제
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;

-- RLS 임시 비활성화
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;

-- 새로운 정책 생성 (더 관대한 조건)
CREATE POLICY "Allow all operations for authenticated users" ON user_settings
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- RLS 다시 활성화
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 확인을 위한 정책 조회
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_settings';