# Supabase SQL 설정 순서

Supabase SQL Editor에서 다음 순서대로 실행하세요:

## 실행 순서:

1. **01_companies_table.sql** - 회사 정보 테이블 생성
2. **02_users_table.sql** - 사용자 테이블 생성 (승인 시스템 포함)
3. **03_basic_tables.sql** - 기본 업무 테이블들 생성
4. **04_work_logs_table.sql** - 업무일지 테이블 생성
5. **05_notifications_documents.sql** - 알림 및 문서 테이블 생성
6. **06_system_settings.sql** - 시스템 설정 및 로그 테이블 생성
7. **07_indexes_triggers.sql** - 인덱스 및 트리거 생성
8. **08_oauth_triggers.sql** - OAuth 사용자 자동 생성 트리거
9. **09_default_users.sql** - 기본 관리자 계정 생성
10. **10_disable_rls.sql** - RLS 비활성화 (개발용)

## 주요 특징:

- **승인 시스템**: 새 사용자는 `is_approved = false`로 시작
- **OAuth 지원**: 카카오, 구글 로그인 자동 사용자 생성
- **역할 기반 권한**: master, company_CEO, company_admin, employee
- **회사별 데이터 분리**: company_domain으로 테넌트 구분

## 기본 계정:

- **이메일**: consil800@gmail.com
- **비밀번호**: password123
- **역할**: master (최고 관리자)

## 주의사항:

- 각 SQL 파일을 순서대로 실행하세요
- 오류가 발생하면 다음 파일로 넘어가지 마세요
- 프로덕션 환경에서는 RLS를 활성화하세요