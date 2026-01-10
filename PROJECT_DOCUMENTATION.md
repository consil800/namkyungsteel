# 남경철강 업무일지 시스템

> 철강 영업팀 고객 관리 및 방문 스케줄 최적화 시스템

## 접속 정보

| 항목 | 값 |
|------|-----|
| URL | https://namkyungsteel.com |
| GitHub | https://github.com/consil800/namkyungsteel |
| Backend | Supabase (PostgreSQL) |
| 인증 | Kakao OAuth 2.0 |

## 핵심 기능

| 기능 | 설명 | 상세 문서 |
|------|------|-----------|
| 업체 관리 | 등록/수정, 8색상 분류, PDF 첨부 | [DATABASE_FIELD_MAPPING.md](./DATABASE_FIELD_MAPPING.md) |
| PDF 자동입력 | CRETOP PDF 드래그앤드롭 → 폼 자동입력 | [PDF_FEATURE.md](./PDF_FEATURE.md) |
| 업무일지 | 방문 기록 작성/통계 | - |
| 스케줄 생성 | AI 기반 방문 순서 최적화 (TSP) + 업체 고정 배정 | [SCHEDULE_ALGORITHM.md](./SCHEDULE_ALGORITHM.md) |
| 업체 관계도 | D3.js 업체 간 관계 시각화 | [COMPANY_NETWORK.md](./COMPANY_NETWORK.md) |

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Backend | Supabase (PostgreSQL + RLS) |
| 지도 | Kakao Maps API |
| 시각화 | D3.js |
| PDF | PDF.js |

## 프로젝트 구조

```
namkyungst/
├── index.html              # 메인 페이지
├── worklog.html            # 업체 목록
├── company-register.html   # 업체 등록 (PDF 드롭존)
├── company-detail.html     # 업체 상세
├── schedule-generator.html # 스케줄 생성기
├── company-network.html    # 업체 관계도
├── database.js             # Supabase 연동
├── company-network.js      # 관계도 로직
└── sql/                    # DB 스키마
    ├── 01_DDL_unified_graph.sql  # 관계도 테이블
    ├── 03_RLS_policies.sql       # RLS 정책
    └── 04_RPC_functions.sql      # RPC 함수
```

## 상세 문서 목록

| 문서 | 내용 |
|------|------|
| [DATABASE_FIELD_MAPPING.md](./DATABASE_FIELD_MAPPING.md) | DB-HTML-JS 필드 매핑, 색상 코드 |
| [SCHEDULE_ALGORITHM.md](./SCHEDULE_ALGORITHM.md) | 스케줄 생성 알고리즘 (우선순위, TSP) |
| [PDF_FEATURE.md](./PDF_FEATURE.md) | PDF 파싱 기능 (정규식, 중복체크) |
| [COMPANY_NETWORK.md](./COMPANY_NETWORK.md) | 업체 관계도 기능 (D3.js, RPC) |

---
*최종 업데이트: 2026-01-10*
