-- 업무일지 테이블 생성
CREATE TABLE IF NOT EXISTS work_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    company_id BIGINT NOT NULL,
    company_domain VARCHAR(100) NOT NULL,
    visit_date DATE NOT NULL,
    visit_purpose VARCHAR(100) NOT NULL,
    meeting_person VARCHAR(100),
    discussion_content TEXT NOT NULL,
    next_action TEXT,
    follow_up_date DATE,
    additional_notes TEXT,
    work_date DATE,
    start_time TIME,
    end_time TIME,
    break_time INTEGER DEFAULT 0,
    tasks JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES client_companies(id) ON DELETE CASCADE,
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_work_logs_user_id ON work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_company_id ON work_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_visit_date ON work_logs(visit_date);
CREATE INDEX IF NOT EXISTS idx_work_logs_company_domain ON work_logs(company_domain);

-- RLS 활성화
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성 (개인별 데이터 접근)
CREATE POLICY "Users can manage their own work logs" ON work_logs
    FOR ALL USING (
        user_id IN (
            SELECT id FROM users WHERE id::text = auth.uid()::text
        )
    );

-- 트리거 함수 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_work_logs_updated_at 
    BEFORE UPDATE ON work_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();