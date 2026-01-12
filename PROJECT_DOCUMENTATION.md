# 남경철강 업무일지 시스템

> 철강 영업팀 고객 관리, 방문 스케줄 최적화, 결재 시스템

## 접속 정보

| 항목 | 값 |
|------|-----|
| URL | https://namkyungsteel.com |
| GitHub | https://github.com/consil800/namkyungsteel |
| Backend | Supabase (PostgreSQL + RLS) |
| 인증 | Kakao OAuth 2.0 |

## 핵심 기능

| 기능 | 설명 | 상세 문서 |
|------|------|-----------|
| **업체 관리** | 등록/수정, 8색상 분류, PDF 첨부 | [DATABASE_FIELD_MAPPING.md](./DATABASE_FIELD_MAPPING.md) |
| **PDF 자동입력** | CRETOP PDF → 폼 자동입력 | [PDF_FEATURE.md](./PDF_FEATURE.md) |
| **스케줄 생성** | TSP 경로 최적화 + 업체 고정 배정 + 같은 지역 우선 | [SCHEDULE_ALGORITHM.md](./SCHEDULE_ALGORITHM.md) |
| **업체 관계도** | D3.js 네트워크 시각화 | [COMPANY_NETWORK.md](./COMPANY_NETWORK.md) |
| **결재 시스템** | 문서 권한 관리 + 결재 승인/반려 | [APPROVAL_SYSTEM.md](./APPROVAL_SYSTEM.md) |
| **통합 검색** | 거래처/업무일지/담당자 전체 검색 | [SEARCH_SYSTEM.md](./SEARCH_SYSTEM.md) |
| **사용자 승인** | 역할 기반 사용자 가입 승인 | [USER_APPROVAL_SYSTEM.md](./USER_APPROVAL_SYSTEM.md) |

## 사용자 역할

| 역할 | 권한 |
|------|------|
| `admin` | 전체 관리, 사용자 승인, 결재 최종 승인 |
| `manager` | 결재 승인, 직원 대시보드 조회 |
| `employee` | 업무일지 작성, 자기 결재 요청 |

## 주요 페이지

| 페이지 | 파일 | 설명 |
|--------|------|------|
| 메인 | index.html | 로그인/대시보드 |
| 업무일지 | worklog.html | 일지 목록/작성 |
| 업체 등록 | company-register.html | 신규 업체 + PDF 파싱 |
| 업체 상세 | company-detail.html | 업체 수정/삭제 |
| 스케줄 생성 | schedule-generator.html | 방문 스케줄 최적화 |
| 업체 관계도 | company-network.html | D3.js 관계 시각화 |
| 결재 검토 | approval-review.html | 결재 승인/반려 |
| 문서 권한 | document-permissions.html | 문서별 접근 권한 |
| 통합 검색 | search.html | 전체 검색 |
| 직원 대시보드 | employee-dashboard.html | 직원별 영업 현황 |

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Backend | Supabase (PostgreSQL + RLS + Triggers) |
| 지도 | Kakao Maps API |
| 시각화 | D3.js |
| PDF | PDF.js |
| 검색 | PostgreSQL Full-Text Search + Trigram |

## 데이터베이스 스키마

```
핵심 테이블:
├── users                 # 사용자 (role: admin/manager/employee)
├── client_companies      # 거래처
├── work_logs             # 업무일지
├── company_relationships # 업체 관계
├── approval_requests     # 결재 요청
├── document_permissions  # 문서 권한
└── search_unified        # 통합 검색 뷰
```

---
*최종 업데이트: 2026-01-12*
