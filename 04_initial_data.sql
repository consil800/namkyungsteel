-- 04. 초기 데이터 및 샘플 데이터
-- 시스템 운영에 필요한 기본 데이터

-- 기본 마스터 사용자 추가
INSERT INTO users (username, email, name, role, company_domain, company_name) 
VALUES 
    ('admin', 'admin@namkyungsteel.com', '시스템 관리자', 'master', 'namkyungsteel.com', '남경스틸(주)')
ON CONFLICT (username) DO NOTHING;

-- 샘플 사용자 추가 (테스트용 - 필요시 삭제 가능)
INSERT INTO users (username, email, name, role, company_domain, company_name) 
VALUES 
    ('test_user1', 'test1@namkyungsteel.com', '김철수', 'employee', 'namkyungsteel.com', '남경스틸(주)'),
    ('test_user2', 'test2@namkyungsteel.com', '이영희', 'manager', 'namkyungsteel.com', '남경스틸(주)')
ON CONFLICT (username) DO NOTHING;

-- 샘플 업체 데이터 (사용자 1용)
INSERT INTO client_companies (
    user_id, company_name, region, address, phone, contact_person, 
    mobile, email, payment_terms, business_type, color_code,
    visit_count, last_visit_date
) VALUES 
    (1, '대한건설', '서울', '서울시 강남구 테헤란로 123', '02-1234-5678', '박대한', 
     '010-1234-5678', 'info@daehan.co.kr', '30일', '건설업', 'blue', 3, '2024-01-15'),
    (1, '한국제철', '부산', '부산시 사하구 신평동 456', '051-987-6543', '최한국', 
     '010-9876-5432', 'contact@hankook.co.kr', '60일', '제철업', 'green', 2, '2024-01-10'),
    (1, '태평양엔지니어링', '인천', '인천시 연수구 송도동 789', '032-555-1234', '김태평', 
     '010-5555-1234', 'eng@pacific.co.kr', '90일', '엔지니어링', 'red', 1, '2024-01-05')
ON CONFLICT DO NOTHING;

-- 샘플 업체 데이터 (사용자 2용)
INSERT INTO client_companies (
    user_id, company_name, region, address, phone, contact_person, 
    mobile, email, payment_terms, business_type, color_code,
    visit_count, last_visit_date
) VALUES 
    (2, '동방건축', '대구', '대구시 수성구 범어동 321', '053-777-8888', '이동방', 
     '010-7777-8888', 'arch@dongbang.co.kr', '45일', '건축업', 'orange', 4, '2024-01-20'),
    (2, '서부산업', '광주', '광주시 서구 치평동 654', '062-222-3333', '서서부', 
     '010-2222-3333', 'info@seobu.co.kr', '120일', '제조업', 'purple', 2, '2024-01-12')
ON CONFLICT DO NOTHING;

-- 샘플 사용자 설정 데이터 (사용자 1용)
INSERT INTO user_settings (user_id, setting_type, setting_value) VALUES
    -- 지역 설정
    (1, 'region', '경기도'),
    (1, 'region', '충청도'),
    (1, 'region', '전라도'),
    (1, 'region', '경상도'),
    -- 결제조건 설정
    (1, 'payment_terms', '15일'),
    (1, 'payment_terms', '75일'),
    (1, 'payment_terms', '현금'),
    -- 업종 설정
    (1, 'business_type', '조선업'),
    (1, 'business_type', '석유화학'),
    (1, 'business_type', '중공업'),
    -- 방문목적 설정
    (1, 'visit_purpose', '견적상담'),
    (1, 'visit_purpose', '기술지원'),
    (1, 'visit_purpose', '계약체결'),
    (1, 'visit_purpose', '신규영업')
ON CONFLICT (user_id, setting_type, setting_value) DO NOTHING;

-- 샘플 커스텀 색상 데이터 (사용자 1용)
INSERT INTO user_settings (user_id, setting_type, setting_value, display_name, color_value) VALUES
    (1, 'color', '하늘색', '하늘색', '#87CEEB'),
    (1, 'color', '연두색', '연두색', '#9ACD32'),
    (1, 'color', '분홍색', '분홍색', '#FFB6C1')
ON CONFLICT (user_id, setting_type, setting_value) DO NOTHING;

-- 샘플 업무일지 데이터
INSERT INTO work_logs (
    company_id, user_id, visit_date, visit_purpose, meeting_person, 
    discussion_content, next_action, follow_up_date, additional_notes
) VALUES 
    (1, 1, '2024-01-15', '견적상담', '박대한 부장', '강재 납품 견적 논의 및 수량 확인', '정식 견적서 발송', '2024-01-20', '긴급 프로젝트로 빠른 대응 필요'),
    (1, 1, '2024-01-10', '기술지원', '박대한 부장', '설치 방법 및 품질 기준 설명', '샘플 제품 제공', '2024-01-25', '품질 검사 결과 대기 중'),
    (2, 1, '2024-01-10', '신규영업', '최한국 과장', '신규 거래 제안 및 회사 소개', '제품 카탈로그 전달', '2024-01-18', '의사결정자 미팅 예정')
ON CONFLICT DO NOTHING;

-- 데이터 확인 쿼리들 (필요시 사용)
-- SELECT 'users' as table_name, COUNT(*) as count FROM users
-- UNION ALL
-- SELECT 'client_companies', COUNT(*) FROM client_companies
-- UNION ALL  
-- SELECT 'work_logs', COUNT(*) FROM work_logs
-- UNION ALL
-- SELECT 'user_settings', COUNT(*) FROM user_settings;