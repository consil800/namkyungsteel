# 남경철강 업무일지 시스템

> 철강 영업팀을 위한 고객 관리 및 방문 스케줄 최적화 시스템

## 접속 정보

| 항목 | 값 |
|------|-----|
| URL | https://namkyungsteel.com |
| Backend | Supabase (PostgreSQL) |
| 인증 | Kakao OAuth 2.0 |
| 배포 | GitHub Pages |

## 핵심 기능

| 기능 | 설명 | 파일 |
|------|------|------|
| 업체 관리 | 등록/수정, 8색상 분류, PDF 첨부 | worklog.html, company-detail.html |
| 업무일지 | 방문 기록 작성, 통계 계산 | work-log.html, work-log-entry.html |
| **스케줄 생성** | AI 기반 방문 순서 최적화 | schedule-generator.html |
| 관계도 | D3.js 업체 간 관계 시각화 | company-network.html |
| 설정 | 드롭다운/색상 관리 | settings.html |

## 프로젝트 구조

```
namkyungst/
├── index.html              # 메인 페이지
├── worklog.html            # 업체 목록
├── company-detail.html     # 업체 상세
├── schedule-generator.html # 스케줄 생성기
├── schedule-generator.js   # 스케줄 알고리즘 (v6.1)
├── company-network.html    # 관계도
├── settings.html           # 설정
├── database.js             # Supabase 연동
└── sql/                    # DB 스키마
    └── create_visit_schedule_plans.sql
```

## 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Backend**: Supabase (PostgreSQL)
- **지도/경로**: Kakao Maps API
- **시각화**: D3.js

## 상세 문서

| 문서 | 내용 |
|------|------|
| [SCHEDULE_ALGORITHM.md](./SCHEDULE_ALGORITHM.md) | 스케줄 생성 알고리즘 상세 |

---
*최종 업데이트: 2026-01-05*
