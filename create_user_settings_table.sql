-- user_settings 테이블 생성
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_terms JSONB DEFAULT '[]'::jsonb,
    business_types JSONB DEFAULT '[]'::jsonb,
    visit_purposes JSONB DEFAULT '[]'::jsonb,
    regions JSONB DEFAULT '[]'::jsonb,
    colors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- RLS 활성화
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 설정만 볼 수 있음
CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.jwt() ->> 'sub' = user_id::text OR true);

-- RLS 정책: 사용자는 자신의 설정만 수정할 수 있음
CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id::text OR true);

-- RLS 정책: 사용자는 자신의 설정만 삽입할 수 있음
CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id::text OR true);

-- RLS 정책: 사용자는 자신의 설정만 삭제할 수 있음
CREATE POLICY "Users can delete own settings" ON user_settings
    FOR DELETE USING (auth.jwt() ->> 'sub' = user_id::text OR true);

-- 기본 설정 데이터 삽입 함수
CREATE OR REPLACE FUNCTION create_default_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_settings (user_id, payment_terms, business_types, visit_purposes, regions, colors)
    VALUES (
        NEW.id,
        '["현금", "월말결제", "30일", "45일", "60일", "90일", "어음", "기타"]'::jsonb,
        '["제조업", "건설업", "유통업", "기타"]'::jsonb,
        '["신규영업", "기존고객관리", "견적제공", "계약협의", "수금협의", "클레임처리", "기타"]'::jsonb,
        '["서울", "부산", "대구", "경주", "김해", "양산", "함안", "밀양", "창원", "창녕", "울산", "목포", "광주", "광양"]'::jsonb,
        '[{"key": "red", "name": "빨강", "value": "#e74c3c"}, {"key": "orange", "name": "주황", "value": "#f39c12"}, {"key": "yellow", "name": "노랑", "value": "#f1c40f"}, {"key": "green", "name": "초록", "value": "#27ae60"}, {"key": "blue", "name": "파랑", "value": "#3498db"}, {"key": "purple", "name": "보라", "value": "#9b59b6"}, {"key": "gray", "name": "회색", "value": "#95a5a6"}]'::jsonb
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 새 사용자 생성 시 자동으로 기본 설정 생성
CREATE TRIGGER create_user_settings_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_default_user_settings();

-- 기존 사용자들을 위한 기본 설정 생성
INSERT INTO user_settings (user_id, payment_terms, business_types, visit_purposes, regions, colors)
SELECT 
    id,
    '["현금", "월말결제", "30일", "45일", "60일", "90일", "어음", "기타"]'::jsonb,
    '["제조업", "건설업", "유통업", "기타"]'::jsonb,
    '["신규영업", "기존고객관리", "견적제공", "계약협의", "수금협의", "클레임처리", "기타"]'::jsonb,
    '["서울", "부산", "대구", "경주", "김해", "양산", "함안", "밀양", "창원", "창녕", "울산", "목포", "광주", "광양"]'::jsonb,
    '[{"key": "red", "name": "빨강", "value": "#e74c3c"}, {"key": "orange", "name": "주황", "value": "#f39c12"}, {"key": "yellow", "name": "노랑", "value": "#f1c40f"}, {"key": "green", "name": "초록", "value": "#27ae60"}, {"key": "blue", "name": "파랑", "value": "#3498db"}, {"key": "purple", "name": "보라", "value": "#9b59b6"}, {"key": "gray", "name": "회색", "value": "#95a5a6"}]'::jsonb
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_settings WHERE user_settings.user_id = users.id
);