-- users 테이블 구조 확인 쿼리

-- 1. users 테이블의 모든 컬럼 정보 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. users 테이블의 제약조건 확인
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
    AND table_name = 'users';

-- 3. users 테이블의 인덱스 확인
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
    AND tablename = 'users';

-- 4. 샘플 데이터 확인 (최근 5개)
SELECT 
    id,
    username,
    email,
    oauth_id,
    oauth_provider,
    created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 5;

-- 5. auth.users와 public.users 매핑 확인
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    pu.id as public_id,
    pu.oauth_id as public_oauth_id
FROM auth.users au
LEFT JOIN public.users pu ON pu.oauth_id = au.id::TEXT
ORDER BY au.created_at DESC
LIMIT 5;