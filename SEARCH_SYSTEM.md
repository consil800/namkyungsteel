# 통합 검색 시스템

> 거래처, 업무일지, 문서, 담당자 전체 검색

## 검색 대상

| 소스 | 테이블 | 검색 필드 |
|------|--------|-----------|
| 업체 | client_companies | 업체명, 주소, 담당자 |
| 업무일지 | work_logs | 작업 내용, 날짜 |
| 문서 | document_requests | 제목, 내용 |
| 사용자 | users | 이름, 부서, 이메일 |

## 검색 기술

| 기술 | 용도 |
|------|------|
| FTS (Full-Text Search) | 전체 텍스트 검색 |
| Trigram (pg_trgm) | 한글 부분 매칭 |
| ILIKE | 보조 검색 |

## 주요 RPC

| 함수 | 설명 |
|------|------|
| `unified_search()` | 통합 검색 |
| `search_autocomplete()` | 자동완성 (2글자 이상) |
| `rebuild_search_index()` | 인덱스 재구축 |

## 관련 파일

| 파일 | 역할 |
|------|------|
| search.html | 검색 UI |
| search-utils.js | 클라이언트 모듈 |
| sql/06_unified_search.sql | RPC + 인덱스 |

---
*최종 업데이트: 2026-01-12*
