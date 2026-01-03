-- 2단계: 사용자 테이블 생성
-- Supabase SQL Editor에서 실행하세요

-- 사용자 테이블 (회사별 분리)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL, -- 회사 내에서만 유니크
    email VARCHAR(255), -- 이메일 주소
    oauth_id VARCHAR(255), -- OAuth 사용자 ID (카카오, 구글 등)
    oauth_provider VARCHAR(50), -- OAuth 제공자 (kakao, google 등)
    phone VARCHAR(20), -- 전화번호
    password VARCHAR(255) NOT NULL, -- 실제 환경에서는 해시화된 비밀번호 저장
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'employee',
    department VARCHAR(100),
    position VARCHAR(100),
    employee_id VARCHAR(50),
    profile_image TEXT, -- 프로필 이미지 (Base64 또는 URL)
    company_domain VARCHAR(100) NOT NULL, -- 회사 도메인으로 테넌트 구분
    company_name VARCHAR(200) DEFAULT '남경스틸(주)',
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT true, -- 사용자 승인 상태
    rejection_reason TEXT, -- 반려 사유
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(username, company_domain), -- 회사별로 유니크한 사용자명
    UNIQUE(email), -- 이메일은 전체적으로 유니크
    FOREIGN KEY (company_domain) REFERENCES companies(domain) ON DELETE CASCADE
);

-- 이메일에 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON users(oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved);

-- 컬럼 설명 추가
COMMENT ON COLUMN users.is_approved IS 'Whether the user has been approved by an administrator to access the system';
COMMENT ON COLUMN users.rejection_reason IS 'Reason for rejecting user account approval';