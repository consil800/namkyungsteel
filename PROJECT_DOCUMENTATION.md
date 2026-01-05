# 남경철강 업무일지 시스템

> 철강 영업팀을 위한 고객 관리 및 방문 스케줄 최적화 시스템

## 접속 정보

- **URL**: https://namkyungsteel.com
- **버전**: v6.1 (스케줄 알고리즘)
- **최종 업데이트**: 2026-01-05

## 핵심 기능

| 기능 | 설명 |
|------|------|
| 업체 관리 | 고객사 등록/수정, 8색상 분류, PDF 첨부 |
| 업무일지 | 방문 기록 작성, 통계 자동 계산 |
| 스케줄 생성 | AI 기반 방문 순서 최적화 |
| 관계도 | D3.js 기반 업체 간 관계 시각화 |

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Backend | Supabase (PostgreSQL) |
| 인증 | Kakao OAuth 2.0 |
| 지도/경로 | Kakao Maps API |
| 배포 | GitHub Pages |

## 주요 페이지

| 페이지 | 파일 | 용도 |
|--------|------|------|
| 업체 목록 | worklog.html | 검색/필터/조회 |
| 업체 상세 | company-detail.html | 정보 편집, PDF |
| 스케줄 생성 | schedule-generator.html | 방문 순서 최적화 |
| 관계도 | company-network.html | 업체 관계 시각화 |
| 설정 | settings.html | 드롭다운/색상 관리 |

## 관련 문서

| 문서 | 내용 |
|------|------|
| [SCHEDULE_ALGORITHM.md](./SCHEDULE_ALGORITHM.md) | 스케줄 생성 알고리즘 v6.1 상세 |

---
*남경철강 업무일지 시스템*
