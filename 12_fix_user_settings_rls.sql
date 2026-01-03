-- 12. user_settings 테이블 RLS 정책 수정
-- 색상 추가 시 403 오류 해결

-- 기존 user_settings 정책 모두 삭제
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;

-- user_id는 BIGINT 타입이므로 적절한 형변환 사용
CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (
        user_id::text = get_current_user_id()
        OR user_id = NULLIF(get_current_user_id(), '')::bigint
    );

CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (
        user_id::text = get_current_user_id()
        OR user_id = NULLIF(get_current_user_id(), '')::bigint
    );

CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (
        user_id::text = get_current_user_id()
        OR user_id = NULLIF(get_current_user_id(), '')::bigint
    );

CREATE POLICY "Users can delete own settings" ON user_settings
    FOR DELETE USING (
        user_id::text = get_current_user_id()
        OR user_id = NULLIF(get_current_user_id(), '')::bigint
    );

-- 디버깅용: 현재 RLS 설정 상태 및 테이블 타입 확인
DO $$
DECLARE
    current_user_val TEXT;
    user_id_type TEXT;
BEGIN
    current_user_val := get_current_user_id();
    
    -- user_settings 테이블의 user_id 컬럼 타입 확인
    SELECT data_type INTO user_id_type
    FROM information_schema.columns 
    WHERE table_name = 'user_settings' 
    AND column_name = 'user_id';
    
    RAISE NOTICE 'Current user_id from session: %, Type: %', current_user_val, pg_typeof(current_user_val);
    RAISE NOTICE 'user_settings.user_id column type: %', user_id_type;
END $$;

-- 인덱스가 없으면 생성
CREATE INDEX IF NOT EXISTS idx_user_settings_lookup 
    ON user_settings(user_id, setting_type);

-- 성공 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ user_settings RLS 정책이 수정되었습니다.';
    RAISE NOTICE '📋 user_id는 BIGINT 타입을 유지하며, RLS 정책에서 적절한 형변환을 사용합니다.';
END $$;

COMMENT ON POLICY "Users can insert own settings" ON user_settings IS 
    'user_id BIGINT 타입에 맞춘 RLS 정책 - 403 오류 수정';