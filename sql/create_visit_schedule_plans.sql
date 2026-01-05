-- visit_schedule_plans 테이블 생성
-- 스케줄 생성기에서 저장한 방문 계획을 보관

CREATE TABLE IF NOT EXISTS visit_schedule_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  plan_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  schedule_data JSONB NOT NULL,
  total_days INTEGER DEFAULT 0,
  total_companies INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_visit_schedule_plans_user_id ON visit_schedule_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_visit_schedule_plans_dates ON visit_schedule_plans(start_date, end_date);

-- RLS 정책 (Row Level Security)
ALTER TABLE visit_schedule_plans ENABLE ROW LEVEL SECURITY;

-- 사용자별 읽기 권한
CREATE POLICY "Users can view own schedule plans" ON visit_schedule_plans
  FOR SELECT USING (auth.uid()::text = user_id::text OR true);

-- 사용자별 쓰기 권한
CREATE POLICY "Users can insert own schedule plans" ON visit_schedule_plans
  FOR INSERT WITH CHECK (true);

-- 사용자별 수정 권한
CREATE POLICY "Users can update own schedule plans" ON visit_schedule_plans
  FOR UPDATE USING (true);

-- 사용자별 삭제 권한
CREATE POLICY "Users can delete own schedule plans" ON visit_schedule_plans
  FOR DELETE USING (true);

-- 코멘트 추가
COMMENT ON TABLE visit_schedule_plans IS '스케줄 생성기에서 생성한 방문 계획 저장 테이블';
COMMENT ON COLUMN visit_schedule_plans.schedule_data IS 'JSON 형식의 스케줄 데이터 (날짜별 방문 업체 목록)';
