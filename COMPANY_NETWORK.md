# 업체 관계도 기능

> D3.js 기반 업체 간 관계 시각화

## 개요

업체들 간의 납품/매입/협력 관계를 네트워크 그래프로 시각화합니다.

## 사용자 플로우

```
1. company-detail.html → "업체 관계도" 버튼 클릭
2. company-network.html?id={업체ID} 로 이동
3. 중심 업체 노드 + 기존 관계 자동 로드
4. 업체 추가 → 관계 설정 → 저장
```

## 노드 타입

| 타입 | 색상 | 설명 |
|------|------|------|
| center | 빨강 (#e74c3c) | 중심 업체 |
| registered | 파랑 (#3498db) | DB 등록 업체 |
| unregistered | 회색 (#95a5a6) | 임시 업체 |

## 관계 타입

| 관계 | 방향 | 설명 |
|------|------|------|
| 납품 | 단방향 | A → B 납품 |
| 매입 | 단방향 | A ← B 매입 |
| 자회사 | 단방향 | A의 자회사 B |
| 모회사 | 단방향 | A의 모회사 B |
| 협력사 | 양방향 | 협력 관계 |
| 경쟁사 | 양방향 | 경쟁 관계 |
| 기타 | 사용자 정의 | 직접 입력 |

## 데이터베이스 구조

### 테이블

```sql
-- 노드 테이블
company_nodes (
    id UUID PRIMARY KEY,
    user_id TEXT,
    is_registered BOOLEAN,
    company_id BIGINT,          -- 등록 업체 FK
    display_name TEXT,          -- 표시명
    display_name_norm TEXT      -- 정규화 (소문자)
)

-- 관계 테이블
company_relationships_v2 (
    id UUID PRIMARY KEY,
    user_id TEXT,
    from_node_id UUID,
    to_node_id UUID,
    relationship_type TEXT,
    directed BOOLEAN DEFAULT true,
    strength INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active'
)
```

### RPC 함수

| 함수 | 설명 |
|------|------|
| `get_company_graph_1hop` | 직접 연결된 업체만 조회 |
| `get_company_graph_2hop` | 2단계 연결까지 조회 |
| `resolve_center_node_id` | 중심 노드 UUID 조회 |

## 핵심 로직

### 노드 ID 규칙

```javascript
// 중심 업체: company_{id} 형식
centerNode.id = `company_${centerCompany.id}`;

// 일반 업체: 업체명 사용
otherNode.id = node.name;
```

### D3 포맷 변환 (loadExistingNetwork)

```javascript
// 중심 노드 판별: centerNodeId와 비교
const isCenter = node.id === graphData.centerNodeId;

// 링크 source/target 매핑
const sourceId = sourceIsCenter ? `company_${centerCompany.id}` : sourceNode.name;
const targetId = targetIsCenter ? `company_${centerCompany.id}` : targetNode.name;
```

### 엣지 저장 (Partial Unique Index 대응)

```javascript
// upsert 대신 select → insert/update 패턴
if (existingEdge) {
    await client.update(...);
} else {
    await client.insert(...);
}
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| company-network.html | 관계도 UI |
| company-network.js | D3.js 렌더링, 이벤트 |
| database.js | saveCompanyNetworkV2, getCompanyGraphV2 |
| sql/01_DDL_unified_graph.sql | 테이블 스키마 |
| sql/03_RLS_policies.sql | Row Level Security |
| sql/04_RPC_functions.sql | 그래프 조회 함수 |

## 버전 히스토리

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2026-01-08 | v2 | 통합 그래프 구조, RPC 함수 도입 |
| 2026-01-08 | v2.1 | D3 노드 ID 매핑 버그 수정 |

---
*최종 업데이트: 2026-01-08*
