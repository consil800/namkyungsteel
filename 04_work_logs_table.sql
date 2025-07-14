-- 4단계: 업무일지 테이블 생성
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS work_logs (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    author VARCHAR(255) NOT NULL,
    region VARCHAR(255),
    client_company VARCHAR(255),
    project VARCHAR(255),
    work_content TEXT NOT NULL,
    meeting_participants TEXT,
    next_steps TEXT,
    issues TEXT,
    achievement_rate INTEGER CHECK (achievement_rate >= 0 AND achievement_rate <= 100),
    weather VARCHAR(100),
    temperature VARCHAR(50),
    departure_time TIME,
    arrival_time TIME,
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    notes TEXT,
    photo_urls TEXT[], -- 사진 URL 배열
    company_domain VARCHAR(100) NOT NULL DEFAULT 'namkyungsteel.com',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);
CREATE INDEX IF NOT EXISTS idx_work_logs_author ON work_logs(author);
CREATE INDEX IF NOT EXISTS idx_work_logs_company_domain ON work_logs(company_domain);