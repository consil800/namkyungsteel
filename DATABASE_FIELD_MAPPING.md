# 데이터베이스 필드 매핑 문서

> **최종 업데이트**: 2026-01-06
> **테이블명**: `client_companies`

## 필드 매핑 테이블

| DB 컬럼명 | HTML form name | JS 변수명 | 데이터 타입 | 필수 | 설명 |
|-----------|----------------|-----------|-------------|------|------|
| `id` | - | - | BIGINT (자동생성) | ✅ | 기본키 |
| `user_id` | - | `currentUser.id` | VARCHAR | ✅ | 사용자 ID |
| `company_name` | `companyName` | `companyData.company_name` | VARCHAR(200) | ✅ | 업체명 |
| `business_no` | `businessNo` | `companyData.business_no` | VARCHAR(20) | ❌ | 사업자번호 (000-00-00000) |
| `region` | `region` | `companyData.region` | VARCHAR(100) | ✅ | 지역 |
| `address` | `address` | `companyData.address` | TEXT | ❌ | 주소 |
| `phone` | `phone` | `companyData.phone` | VARCHAR(50) | ❌ | 전화번호 |
| `contact_person` | `contactPerson` | `companyData.contact_person` | VARCHAR(100) | ❌ | 담당자명 |
| `mobile` | `mobile` | `companyData.mobile` | VARCHAR(50) | ❌ | 휴대폰 |
| `email` | `email` | `companyData.email` | VARCHAR(200) | ❌ | 이메일 |
| `payment_terms` | `paymentTerms` | `companyData.payment_terms` | VARCHAR(100) | ❌ | 결제조건 |
| `debt_amount` | `debtAmount` | `companyData.debt_amount` | VARCHAR | ❌ | 채권금액 |
| `business_type` | `businessType` | `companyData.business_type` | VARCHAR(100) | ❌ | 업종 |
| `products` | `products` | `companyData.products` | TEXT | ❌ | 제조품 |
| `usage_items` | `usageItems` | `companyData.usage_items` | TEXT | ❌ | 사용품목 |
| `notes` | `notes` | `companyData.notes` | TEXT | ❌ | 비고 |
| `color_code` | `companyColor` | `companyData.color_code` | VARCHAR(10) | ❌ | 업체 색상 (기본값: blue) |
| `visit_count` | - | `companyData.visit_count` | INTEGER | ❌ | 방문횟수 (기본값: 0) |
| `last_visit_date` | - | `companyData.last_visit_date` | DATE | ❌ | 최근방문일 |
| `company_domain` | - | `companyData.company_domain` | VARCHAR(100) | ❌ | 회사도메인 |
| `pdf_files` | - | - | JSONB | ❌ | PDF 파일 정보 |
| `lat` | - | - | DOUBLE | ❌ | 위도 |
| `lng` | - | - | DOUBLE | ❌ | 경도 |
| `geocoded_at` | - | - | TIMESTAMPTZ | ❌ | 지오코딩 시간 |
| `created_at` | - | - | TIMESTAMPTZ | ❌ | 생성일시 (자동) |
| `updated_at` | - | - | TIMESTAMPTZ | ❌ | 수정일시 (자동) |

## 네이밍 규칙

### 변환 규칙
- **DB 컬럼**: `snake_case` (예: `company_name`, `business_no`)
- **HTML form**: `camelCase` (예: `companyName`, `businessNo`)
- **JS 객체**: `snake_case` (DB와 동일하게 매핑)

### 예시
```javascript
// HTML form에서 가져오기
const formData = new FormData(form);

// DB 컬럼명으로 매핑
const companyData = {
    company_name: formData.get('companyName'),    // camelCase → snake_case
    business_no: formData.get('businessNo'),       // camelCase → snake_case
    contact_person: formData.get('contactPerson'), // camelCase → snake_case
};
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `company-register.html` | 업체 등록 폼 (HTML) |
| `company-register.js` | 업체 등록 로직 (JS) |
| `company-detail.js` | 업체 상세/수정 로직 |
| `01_core_tables.sql` | 테이블 스키마 정의 |
| `10_add_business_no_column.sql` | business_no 컬럼 추가 |

## 수정 시 체크리스트

새 필드 추가 시:
1. [ ] DB에 컬럼 추가 (ALTER TABLE)
2. [ ] `company-register.html`에 form 필드 추가
3. [ ] `company-register.js`의 `companyData` 객체에 매핑 추가
4. [ ] `company-detail.html`에 표시/수정 필드 추가
5. [ ] `company-detail.js`에 로직 추가
6. [ ] 이 문서 업데이트

## PDF 파싱 필드 매핑 (CRETOP)

| PDF 항목 | 파싱 변수 | DB 컬럼 |
|----------|-----------|---------|
| 기업명 | `parsed.companyName` | `company_name` |
| 사업자번호 | `parsed.businessNo` | `business_no` |
| 주소 | `parsed.address` | `address` |
| 지역 | `parsed.region` | `region` |
| 전화번호 | `parsed.phone` | `phone` |

## 색상 코드 값

| 색상명 | color_code 값 | 표시색 |
|--------|---------------|--------|
| 빨강 | `red` | #e74c3c |
| 주황 | `orange` | #f39c12 |
| 노랑 | `yellow` | #f1c40f |
| 초록 | `green` | #27ae60 |
| 하늘 | `sky` | #87ceeb |
| 파랑 | `blue` | #3498db |
| 보라 | `purple` | #9b59b6 |
| 회색 | `gray` | #95a5a6 |

---
*이 문서는 데이터베이스와 코드 간의 필드 매핑을 관리하기 위한 참조 문서입니다.*
