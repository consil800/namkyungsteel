# 결재 시스템

> 문서 결재 요청 → 승인/반려 워크플로우

## 결재 흐름

```
pending (대기) → approved (승인)
              → rejected (반려) → resubmit (재제출)
```

## 역할별 권한

| 역할 | 요청 | 승인 | 권한관리 |
|------|:---:|:---:|:---:|
| master/CEO/admin | O | O | O |
| manager | O | O | X |
| employee | O | X | X |

## 주요 RPC

| 함수 | 설명 |
|------|------|
| `verify_approval_permission()` | 승인 권한 검증 |
| `process_document_approval()` | 승인 처리 |
| `process_document_rejection()` | 반려 처리 |
| `resubmit_document()` | 재제출 |

## 관련 파일

| 파일 | 역할 |
|------|------|
| approval-review.html | 결재 검토 UI |
| document-permissions.html | 문서 권한 관리 |
| sql/05_approval_security_rpc.sql | RPC 함수 |

## 테이블

| 테이블 | 용도 |
|--------|------|
| document_requests | 결재 요청 문서 |
| approval_logs | 결재 이력 |

---
*최종 업데이트: 2026-01-12*
