# 데이터베이스 필드 매핑

> 테이블: `client_companies`

## 필드 매핑

| DB 컬럼 | HTML name | 데이터 타입 | 설명 |
|---------|-----------|-------------|------|
| `id` | - | BIGINT | 기본키 (자동생성) |
| `user_id` | - | VARCHAR | 사용자 ID |
| `company_name` | `companyName` | VARCHAR(200) | 업체명 (필수) |
| `business_no` | `businessNo` | VARCHAR(20) | 사업자번호 |
| `region` | `region` | VARCHAR(100) | 지역 (필수) |
| `address` | `address` | TEXT | 주소 |
| `phone` | `phone` | VARCHAR(50) | 전화번호 |
| `contact_person` | `contactPerson` | VARCHAR(100) | 담당자 |
| `mobile` | `mobile` | VARCHAR(50) | 휴대폰 |
| `email` | `email` | VARCHAR(200) | 이메일 |
| `payment_terms` | `paymentTerms` | VARCHAR(100) | 결제조건 |
| `debt_amount` | `debtAmount` | VARCHAR | 채권금액 |
| `business_type` | `businessType` | VARCHAR(100) | 업종 |
| `products` | `products` | TEXT | 제조품 |
| `usage_items` | `usageItems` | TEXT | 사용품목 |
| `notes` | `notes` | TEXT | 비고 |
| `color_code` | `companyColor` | VARCHAR(10) | 색상 코드 |
| `visit_count` | - | INTEGER | 방문횟수 |
| `last_visit_date` | - | DATE | 최근방문일 |
| `lat`, `lng` | - | DOUBLE | 좌표 |
| `pdf_files` | - | JSONB | PDF 정보 |

## 네이밍 규칙

- **DB**: `snake_case` (company_name)
- **HTML**: `camelCase` (companyName)
- **JS**: DB와 동일 (`snake_case`)

## 색상 코드

| 색상 | 값 | HEX |
|------|-----|-----|
| 빨강 | `red` | #e74c3c |
| 주황 | `orange` | #f39c12 |
| 노랑 | `yellow` | #f1c40f |
| 초록 | `green` | #27ae60 |
| 하늘 | `sky` | #87ceeb |
| 파랑 | `blue` | #3498db |
| 보라 | `purple` | #9b59b6 |
| 회색 | `gray` | #95a5a6 |

---
*최종 업데이트: 2026-01-12*
