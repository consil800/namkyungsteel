# 업체 관계도 기능

> D3.js 기반 업체 간 관계 시각화

## 사용자 플로우

```
1. company-detail.html → "업체 관계도" 버튼
2. 중심 업체 노드 + 기존 관계 자동 로드
3. 업체 추가 → 관계 설정 → 저장
```

## 노드/관계 타입

| 노드 | 색상 | 설명 |
|------|------|------|
| center | 빨강 | 중심 업체 |
| registered | 파랑 | DB 등록 업체 |
| unregistered | 회색 | 임시 업체 |

| 관계 | 방향 |
|------|------|
| 납품/매입 | 단방향 |
| 자회사/모회사 | 단방향 |
| 협력사/경쟁사 | 양방향 |

## 데이터베이스

| 테이블 | 용도 |
|--------|------|
| `company_nodes` | 노드 정보 |
| `company_relationships_v2` | 관계 정보 |

| RPC 함수 | 용도 |
|----------|------|
| `get_company_graph_1hop` | 직접 연결 조회 |
| `get_company_graph_2hop` | 2단계 연결 조회 |

## 관련 파일

| 파일 | 역할 |
|------|------|
| company-network.html | 관계도 UI |
| company-network.js | D3.js 렌더링 |
| database.js | saveCompanyNetworkV2, getCompanyGraphV2 |

---
*최종 업데이트: 2026-01-12*
