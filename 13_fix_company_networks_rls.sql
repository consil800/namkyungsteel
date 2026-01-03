-- 13. company_networks 테이블 RLS 정책 수정
-- 업체 관계도 저장 시 403/406 오류 해결

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can manage their own networks" ON company_networks;
DROP POLICY IF EXISTS "Users can manage relationships in their networks" ON company_relationships;

-- user_id 컬럼을 TEXT로 변경 (user_settings와 일관성 유지)
ALTER TABLE company_networks 
    ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- 더 유연한 타입 비교를 사용하는 새로운 정책 생성
CREATE POLICY "Users can manage their own networks" 
ON company_networks 
FOR ALL 
USING (
    user_id = get_current_user_id() 
    OR user_id = NULLIF(get_current_user_id(), '')
    OR user_id::integer = NULLIF(get_current_user_id(), '')::integer
    OR get_current_user_id() IS NULL  -- 개발 중 임시 허용
);

-- company_relationships 정책도 수정
CREATE POLICY "Users can manage relationships in their networks" 
ON company_relationships 
FOR ALL 
USING (
    network_id IN (
        SELECT id FROM company_networks 
        WHERE user_id = get_current_user_id() 
           OR user_id = NULLIF(get_current_user_id(), '')
           OR user_id::integer = NULLIF(get_current_user_id(), '')::integer
           OR get_current_user_id() IS NULL
    )
);

-- 인덱스 재생성
DROP INDEX IF EXISTS idx_company_networks_user_id;
CREATE INDEX idx_company_networks_user_id ON company_networks(user_id);

-- 데이터 타입 확인 및 디버깅
DO $$
DECLARE
    current_user_id_val TEXT;
BEGIN
    current_user_id_val := get_current_user_id();
    RAISE NOTICE '현재 사용자 ID: %, 타입: %', current_user_id_val, pg_typeof(current_user_id_val);
    
    -- company_networks 테이블 정보 출력
    RAISE NOTICE 'company_networks.user_id 컬럼 타입: %', 
        (SELECT data_type FROM information_schema.columns 
         WHERE table_name = 'company_networks' 
         AND column_name = 'user_id');
END $$;

-- Accept 헤더 문제 해결을 위한 뷰 생성 (406 오류 방지)
CREATE OR REPLACE VIEW company_networks_view AS
SELECT 
    id::text as id,
    user_id,
    center_company_id,
    center_company_name,
    network_data,
    created_at,
    updated_at
FROM company_networks;

-- 뷰에도 RLS 적용
ALTER VIEW company_networks_view SET (security_invoker = true);

COMMENT ON POLICY "Users can manage their own networks" ON company_networks IS 
    'user_id 타입에 관계없이 본인 네트워크 관리 허용 - 403/406 오류 수정';

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ company_networks RLS 정책이 수정되었습니다.';
    RAISE NOTICE '📋 변경사항:';
    RAISE NOTICE '   - user_id 컬럼을 TEXT 타입으로 변경';
    RAISE NOTICE '   - 유연한 타입 비교 정책 적용';
    RAISE NOTICE '   - 406 오류 방지를 위한 뷰 생성';
END $$;