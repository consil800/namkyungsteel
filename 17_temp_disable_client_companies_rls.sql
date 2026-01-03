-- 임시 해결책: client_companies 테이블의 RLS 비활성화
-- 주의: 이는 임시 조치이며, 추후 적절한 RLS 설정이 필요함

-- client_companies 테이블의 RLS 비활성화
ALTER TABLE client_companies DISABLE ROW LEVEL SECURITY;

-- 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'client_companies';

-- 주의사항:
-- 1. 이는 보안상 권장되지 않는 임시 조치입니다.
-- 2. 모든 사용자가 모든 업체 데이터를 볼 수 있게 됩니다.
-- 3. 추후 적절한 인증 시스템과 함께 RLS를 다시 활성화해야 합니다.
-- 4. 프로덕션 환경에서는 사용하지 마세요.

-- RLS를 다시 활성화하려면:
-- ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;