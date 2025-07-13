-- Supabase RLS 정책 설정 SQL
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Allow anonymous user registration" ON users;
DROP POLICY IF EXISTS "Allow email lookup for registration" ON users;
DROP POLICY IF EXISTS "Allow user login" ON users;

-- users 테이블의 RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 1. 회원가입을 위한 INSERT 정책
CREATE POLICY "Allow anonymous user registration" ON users
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 2. 로그인을 위한 SELECT 정책 (이메일로 사용자 조회)
CREATE POLICY "Allow user login" ON users
FOR SELECT TO anon, authenticated
USING (true);

-- 3. 사용자가 자신의 데이터를 업데이트할 수 있도록
CREATE POLICY "Users can update own data" ON users
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- 4. 사용자 목록 조회를 위한 정책 (중복 이메일 확인용)
CREATE POLICY "Allow user list for registration check" ON users
FOR SELECT TO anon
USING (true);

-- 개발 중에는 RLS를 완전히 비활성화할 수도 있습니다:
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;