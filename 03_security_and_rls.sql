-- 03. 보안 정책 및 RLS 설정
-- Row Level Security 및 사용자별 데이터 접근 제어

-- RLS 헬퍼 함수 생성
CREATE OR REPLACE FUNCTION set_current_user_id(user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 현재 세션에 사용자 ID 설정
    PERFORM set_config('app.current_user_id', user_id, false);
END;
$$;

-- 현재 사용자 ID를 가져오는 함수 (RLS 정책에서 사용)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- 설정된 사용자 ID 반환, 없으면 null
    RETURN current_setting('app.current_user_id', true);
END;
$$;

-- client_companies 테이블 RLS 설정
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있다면 삭제
DROP POLICY IF EXISTS "Users can view own companies" ON client_companies;
DROP POLICY IF EXISTS "Users can insert own companies" ON client_companies;
DROP POLICY IF EXISTS "Users can update own companies" ON client_companies;
DROP POLICY IF EXISTS "Users can delete own companies" ON client_companies;

-- 사용자는 자신이 등록한 업체만 조회/수정/삭제 가능
CREATE POLICY "Users can view own companies" ON client_companies
    FOR SELECT USING (user_id::text = get_current_user_id());

CREATE POLICY "Users can insert own companies" ON client_companies
    FOR INSERT WITH CHECK (user_id::text = get_current_user_id());

CREATE POLICY "Users can update own companies" ON client_companies
    FOR UPDATE USING (user_id::text = get_current_user_id());

CREATE POLICY "Users can delete own companies" ON client_companies
    FOR DELETE USING (user_id::text = get_current_user_id());

-- work_logs 테이블 RLS 설정
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있다면 삭제
DROP POLICY IF EXISTS "Users can view own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can insert own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can update own work logs" ON work_logs;
DROP POLICY IF EXISTS "Users can delete own work logs" ON work_logs;

-- 사용자는 자신이 작성한 업무일지만 조회/수정/삭제 가능
CREATE POLICY "Users can view own work logs" ON work_logs
    FOR SELECT USING (user_id::text = get_current_user_id());

CREATE POLICY "Users can insert own work logs" ON work_logs
    FOR INSERT WITH CHECK (user_id::text = get_current_user_id());

CREATE POLICY "Users can update own work logs" ON work_logs
    FOR UPDATE USING (user_id::text = get_current_user_id());

CREATE POLICY "Users can delete own work logs" ON work_logs
    FOR DELETE USING (user_id::text = get_current_user_id());

-- user_settings 테이블 RLS 설정
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있다면 삭제
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;

-- 사용자는 자신의 설정만 조회/수정/삭제 가능
CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (user_id::text = get_current_user_id());

CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (user_id::text = get_current_user_id());

CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (user_id::text = get_current_user_id());

CREATE POLICY "Users can delete own settings" ON user_settings
    FOR DELETE USING (user_id::text = get_current_user_id());

-- users 테이블은 RLS 비활성화 (관리자가 모든 사용자를 관리할 수 있도록)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 사용법 예시 (JavaScript에서):
-- await db.client.rpc('set_current_user_id', { user_id: '3' });

COMMENT ON FUNCTION set_current_user_id IS 'RLS를 위해 현재 사용자 ID를 세션에 설정';
COMMENT ON FUNCTION get_current_user_id IS 'RLS 정책에서 사용할 현재 사용자 ID 반환';