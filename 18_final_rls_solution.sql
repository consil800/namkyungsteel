-- 최종 RLS 해결책: JWT 기반 인증 사용
-- 이 방법은 Supabase의 표준 인증 방식을 활용합니다

-- 1. 먼저 모든 기존 RLS 정책 삭제
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

-- 2. JWT 토큰에서 사용자 ID를 추출하는 함수 생성
CREATE OR REPLACE FUNCTION auth.user_id() 
RETURNS TEXT 
LANGUAGE SQL 
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )::text
$$;

-- 3. users 테이블에서 내부 ID를 가져오는 함수
CREATE OR REPLACE FUNCTION get_internal_user_id(oauth_id text)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    internal_id INTEGER;
BEGIN
    -- OAuth ID로 내부 사용자 ID 조회
    SELECT id INTO internal_id
    FROM users
    WHERE oauth_id = oauth_id
    LIMIT 1;
    
    -- 찾지 못한 경우 이메일로도 시도
    IF internal_id IS NULL THEN
        SELECT id INTO internal_id
        FROM users
        WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
        LIMIT 1;
    END IF;
    
    RETURN internal_id;
END;
$$;

-- 4. client_companies 테이블 RLS 정책 (JWT 기반)
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;

-- 조회: 자신의 회사 데이터만
CREATE POLICY "Users can view own companies" ON client_companies
    FOR SELECT
    USING (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

-- 삽입: 자신의 user_id로만 삽입 가능
CREATE POLICY "Users can insert own companies" ON client_companies
    FOR INSERT
    WITH CHECK (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

-- 수정: 자신의 회사 데이터만
CREATE POLICY "Users can update own companies" ON client_companies
    FOR UPDATE
    USING (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

-- 삭제: 자신의 회사 데이터만
CREATE POLICY "Users can delete own companies" ON client_companies
    FOR DELETE
    USING (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

-- 5. work_logs 테이블도 동일한 패턴 적용
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own work logs" ON work_logs
    FOR SELECT
    USING (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

CREATE POLICY "Users can insert own work logs" ON work_logs
    FOR INSERT
    WITH CHECK (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

CREATE POLICY "Users can update own work logs" ON work_logs
    FOR UPDATE
    USING (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

CREATE POLICY "Users can delete own work logs" ON work_logs
    FOR DELETE
    USING (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

-- 6. user_settings 테이블도 동일한 패턴 적용
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT
    USING (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT
    WITH CHECK (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE
    USING (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

CREATE POLICY "Users can delete own settings" ON user_settings
    FOR DELETE
    USING (
        user_id::text = (
            SELECT id::text FROM users 
            WHERE oauth_id = auth.uid()::text 
            OR email = current_setting('request.jwt.claims', true)::json->>'email'
            LIMIT 1
        )
    );

-- 7. set_current_user_id와 get_current_user_id 함수는 더 이상 필요없음
-- 하지만 하위 호환성을 위해 남겨둠
CREATE OR REPLACE FUNCTION set_current_user_id(user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 더 이상 사용하지 않음 (JWT 기반으로 전환)
    -- 하위 호환성을 위해 함수는 유지하되 아무 동작도 하지 않음
    NULL;
END;
$$;

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- JWT에서 사용자 ID 추출하여 반환
    RETURN (
        SELECT id::text FROM users 
        WHERE oauth_id = auth.uid()::text 
        OR email = current_setting('request.jwt.claims', true)::json->>'email'
        LIMIT 1
    );
END;
$$;

-- 8. 인덱스 생성으로 성능 최적화
CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON users(oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_client_companies_user_id ON client_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_id ON work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('client_companies', 'work_logs', 'user_settings')
ORDER BY tablename, policyname;