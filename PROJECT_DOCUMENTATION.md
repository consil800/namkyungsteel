# 남경철강 업무일지 시스템

> 철강 영업팀을 위한 고객 관리, 업무일지, 스케줄 생성 웹 시스템

## 핵심 기능

| 기능 | 설명 |
|------|------|
| 업체 관리 | 고객사 등록/수정/삭제, 8색상 분류, 관계도 시각화 |
| 스마트 검색 | 지역/업체명/색상 필터링, 정렬 |
| 업무일지 | 방문 기록, 통계 자동 계산 |
| 파일 관리 | PDF 업로드, 엑셀 가져오기/내보내기 |
| 스케줄 생성 | 지역별 업체 방문 순서 최적화, 경로 알고리즘 |
| 권한 관리 | 다중 사용자, RLS 보안 |

## 기술 스택

```
Frontend     : HTML5, CSS3, JavaScript ES6+
Backend      : Supabase (PostgreSQL)
인증          : Kakao OAuth 2.0
지도/경로     : Google Maps API, Nominatim (OpenStreetMap)
시각화        : D3.js (관계도 네트워크)
배포          : GitHub Pages
```

## 시스템 구조

```
┌─────────────────────────────────────────────────────────┐
│                    클라이언트 (Frontend)                  │
│  HTML Pages → JS Modules → Database API → Cache Layer   │
└─────────────────────────────────────────────────────────┘
                          ↕ HTTPS
┌─────────────────────────────────────────────────────────┐
│                    백엔드 (Supabase)                      │
│  PostgreSQL → Storage → Kakao OAuth → RLS Security      │
└─────────────────────────────────────────────────────────┘
```

## 주요 페이지

| 페이지 | 파일 | 용도 |
|--------|------|------|
| 업체 목록 | worklog.html | 업체 검색/조회/관리 |
| 업체 상세 | company-detail.html | 업체 정보 편집, PDF 관리 |
| 업체 등록 | company-register.html | 새 업체 등록 |
| 업무일지 | work-log-entry.html | 방문 기록 작성 |
| 관계도 | company-network.html | 업체 간 관계 시각화 |
| 스케줄 생성 | schedule-generator.html | 방문 순서 최적화 |
| 설정 | settings.html | 드롭다운/색상 관리 |
| 대시보드 | employee-dashboard.html | 활동 통계 |

## 접속 정보

- **URL**: https://namkyungsteel.com
- **버전**: v13.7.2
- **최종 업데이트**: 2026-01-03

## 문서 목록

| 문서 | 용도 |
|------|------|
| [USER_GUIDE.md](USER_GUIDE.md) | 사용자 가이드 (전체 기능, 관계도 포함) |
| [DATABASE_DESIGN.md](DATABASE_DESIGN.md) | DB 테이블 설계 |
| [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) | 개발 환경, 보안, 배포 가이드 |
| [CHANGELOG.md](CHANGELOG.md) | 변경 이력 |

---
*남경철강 업무일지 시스템 v13.7.2*
