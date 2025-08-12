-- 간단한 user_settings 테이블 생성
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
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