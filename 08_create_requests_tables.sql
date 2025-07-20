-- 요청 관리 테이블 생성 SQL
-- 실행 순서: Supabase SQL Editor에서 실행

-- 1. 견적 요청 테이블
CREATE TABLE IF NOT EXISTS quote_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    product_type VARCHAR(100),
    grade VARCHAR(100),
    thickness VARCHAR(50),
    width VARCHAR(50),
    length VARCHAR(50),
    quantity VARCHAR(100),
    delivery_date VARCHAR(100),
    usage_purpose TEXT,
    additional_requirements TEXT,
    attachment_url TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    priority VARCHAR(10) DEFAULT 'normal', -- high, normal, low
    assigned_to BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT REFERENCES users(id)
);

-- 2. 카탈로그 요청 테이블
CREATE TABLE IF NOT EXISTS catalog_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    product_field VARCHAR(100),
    request_details TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(10) DEFAULT 'normal',
    assigned_to BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT REFERENCES users(id)
);

-- 3. 기술지원 요청 테이블
CREATE TABLE IF NOT EXISTS technical_support_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    support_type VARCHAR(100),
    product_info TEXT,
    issue_description TEXT NOT NULL,
    urgency_level VARCHAR(20) DEFAULT 'normal', -- urgent, high, normal, low
    preferred_contact_method VARCHAR(50),
    attachment_url TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(10) DEFAULT 'normal',
    assigned_to BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT REFERENCES users(id)
);

-- 4. 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- quote_request, catalog_request, technical_support, system
    reference_id UUID, -- 관련 요청의 ID
    reference_table VARCHAR(50), -- 관련 테이블명
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON quote_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_status ON catalog_requests(status);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_created_at ON catalog_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_technical_support_requests_status ON technical_support_requests(status);
CREATE INDEX IF NOT EXISTS idx_technical_support_requests_created_at ON technical_support_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- 6. Row Level Security (RLS) 정책 설정
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 관리자와 company_admin만 모든 요청 조회 가능
CREATE POLICY "Admin can view all quote requests" ON quote_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id::text = auth.uid()::text 
            AND users.role IN ('admin', 'company_admin')
        )
    );

CREATE POLICY "Admin can view all catalog requests" ON catalog_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id::text = auth.uid()::text 
            AND users.role IN ('admin', 'company_admin')
        )
    );

CREATE POLICY "Admin can view all technical support requests" ON technical_support_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id::text = auth.uid()::text 
            AND users.role IN ('admin', 'company_admin')
        )
    );

-- 사용자는 자신의 알림만 조회 가능
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR ALL USING (user_id::text = auth.uid()::text);

-- 7. 트리거 함수 생성 (업데이트 시간 자동 갱신)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_quote_requests_updated_at BEFORE UPDATE ON quote_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_catalog_requests_updated_at BEFORE UPDATE ON catalog_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_technical_support_requests_updated_at BEFORE UPDATE ON technical_support_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. 알림 생성 함수
CREATE OR REPLACE FUNCTION create_request_notification(
    request_type TEXT,
    request_id UUID,
    company_name TEXT,
    contact_name TEXT
)
RETURNS VOID AS $$
DECLARE
    admin_user_id BIGINT;
    notification_title TEXT;
    notification_message TEXT;
BEGIN
    -- 관리자 사용자 ID 가져오기 (role이 admin 또는 company_admin인 사용자)
    SELECT id INTO admin_user_id 
    FROM users 
    WHERE role IN ('admin', 'company_admin') 
    LIMIT 1;
    
    -- 알림 제목과 메시지 설정
    CASE request_type
        WHEN 'quote_request' THEN
            notification_title := '새로운 견적 요청';
            notification_message := company_name || '에서 ' || contact_name || '님이 견적을 요청했습니다.';
        WHEN 'catalog_request' THEN
            notification_title := '새로운 카탈로그 요청';
            notification_message := company_name || '에서 ' || contact_name || '님이 카탈로그를 요청했습니다.';
        WHEN 'technical_support' THEN
            notification_title := '새로운 기술지원 요청';
            notification_message := company_name || '에서 ' || contact_name || '님이 기술지원을 요청했습니다.';
        ELSE
            notification_title := '새로운 요청';
            notification_message := company_name || '에서 ' || contact_name || '님이 요청을 보냈습니다.';
    END CASE;
    
    -- 알림 생성
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            reference_id,
            reference_table
        ) VALUES (
            admin_user_id,
            notification_title,
            notification_message,
            request_type,
            request_id,
            request_type || 's'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 9. 요청 생성 시 자동으로 알림 생성하는 트리거
CREATE OR REPLACE FUNCTION trigger_create_request_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- 테이블명에 따라 적절한 타입으로 알림 생성
    CASE TG_TABLE_NAME
        WHEN 'quote_requests' THEN
            PERFORM create_request_notification('quote_request', NEW.id, NEW.company, NEW.contact_name);
        WHEN 'catalog_requests' THEN
            PERFORM create_request_notification('catalog_request', NEW.id, NEW.company, NEW.contact_name);
        WHEN 'technical_support_requests' THEN
            PERFORM create_request_notification('technical_support', NEW.id, NEW.company, NEW.contact_name);
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 적용
CREATE TRIGGER create_quote_request_notification AFTER INSERT ON quote_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_create_request_notification();

CREATE TRIGGER create_catalog_request_notification AFTER INSERT ON catalog_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_create_request_notification();

CREATE TRIGGER create_technical_support_request_notification AFTER INSERT ON technical_support_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_create_request_notification();

-- 완료 메시지
SELECT 'Tables and functions created successfully!' as status;