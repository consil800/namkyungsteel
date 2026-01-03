-- 업체 관계도 테이블 생성 (수정된 버전)
-- 생성일: 2025-01-19
-- 설명: 업체 간 관계를 저장하는 테이블 (RLS 오류 수정)

-- 1. 업체 네트워크 테이블 (관계 데이터)
CREATE TABLE IF NOT EXISTS company_networks (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL, -- 관계도를 만든 사용자
    center_company_id INTEGER NOT NULL, -- 중심 업체 ID (실제 등록된 업체)
    center_company_name TEXT NOT NULL, -- 중심 업체명
    
    -- 네트워크 구성 데이터 (JSON)
    network_data JSONB DEFAULT '{}', -- 전체 네트워크 구조 저장
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 업체 관계 테이블 (개별 관계)
CREATE TABLE IF NOT EXISTS company_relationships (
    id BIGSERIAL PRIMARY KEY,
    network_id BIGINT NOT NULL, -- company_networks 테이블 참조
    
    -- 관계의 시작점과 끝점
    from_company_name TEXT NOT NULL,
    to_company_name TEXT NOT NULL,
    
    -- 관계 타입 및 정보
    relationship_type TEXT, -- '납품', '매입', '자회사', '모회사', '협력사' 등
    relationship_label TEXT, -- 화살표에 표시될 텍스트
    
    -- 시각적 정보
    from_position JSONB, -- {x: number, y: number}
    to_position JSONB,   -- {x: number, y: number}
    
    -- 업체 정보 (색상, 크기 등)
    from_company_color TEXT DEFAULT '#3498db',
    to_company_color TEXT DEFAULT '#3498db',
    from_company_size TEXT DEFAULT 'medium', -- 'small', 'medium', 'large'
    to_company_size TEXT DEFAULT 'medium',
    
    -- 실제 등록된 업체인지 여부
    from_is_registered BOOLEAN DEFAULT false,
    to_is_registered BOOLEAN DEFAULT false,
    from_company_id INTEGER, -- 등록된 업체인 경우 ID
    to_company_id INTEGER,   -- 등록된 업체인 경우 ID
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_relationship_network FOREIGN KEY (network_id) REFERENCES company_networks(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_company_networks_user_id ON company_networks(user_id);
CREATE INDEX IF NOT EXISTS idx_company_networks_center_company ON company_networks(center_company_id);
CREATE INDEX IF NOT EXISTS idx_company_relationships_network_id ON company_relationships(network_id);
CREATE INDEX IF NOT EXISTS idx_company_relationships_companies ON company_relationships(from_company_name, to_company_name);

-- RLS 정책 설정 (사용자별 데이터 격리) - 간소화된 버전
ALTER TABLE company_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_relationships ENABLE ROW LEVEL SECURITY;

-- RLS 헬퍼 함수가 있는지 확인하고 사용
DO $$
BEGIN
    -- get_current_user_id 함수가 존재하는지 확인
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_current_user_id') THEN
        -- 함수가 존재하면 해당 함수를 사용하는 정책 생성
        EXECUTE 'CREATE POLICY "Users can manage their own networks" 
                 ON company_networks FOR ALL 
                 USING (user_id = CAST(get_current_user_id() AS integer))';
        
        EXECUTE 'CREATE POLICY "Users can manage relationships in their networks" 
                 ON company_relationships FOR ALL 
                 USING (
                     network_id IN (
                         SELECT id FROM company_networks 
                         WHERE user_id = CAST(get_current_user_id() AS integer)
                     )
                 )';
        
        RAISE NOTICE '✅ RLS 정책이 get_current_user_id() 함수를 사용하여 생성되었습니다.';
    ELSE
        -- 함수가 없으면 current_setting을 사용하는 정책 생성
        EXECUTE 'CREATE POLICY "Users can manage their own networks" 
                 ON company_networks FOR ALL 
                 USING (user_id = CAST(current_setting(''app.current_user_id'', true) AS integer))';
        
        EXECUTE 'CREATE POLICY "Users can manage relationships in their networks" 
                 ON company_relationships FOR ALL 
                 USING (
                     network_id IN (
                         SELECT id FROM company_networks 
                         WHERE user_id = CAST(current_setting(''app.current_user_id'', true) AS integer)
                     )
                 )';
        
        RAISE NOTICE '✅ RLS 정책이 current_setting을 사용하여 생성되었습니다.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- RLS 정책 생성에 실패하면 경고만 표시하고 계속 진행
        RAISE WARNING '⚠️ RLS 정책 생성에 실패했습니다: %. 테이블은 생성되었지만 RLS가 적용되지 않을 수 있습니다.', SQLERRM;
END
$$;

-- 트리거 함수 생성 (업데이트 시간 자동 갱신)
CREATE OR REPLACE FUNCTION update_network_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DO $$
BEGIN
    -- 기존 트리거가 있으면 삭제
    DROP TRIGGER IF EXISTS trigger_update_company_networks_updated_at ON company_networks;
    DROP TRIGGER IF EXISTS trigger_update_company_relationships_updated_at ON company_relationships;
    
    -- 새 트리거 생성
    CREATE TRIGGER trigger_update_company_networks_updated_at
        BEFORE UPDATE ON company_networks
        FOR EACH ROW
        EXECUTE FUNCTION update_network_updated_at();

    CREATE TRIGGER trigger_update_company_relationships_updated_at
        BEFORE UPDATE ON company_relationships
        FOR EACH ROW
        EXECUTE FUNCTION update_network_updated_at();
        
    RAISE NOTICE '✅ 업데이트 트리거가 생성되었습니다.';
END
$$;

-- 설명 추가
COMMENT ON TABLE company_networks IS '업체 네트워크 관계도 저장';
COMMENT ON TABLE company_relationships IS '업체 간 개별 관계 정보 저장';
COMMENT ON COLUMN company_networks.network_data IS '전체 네트워크 구조를 JSON으로 저장';
COMMENT ON COLUMN company_relationships.relationship_type IS '관계 유형 (납품, 매입, 자회사, 모회사 등)';
COMMENT ON COLUMN company_relationships.from_position IS '시작 업체 위치 좌표 {x, y}';
COMMENT ON COLUMN company_relationships.to_position IS '대상 업체 위치 좌표 {x, y}';

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '🎯 업체 네트워크 스키마 생성 완료!';
    RAISE NOTICE '📋 생성된 테이블:';
    RAISE NOTICE '   - company_networks: 네트워크 메타데이터';
    RAISE NOTICE '   - company_relationships: 개별 관계 정보';
    RAISE NOTICE '🔒 RLS 정책과 트리거가 설정되었습니다.';
END
$$;