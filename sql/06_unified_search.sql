-- =========================================
-- 통합 검색 시스템 (ChatGPT + Claude 협업 설계)
-- 작성일: 2026-01-11
-- PostgreSQL Full-Text Search 활용
-- =========================================

-- =========================================
-- 1) 한국어 검색 설정
-- =========================================
-- 한국어는 기본 FTS가 약하므로 trigram + ILIKE 병행 전략 사용

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =========================================
-- 2) 검색 인덱스 테이블 (통합 검색 뷰)
-- =========================================
CREATE TABLE IF NOT EXISTS search_index (
    id BIGSERIAL PRIMARY KEY,

    -- 원본 참조
    source_type TEXT NOT NULL,  -- 'user', 'document', 'company', 'worklog', 'notification'
    source_id BIGINT NOT NULL,

    -- 검색 가능 필드
    title TEXT,                  -- 제목/이름
    content TEXT,                -- 본문/내용
    tags TEXT[],                 -- 태그/카테고리

    -- 메타데이터
    company_domain TEXT,         -- 회사 도메인 (RLS용)
    owner_id BIGINT,             -- 소유자 ID (권한용)
    visibility TEXT DEFAULT 'company',  -- 'public', 'company', 'private'

    -- 검색 벡터 (PostgreSQL FTS)
    search_vector TSVECTOR,

    -- 검색 우선순위/가중치
    priority INT DEFAULT 0,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 중복 방지
    UNIQUE(source_type, source_id)
);

-- =========================================
-- 3) 검색 인덱스
-- =========================================
-- GIN 인덱스 (Full-Text Search)
CREATE INDEX IF NOT EXISTS idx_search_vector ON search_index USING GIN(search_vector);

-- Trigram 인덱스 (한글 부분 매칭)
CREATE INDEX IF NOT EXISTS idx_search_title_trgm ON search_index USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_search_content_trgm ON search_index USING GIN(content gin_trgm_ops);

-- 필터링 인덱스
CREATE INDEX IF NOT EXISTS idx_search_source ON search_index(source_type);
CREATE INDEX IF NOT EXISTS idx_search_company ON search_index(company_domain);
CREATE INDEX IF NOT EXISTS idx_search_owner ON search_index(owner_id);
CREATE INDEX IF NOT EXISTS idx_search_visibility ON search_index(visibility);

-- =========================================
-- 4) 검색 벡터 자동 업데이트 트리거
-- =========================================
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_search_vector ON search_index;
CREATE TRIGGER trg_search_vector
BEFORE INSERT OR UPDATE ON search_index
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- =========================================
-- 5) 통합 검색 RPC 함수
-- =========================================
CREATE OR REPLACE FUNCTION unified_search(
    p_query TEXT,
    p_user_id BIGINT,
    p_company_domain TEXT DEFAULT NULL,
    p_source_types TEXT[] DEFAULT NULL,  -- 필터: ['user', 'document', 'company', 'worklog']
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    source_type TEXT,
    source_id BIGINT,
    title TEXT,
    content_preview TEXT,
    tags TEXT[],
    priority INT,
    relevance REAL,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
    v_search_query TEXT;
BEGIN
    -- 사용자 역할 조회
    SELECT role INTO v_user_role
    FROM users
    WHERE id = p_user_id;

    -- 검색어 정규화 (공백을 OR로 변환)
    v_search_query := regexp_replace(trim(p_query), '\s+', ' | ', 'g');

    RETURN QUERY
    SELECT
        si.source_type,
        si.source_id,
        si.title,
        LEFT(si.content, 200) as content_preview,
        si.tags,
        si.priority,
        -- 관련성 점수 계산 (FTS + ILIKE 병행)
        (
            COALESCE(ts_rank(si.search_vector, to_tsquery('simple', v_search_query)), 0) * 10 +
            CASE WHEN si.title ILIKE '%' || p_query || '%' THEN 5 ELSE 0 END +
            CASE WHEN si.content ILIKE '%' || p_query || '%' THEN 2 ELSE 0 END +
            si.priority
        )::REAL as relevance,
        si.created_at
    FROM search_index si
    WHERE
        -- 검색 조건 (FTS 또는 ILIKE)
        (
            si.search_vector @@ to_tsquery('simple', v_search_query)
            OR si.title ILIKE '%' || p_query || '%'
            OR si.content ILIKE '%' || p_query || '%'
        )
        -- 소스 타입 필터
        AND (p_source_types IS NULL OR si.source_type = ANY(p_source_types))
        -- 권한 필터
        AND (
            -- public은 모두 볼 수 있음
            si.visibility = 'public'
            -- company는 같은 회사만
            OR (si.visibility = 'company' AND si.company_domain = p_company_domain)
            -- private은 소유자만
            OR (si.visibility = 'private' AND si.owner_id = p_user_id)
            -- master는 모든 것을 볼 수 있음
            OR v_user_role = 'master'
        )
    ORDER BY relevance DESC, si.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- =========================================
-- 6) 자동완성 RPC 함수
-- =========================================
CREATE OR REPLACE FUNCTION search_autocomplete(
    p_query TEXT,
    p_user_id BIGINT,
    p_company_domain TEXT DEFAULT NULL,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    suggestion TEXT,
    source_type TEXT,
    source_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    -- 사용자 역할 조회
    SELECT role INTO v_user_role
    FROM users
    WHERE id = p_user_id;

    -- 최소 2글자 이상 입력 필요
    IF LENGTH(trim(p_query)) < 2 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT DISTINCT ON (si.title)
        si.title as suggestion,
        si.source_type,
        si.source_id
    FROM search_index si
    WHERE
        si.title ILIKE p_query || '%'
        AND (
            si.visibility = 'public'
            OR (si.visibility = 'company' AND si.company_domain = p_company_domain)
            OR (si.visibility = 'private' AND si.owner_id = p_user_id)
            OR v_user_role = 'master'
        )
    ORDER BY si.title, si.priority DESC
    LIMIT p_limit;
END;
$$;

-- =========================================
-- 7) 인덱스 동기화 함수들
-- =========================================

-- 사용자 인덱스 동기화
CREATE OR REPLACE FUNCTION sync_user_to_search_index()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM search_index WHERE source_type = 'user' AND source_id = OLD.id;
        RETURN OLD;
    ELSE
        INSERT INTO search_index (
            source_type, source_id, title, content, tags,
            company_domain, owner_id, visibility, priority
        ) VALUES (
            'user',
            NEW.id,
            NEW.name,
            COALESCE(NEW.department, '') || ' ' || COALESCE(NEW.position, '') || ' ' || COALESCE(NEW.email, ''),
            ARRAY[COALESCE(NEW.department, ''), COALESCE(NEW.position, ''), COALESCE(NEW.role, '')],
            NEW.company_domain,
            NEW.id,
            'company',
            CASE WHEN NEW.role IN ('master', 'company_CEO', 'company_admin') THEN 2 ELSE 1 END
        )
        ON CONFLICT (source_type, source_id) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            tags = EXCLUDED.tags,
            company_domain = EXCLUDED.company_domain,
            priority = EXCLUDED.priority;
        RETURN NEW;
    END IF;
END;
$$;

-- 문서 인덱스 동기화
CREATE OR REPLACE FUNCTION sync_document_to_search_index()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM search_index WHERE source_type = 'document' AND source_id = OLD.id;
        RETURN OLD;
    ELSE
        INSERT INTO search_index (
            source_type, source_id, title, content, tags,
            company_domain, owner_id, visibility, priority
        ) VALUES (
            'document',
            NEW.id,
            NEW.title,
            COALESCE(NEW.content::TEXT, ''),
            ARRAY[COALESCE(NEW.document_type, ''), COALESCE(NEW.status, '')],
            NEW.company_domain,
            NEW.requester_id,
            'company',
            CASE NEW.status WHEN 'approved' THEN 3 WHEN 'pending' THEN 2 ELSE 1 END
        )
        ON CONFLICT (source_type, source_id) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            tags = EXCLUDED.tags,
            priority = EXCLUDED.priority;
        RETURN NEW;
    END IF;
END;
$$;

-- 거래처 인덱스 동기화
CREATE OR REPLACE FUNCTION sync_company_to_search_index()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM search_index WHERE source_type = 'company' AND source_id = OLD.id;
        RETURN OLD;
    ELSE
        INSERT INTO search_index (
            source_type, source_id, title, content, tags,
            company_domain, owner_id, visibility, priority
        ) VALUES (
            'company',
            NEW.id,
            NEW.company_name,
            COALESCE(NEW.address, '') || ' ' || COALESCE(NEW.contact_person, '') || ' ' || COALESCE(NEW.phone, ''),
            ARRAY[COALESCE(NEW.business_type, ''), COALESCE(NEW.industry, '')],
            NEW.company_domain,
            NEW.manager_id,
            'company',
            2
        )
        ON CONFLICT (source_type, source_id) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            tags = EXCLUDED.tags;
        RETURN NEW;
    END IF;
END;
$$;

-- 업무일지 인덱스 동기화
CREATE OR REPLACE FUNCTION sync_worklog_to_search_index()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM search_index WHERE source_type = 'worklog' AND source_id = OLD.id;
        RETURN OLD;
    ELSE
        INSERT INTO search_index (
            source_type, source_id, title, content, tags,
            company_domain, owner_id, visibility, priority
        ) VALUES (
            'worklog',
            NEW.id,
            NEW.work_date::TEXT || ' 업무일지',
            COALESCE(NEW.work_content, ''),
            ARRAY[]::TEXT[],
            NEW.company_domain,
            NEW.user_id,
            'private',
            1
        )
        ON CONFLICT (source_type, source_id) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content;
        RETURN NEW;
    END IF;
END;
$$;

-- =========================================
-- 8) 트리거 생성
-- =========================================
DROP TRIGGER IF EXISTS trg_sync_user_search ON users;
CREATE TRIGGER trg_sync_user_search
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION sync_user_to_search_index();

DROP TRIGGER IF EXISTS trg_sync_document_search ON document_requests;
CREATE TRIGGER trg_sync_document_search
AFTER INSERT OR UPDATE OR DELETE ON document_requests
FOR EACH ROW EXECUTE FUNCTION sync_document_to_search_index();

DROP TRIGGER IF EXISTS trg_sync_company_search ON client_companies;
CREATE TRIGGER trg_sync_company_search
AFTER INSERT OR UPDATE OR DELETE ON client_companies
FOR EACH ROW EXECUTE FUNCTION sync_company_to_search_index();

DROP TRIGGER IF EXISTS trg_sync_worklog_search ON work_logs;
CREATE TRIGGER trg_sync_worklog_search
AFTER INSERT OR UPDATE OR DELETE ON work_logs
FOR EACH ROW EXECUTE FUNCTION sync_worklog_to_search_index();

-- =========================================
-- 9) 기존 데이터 인덱싱 (초기 마이그레이션)
-- =========================================
CREATE OR REPLACE FUNCTION rebuild_search_index()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- 기존 인덱스 삭제
    DELETE FROM search_index;

    -- users 동기화
    INSERT INTO search_index (source_type, source_id, title, content, tags, company_domain, owner_id, visibility, priority)
    SELECT
        'user', id, name,
        COALESCE(department, '') || ' ' || COALESCE(position, '') || ' ' || COALESCE(email, ''),
        ARRAY[COALESCE(department, ''), COALESCE(position, ''), COALESCE(role, '')],
        company_domain, id, 'company',
        CASE WHEN role IN ('master', 'company_CEO', 'company_admin') THEN 2 ELSE 1 END
    FROM users WHERE is_active = true;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- document_requests 동기화
    INSERT INTO search_index (source_type, source_id, title, content, tags, company_domain, owner_id, visibility, priority)
    SELECT
        'document', id, title,
        COALESCE(content::TEXT, ''),
        ARRAY[COALESCE(document_type, ''), COALESCE(status, '')],
        company_domain, requester_id, 'company',
        CASE status WHEN 'approved' THEN 3 WHEN 'pending' THEN 2 ELSE 1 END
    FROM document_requests;
    GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

    -- client_companies 동기화
    INSERT INTO search_index (source_type, source_id, title, content, tags, company_domain, owner_id, visibility, priority)
    SELECT
        'company', id, company_name,
        COALESCE(address, '') || ' ' || COALESCE(contact_person, '') || ' ' || COALESCE(phone, ''),
        ARRAY[COALESCE(business_type, ''), COALESCE(industry, '')],
        company_domain, manager_id, 'company', 2
    FROM client_companies;
    GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

    -- work_logs 동기화
    INSERT INTO search_index (source_type, source_id, title, content, tags, company_domain, owner_id, visibility, priority)
    SELECT
        'worklog', id, work_date::TEXT || ' 업무일지',
        COALESCE(work_content, ''),
        ARRAY[]::TEXT[],
        company_domain, user_id, 'private', 1
    FROM work_logs;
    GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

    RETURN '검색 인덱스 재구축 완료: ' || v_count || '건';
END;
$$;

-- =========================================
-- 10) RLS 정책
-- =========================================
ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_index_select_policy" ON search_index;
CREATE POLICY "search_index_select_policy" ON search_index
FOR SELECT TO authenticated
USING (
    visibility = 'public'
    OR (visibility = 'company' AND company_domain = (
        SELECT company_domain FROM users WHERE email = auth.email()
    ))
    OR (visibility = 'private' AND owner_id = (
        SELECT id FROM users WHERE email = auth.email()
    ))
    OR EXISTS (
        SELECT 1 FROM users WHERE email = auth.email() AND role = 'master'
    )
);

-- =========================================
-- 완료 메시지
-- =========================================
SELECT '통합 검색 시스템 DDL 완료' as message;
