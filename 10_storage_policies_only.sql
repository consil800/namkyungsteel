-- Storage 버킷 RLS 정책 설정
-- 주의: 먼저 Supabase Dashboard에서 'company-pdfs' 버킷을 생성해야 합니다.

-- 1. 업로드 정책 (인증된 사용자만)
CREATE POLICY "Authenticated users can upload PDF files" ON storage.objects 
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-pdfs');

-- 2. 조회 정책 (공개 조회 가능)
CREATE POLICY "Anyone can view PDF files" ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-pdfs');

-- 3. 업데이트 정책 (인증된 사용자만)
CREATE POLICY "Authenticated users can update PDF files" ON storage.objects 
FOR UPDATE TO authenticated
USING (bucket_id = 'company-pdfs');

-- 4. 삭제 정책 (인증된 사용자만)
CREATE POLICY "Authenticated users can delete PDF files" ON storage.objects 
FOR DELETE TO authenticated
USING (bucket_id = 'company-pdfs');

-- 정책 확인
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';