# 데이터베이스 설계 🗄️

## 테이블 구조

### 1. users (사용자 정보)
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    oauth_id VARCHAR(255) UNIQUE,
    role VARCHAR(20) DEFAULT 'employee',
    is_approved BOOLEAN DEFAULT false,
    profile_image TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**주요 컬럼**:
- `id`: 기본키 (자동증가)
- `oauth_id`: Kakao OAuth ID
- `role`: 사용자 역할 (master, admin, employee)
- `is_approved`: 승인 상태

### 2. client_companies (업체 정보)
```sql
CREATE TABLE client_companies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    company_name VARCHAR(200) NOT NULL,
    region VARCHAR(100),
    address TEXT,
    phone VARCHAR(20),
    contact_person VARCHAR(100),
    mobile VARCHAR(20),
    email VARCHAR(255),
    business_type VARCHAR(100),
    products TEXT,
    usage_items TEXT,
    payment_terms VARCHAR(100),
    debt_amount VARCHAR(50),
    color_code VARCHAR(20) DEFAULT 'gray',
    notes TEXT,
    pdf_files JSONB DEFAULT '[]'::jsonb,
    visit_count INTEGER DEFAULT 0,
    last_visit_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**주요 컬럼**:
- `pdf_files`: PDF 파일 정보 (JSON 배열)
- `color_code`: 업체 색상 코드
- `visit_count`: 방문 횟수 (자동 계산)

### 3. work_logs (업무일지)
```sql
CREATE TABLE work_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES client_companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    visit_date DATE NOT NULL,
    visit_purpose VARCHAR(200),
    meeting_person VARCHAR(100),
    discussion_content TEXT,
    next_action TEXT,
    follow_up_date DATE,
    additional_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4. user_settings (사용자 설정)
```sql
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    setting_type VARCHAR(50) NOT NULL,
    setting_value VARCHAR(500) NOT NULL,
    display_name VARCHAR(200),
    color_value TEXT,
    color_meaning TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, setting_type, setting_value)
);
```

**설정 타입**:
- `payment_terms`: 결제조건
- `business_type`: 업종
- `region`: 지역
- `visit_purpose`: 방문목적
- `color`: 색상 설정

## 🔗 테이블 관계

```
users (1) ──────┐
               │
               ├── client_companies (N)
               │   │
               │   └── work_logs (N)
               │
               └── user_settings (N)
```

### 관계 설명
- **일대다 (1:N)**: 한 사용자가 여러 업체 관리
- **일대다 (1:N)**: 한 업체에 여러 업무일지
- **일대다 (1:N)**: 한 사용자가 여러 설정값

## 🔒 보안 정책 (RLS)

### client_companies 정책
```sql
-- 자신이 등록한 업체만 조회/수정 가능
CREATE POLICY "Users can manage their own companies" ON client_companies
    FOR ALL USING (user_id = auth.uid()::integer);
```

### work_logs 정책
```sql
-- 자신의 업무일지만 조회/수정 가능
CREATE POLICY "Users can manage their own work logs" ON work_logs
    FOR ALL USING (user_id = auth.uid()::integer);
```

### user_settings 정책
```sql
-- 자신의 설정만 조회/수정 가능
CREATE POLICY "Users can manage their own settings" ON user_settings
    FOR ALL USING (user_id = auth.uid()::integer);
```

## 📊 인덱스 최적화

### 성능 인덱스
```sql
-- 업체 검색 최적화
CREATE INDEX idx_companies_user_region ON client_companies(user_id, region);
CREATE INDEX idx_companies_name ON client_companies(company_name);

-- 업무일지 검색 최적화
CREATE INDEX idx_work_logs_company_date ON work_logs(company_id, visit_date DESC);
CREATE INDEX idx_work_logs_user_date ON work_logs(user_id, visit_date DESC);

-- 설정 검색 최적화
CREATE INDEX idx_user_settings_type ON user_settings(user_id, setting_type);

-- PDF 파일 검색 최적화 (GIN 인덱스)
CREATE INDEX idx_companies_pdf_files ON client_companies USING gin(pdf_files);
```

## 🔄 자동 업데이트 트리거

### 방문 통계 자동 업데이트
```sql
-- 업무일지 추가/삭제 시 방문통계 자동 업데이트
CREATE OR REPLACE FUNCTION update_visit_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE client_companies 
        SET visit_count = (
            SELECT COUNT(*) FROM work_logs 
            WHERE company_id = NEW.company_id
        ),
        last_visit_date = (
            SELECT MAX(visit_date) FROM work_logs 
            WHERE company_id = NEW.company_id
        )
        WHERE id = NEW.company_id;
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE client_companies 
        SET visit_count = (
            SELECT COUNT(*) FROM work_logs 
            WHERE company_id = OLD.company_id
        ),
        last_visit_date = (
            SELECT MAX(visit_date) FROM work_logs 
            WHERE company_id = OLD.company_id
        )
        WHERE id = OLD.company_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_visit_stats
    AFTER INSERT OR UPDATE OR DELETE ON work_logs
    FOR EACH ROW EXECUTE FUNCTION update_visit_stats();
```

## 📁 파일 저장 구조

### PDF 파일 저장 (JSONB)
```json
{
  "pdf_files": [
    {
      "filename": "견적서_2025.pdf",
      "url": "https://supabase.co/storage/v1/object/public/company-pdfs/123_견적서_2025.pdf",
      "uploadedAt": "2025-01-01T10:30:00Z"
    }
  ]
}
```

### Supabase Storage
- **Bucket**: `company-pdfs`
- **경로**: `{timestamp}_{original_filename}`
- **접근**: 공개 URL

## 🔧 데이터베이스 함수

### RLS 헬퍼 함수
```sql
-- 현재 사용자 ID 설정
CREATE OR REPLACE FUNCTION set_current_user_id(user_id text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql;

-- 현재 사용자 ID 조회
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS text AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql;
```

---
*데이터베이스 설계는 성능, 보안, 확장성을 고려하여 최적화되었습니다.*