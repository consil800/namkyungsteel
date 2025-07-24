-- 12_add_user_settings_column.sql
-- 사용자별 개인 설정 저장을 위한 settings 컬럼 추가
-- 생성일: 2025-07-24
-- 목적: 로컬 스토리지에서 Supabase로 설정 관리 전환

-- users 테이블에 settings 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
    "paymentTerms": [],
    "businessTypes": [],
    "regions": [],
    "visitPurposes": [],
    "colors": []
}'::jsonb;

-- settings 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN users.settings IS '사용자별 개인 설정 (결제조건, 업종, 지역, 방문목적, 색상)을 JSON 형태로 저장';

-- settings 컬럼에 인덱스 추가 (검색 성능 향상을 위해)
CREATE INDEX IF NOT EXISTS idx_users_settings_gin ON users USING GIN (settings);

-- 기존 사용자들에게 기본 설정값 적용 (settings가 NULL인 경우)
UPDATE users 
SET settings = '{
    "paymentTerms": ["현금", "월말결제", "30일", "45일", "60일", "90일", "어음", "기타"],
    "businessTypes": ["제조업", "건설업", "유통업", "기타"],
    "regions": ["서울","부산","대구","경주","김해","양산","함안","밀양","창원","창녕","울산","목포","광주","광양"],
    "visitPurposes": ["신규영업", "기존고객관리", "견적제공", "계약협의", "수금협의", "클레임처리", "기타"],
    "colors": [
        {"key": "red", "name": "빨강", "value": "#e74c3c"},
        {"key": "orange", "name": "주황", "value": "#f39c12"},
        {"key": "yellow", "name": "노랑", "value": "#f1c40f"},
        {"key": "green", "name": "초록", "value": "#27ae60"},
        {"key": "blue", "name": "파랑", "value": "#3498db"},
        {"key": "purple", "name": "보라", "value": "#9b59b6"},
        {"key": "gray", "name": "회색", "value": "#95a5a6"}
    ]
}'::jsonb
WHERE settings IS NULL OR settings = '{}'::jsonb;

-- 변경 사항 확인을 위한 쿼리 (선택사항)
-- SELECT id, email, name, settings FROM users LIMIT 5;

-- 성공 메시지
DO $$
BEGIN
    RAISE NOTICE 'users 테이블에 settings 컬럼이 성공적으로 추가되었습니다.';
    RAISE NOTICE '기존 사용자들에게 기본 설정값이 적용되었습니다.';
    RAISE NOTICE '이제 사용자별 개인 설정 관리가 가능합니다.';
END $$;