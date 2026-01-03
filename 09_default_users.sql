-- 9단계: 기본 관리자 계정 생성
-- Supabase SQL Editor에서 실행하세요

-- 기본 관리자 계정 생성 (비밀번호는 변경 필요)
INSERT INTO users (username, email, password, name, role, department, position, company_domain, is_active, is_approved) VALUES
('consil800@gmail.com', 'consil800@gmail.com', 'password123', '시스템 관리자', 'master', '관리부', '마스터', 'namkyungsteel.com', true, true)
ON CONFLICT (email) DO NOTHING;

-- 기존 auth.users와 public.users 동기화 (있는 경우에만)
-- auth.users 테이블이 존재하는 경우에만 실행됩니다
DO $$
BEGIN
    -- auth.users 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        -- auth.users가 존재하면 동기화 실행
        INSERT INTO public.users (
          username,
          email,
          oauth_id,
          oauth_provider,
          name,
          role,
          company_domain,
          company_name,
          profile_image,
          is_active,
          is_approved,
          created_at,
          updated_at,
          password
        )
        SELECT 
          COALESCE(au.email, au.id::text),
          au.email,
          au.id::text,
          'oauth',
          COALESCE(
            au.raw_user_meta_data->>'full_name', 
            au.raw_user_meta_data->>'name', 
            au.raw_user_meta_data->>'nickname',
            au.email, 
            'Unknown User'
          ),
          'employee',
          'namkyungsteel.com',
          '남경스틸(주)',
          COALESCE(
            au.raw_user_meta_data->>'avatar_url',
            au.raw_user_meta_data->>'picture'
          ),
          true,
          true, -- 기존 사용자는 승인된 것으로 처리 (하위 호환성)
          au.created_at,
          au.created_at,
          'oauth_user'
        FROM auth.users au
        LEFT JOIN public.users pu ON au.email = pu.email OR au.id::text = pu.oauth_id
        WHERE pu.email IS NULL AND pu.oauth_id IS NULL; -- Only insert if not already exists
        
        RAISE NOTICE 'OAuth users synchronized successfully';
    ELSE
        RAISE NOTICE 'auth.users table not found, skipping OAuth synchronization';
    END IF;
END $$;