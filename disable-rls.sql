-- 간단한 RLS 비활성화 SQL
-- Supabase SQL Editor에서 실행하세요

-- users 테이블의 RLS 완전 비활성화 (개발용)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 확인 쿼리 (RLS 상태 확인)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users';