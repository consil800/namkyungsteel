-- 4단계: 트리거와 함수 생성

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 모든 테이블에 updated_at 트리거 추가
DO $$
DECLARE
    table_name TEXT;
    tables TEXT[] := ARRAY[
        'companies',
        'users', 
        'client_companies',
        'work_logs',
        'notifications',
        'documents',
        'document_requests',
        'document_templates',
        'corporate_cards',
        'corporate_card_transactions',
        'corporate_card_requests',
        'corporate_card_limits'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_update_%s_updated_at ON %s;
            CREATE TRIGGER trigger_update_%s_updated_at
                BEFORE UPDATE ON %s
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ', table_name, table_name, table_name, table_name);
    END LOOP;
END $$;

-- work_logs 변경 시 client_companies의 방문 통계 자동 업데이트
CREATE OR REPLACE FUNCTION update_company_visit_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- INSERT나 UPDATE의 경우
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE client_companies 
        SET 
            visit_count = (
                SELECT COUNT(*) 
                FROM work_logs 
                WHERE company_id = NEW.company_id
            ),
            last_visit_date = (
                SELECT MAX(visit_date) 
                FROM work_logs 
                WHERE company_id = NEW.company_id
            ),
            updated_at = NOW()
        WHERE id = NEW.company_id;
        
        RETURN NEW;
    END IF;
    
    -- DELETE의 경우
    IF TG_OP = 'DELETE' THEN
        UPDATE client_companies 
        SET 
            visit_count = (
                SELECT COUNT(*) 
                FROM work_logs 
                WHERE company_id = OLD.company_id
            ),
            last_visit_date = (
                SELECT MAX(visit_date) 
                FROM work_logs 
                WHERE company_id = OLD.company_id
            ),
            updated_at = NOW()
        WHERE id = OLD.company_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_company_visit_stats ON work_logs;
CREATE TRIGGER trigger_update_company_visit_stats
    AFTER INSERT OR UPDATE OR DELETE ON work_logs
    FOR EACH ROW EXECUTE FUNCTION update_company_visit_stats();

-- 법인카드 사용량 업데이트 함수
CREATE OR REPLACE FUNCTION update_card_usage_limits()
RETURNS TRIGGER AS $$
DECLARE
    limit_record RECORD;
    transaction_date DATE;
BEGIN
    -- INSERT의 경우만 처리 (사용량 증가)
    IF TG_OP = 'INSERT' THEN
        transaction_date := NEW.transaction_date::DATE;
        
        -- 해당 사용자의 카드 한도 정보 가져오기
        SELECT * INTO limit_record 
        FROM corporate_card_limits 
        WHERE user_id = NEW.user_id AND card_id = NEW.card_id AND is_active = true;
        
        IF FOUND THEN
            -- 일일 한도 리셋 확인
            IF limit_record.last_daily_reset < transaction_date THEN
                UPDATE corporate_card_limits 
                SET daily_used = 0, last_daily_reset = transaction_date
                WHERE id = limit_record.id;
                limit_record.daily_used := 0;
            END IF;
            
            -- 월별 한도 리셋 확인
            IF DATE_TRUNC('month', limit_record.last_monthly_reset) < DATE_TRUNC('month', transaction_date) THEN
                UPDATE corporate_card_limits 
                SET monthly_used = 0, last_monthly_reset = transaction_date
                WHERE id = limit_record.id;
                limit_record.monthly_used := 0;
            END IF;
            
            -- 연별 한도 리셋 확인
            IF DATE_TRUNC('year', limit_record.last_annual_reset) < DATE_TRUNC('year', transaction_date) THEN
                UPDATE corporate_card_limits 
                SET annual_used = 0, last_annual_reset = transaction_date
                WHERE id = limit_record.id;
                limit_record.annual_used := 0;
            END IF;
            
            -- 사용량 업데이트
            UPDATE corporate_card_limits 
            SET 
                daily_used = limit_record.daily_used + NEW.amount,
                monthly_used = limit_record.monthly_used + NEW.amount,
                annual_used = limit_record.annual_used + NEW.amount,
                updated_at = NOW()
            WHERE id = limit_record.id;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 법인카드 사용량 트리거
DROP TRIGGER IF EXISTS trigger_update_card_usage ON corporate_card_transactions;
CREATE TRIGGER trigger_update_card_usage
    AFTER INSERT ON corporate_card_transactions
    FOR EACH ROW EXECUTE FUNCTION update_card_usage_limits();

-- OAuth 사용자 자동 생성 함수
CREATE OR REPLACE FUNCTION handle_oauth_user()
RETURNS TRIGGER AS $$
BEGIN
    -- OAuth ID가 있지만 password가 없는 경우 (OAuth 사용자)
    IF NEW.oauth_id IS NOT NULL AND NEW.password IS NULL THEN
        -- 기본 역할 설정
        IF NEW.role IS NULL THEN
            NEW.role := 'employee';
        END IF;
        
        -- username이 없으면 email을 사용
        IF NEW.username IS NULL THEN
            NEW.username := NEW.email;
        END IF;
        
        -- 마지막 로그인 시간 설정
        NEW.last_login_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- OAuth 사용자 트리거
DROP TRIGGER IF EXISTS trigger_handle_oauth_user ON users;
CREATE TRIGGER trigger_handle_oauth_user
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION handle_oauth_user();

-- 알림 만료 처리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 매일 만료된 알림 정리 (cron job으로 실행 권장)
-- SELECT cleanup_expired_notifications();

COMMENT ON FUNCTION update_updated_at_column() IS '테이블의 updated_at 컬럼을 자동으로 현재 시간으로 갱신';
COMMENT ON FUNCTION update_company_visit_stats() IS '업무일지 변경 시 업체의 방문 통계를 자동으로 업데이트';
COMMENT ON FUNCTION update_card_usage_limits() IS '법인카드 사용 시 사용자별 한도 사용량을 자동으로 업데이트';
COMMENT ON FUNCTION handle_oauth_user() IS 'OAuth 사용자 생성/수정 시 기본값 설정';
COMMENT ON FUNCTION cleanup_expired_notifications() IS '만료된 알림 정리';