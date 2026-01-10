# PDF 드래그앤드롭 자동입력 기능

> CRETOP PDF → 업체정보 자동 추출 및 입력

## 사용자 플로우

```
1. company-register.html 접속
2. PDF 드롭존에 CRETOP PDF 드롭
3. 텍스트 추출 → 파싱 결과 미리보기
4. "적용" 클릭 → 폼 자동입력
5. 사업자번호 blur → 중복 체크
6. "등록" 클릭 → DB 저장 + PDF Storage 저장
```

## 추출 필드

| 필드 | DB 컬럼 | 파싱 라벨 |
|------|---------|-----------|
| 업체명 | company_name | 기업명, 회사명, 상호 |
| 사업자번호 | business_no | 사업자등록번호 |
| 지역 | region | 주소에서 추출 |
| 주소 | address | 소재지, 본사소재지 |
| 전화번호 | phone | 대표전화, TEL |

## 핵심 정규식

```javascript
// 사업자번호
/(사업자등록번호|사업자번호)\s*[:：]?\s*(\d{3}-?\d{2}-?\d{5})/

// 업체명
/(기업명|회사명|상호|법인명)\s*[:：]?\s*([^\n]{2,40})/

// 주소
/(소재지|주소|본사소재지)\s*[:：]?\s*([\s\S]{10,120}?)/

// 전화번호
/(대표전화|전화번호|TEL)\s*[:：]?\s*(0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4})/
```

## 사업자번호 중복 체크

```javascript
// blur 이벤트로 실시간 체크
businessNoInput.addEventListener('blur', checkBusinessNoDuplicate);

// 제출 직전 재검증 (레이스 컨디션 방지)
async function validateBeforeSubmit() { ... }
```

## PDF 파일 저장 형식

```javascript
// client_companies.pdf_files (JSONB)
{
    "filename": "원레이저.pdf",
    "url": "https://...supabase.co/storage/v1/object/public/...",
    "uploadedAt": "2026-01-07T11:25:00.000Z"
}
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| company-register.html | 드롭존 UI |
| company-register.js | PDF 파싱 + 저장 로직 |
| database.js | Supabase 연동 |

## 제한사항

- 스캔 PDF(이미지) 미지원 (텍스트 레이어 필요)
- 10MB 이상 파일 경고
- 첫 2페이지만 파싱

---
*최종 업데이트: 2026-01-08*
