-- 색상 의미 컬럼 추가
-- user_settings 테이블에 color_meaning 컬럼 추가

-- color_meaning 컬럼 추가 (색상의 의미를 텍스트로 저장)
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS color_meaning TEXT;

-- 기존 색상 설정에 대한 설명 추가
COMMENT ON COLUMN user_settings.color_meaning IS '색상의 의미나 용도 설명 (예: "긴급", "중요", "일반" 등)';

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_user_settings_color_meaning 
ON user_settings(user_id, setting_type, color_meaning) 
WHERE setting_type = 'color';

-- 기본 색상 의미 데이터 삽입 (예시)
-- 사용자가 직접 추가하므로 기본값은 추가하지 않음

-- 테이블 구조 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_settings' 
ORDER BY ordinal_position;