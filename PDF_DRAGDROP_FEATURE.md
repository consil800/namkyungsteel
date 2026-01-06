# PDF 드래그앤드롭 자동입력 기능 설계 문서

> company-register.html에 CRETOP PDF 드래그앤드롭 → 업체정보 자동입력 기능

## 1. 개요

### 1.1 목적
- 크레탑(CRETOP) 신용조사리포트 PDF에서 업체 정보를 자동 추출
- 업체 등록 폼에 자동 입력하여 수작업 시간 단축
- PDF 파일을 Supabase Storage에 저장하여 나중에 조회 가능
- **사업자번호 중복 체크**로 중복 업체 등록 방지

### 1.2 사용자 플로우
```
1. company-register.html 접속
2. PDF 드래그앤드롭 영역에 CRETOP PDF 드롭
3. 텍스트 추출 및 파싱 진행 (로딩 표시)
4. 파싱 결과 미리보기 표시 (업체명, 사업자번호, 지역, 주소, 전화번호)
5. "적용" 버튼 클릭 → 폼 필드에 자동 입력
6. 사업자번호 입력 시 → blur 이벤트로 중복 체크
   - 중복 시: alert('중복입니다') + 등록 버튼 비활성화
   - 미중복: 등록 버튼 활성화
7. 사용자가 내용 확인/수정 후 "등록" 버튼 클릭
8. 제출 직전 사업자번호 재검증 (레이스 컨디션 방지)
9. 업체 정보 + PDF 파일 함께 저장
10. company-detail.html에서 PDF 파일 + 사업자번호 조회 가능
```

## 2. 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| PDF 텍스트 추출 | **PDF.js** (mozilla/pdf.js) | 브라우저 표준, 텍스트 레이어 추출 가능 |
| 파싱 방식 | 라벨 앵커 + 정규식 | 단순 패턴보다 정확도 높음 |
| 파일 저장 | Supabase Storage | 기존 인프라 활용 |
| OCR | 미지원 (v1) | 스캔 PDF는 추후 버전에서 지원 |

## 3. 파일 구조

```
namkyungst/
├── company-register.html      # 드롭존 UI 추가
├── company-register.js        # 폼 자동입력 로직 추가
├── js/
│   └── pdf/
│       ├── pdf-dropzone.js       # 드래그앤드롭 UI + 파일 검증
│       ├── pdf-text-extractor.js # PDF.js 텍스트 추출
│       └── cretop-parser.js      # CRETOP 전용 파서
└── company-detail.js          # PDF 표시 (기존 함수 활용)
```

## 4. CRETOP PDF 파싱 규칙

### 4.1 추출 대상 필드

| 필드명 | DB 컬럼 | 파싱 라벨 | 후처리 |
|--------|---------|-----------|--------|
| 업체명 | company_name | 기업명, 회사명, 상호, 법인명 | (주) 제거 옵션 |
| **사업자번호** | **business_no** | **사업자등록번호, 사업자번호** | **숫자만 10자리로 정규화** |
| 지역 | region | 주소에서 추출 | 시/도 + 시/군/구 |
| 주소 | address | 소재지, 주소, 본사소재지 | 우편번호/동리명 제거 옵션 |
| 전화번호 | phone | 대표전화, 전화번호, TEL | 하이픈 정규화 |

### 4.2 정규식 패턴

```javascript
// 업체명
const COMPANY_NAME_PATTERN = /(기업명|회사명|상호|법인명)\s*[:：]?\s*([^\n]{2,40})/;

// 사업자번호 (라벨 기반)
const BUSINESS_NO_PATTERN = /(사업자등록번호|사업자번호)\s*[:：]?\s*(\d{3}-?\d{2}-?\d{5})/;

// 사업자번호 검증 (하이픈 포함 엄격)
const BUSINESS_NO_STRICT = /^\d{3}-\d{2}-\d{5}$/;

// 사업자번호 검증 (하이픈 유무 허용)
const BUSINESS_NO_FLEXIBLE = /^\d{3}-?\d{2}-?\d{5}$/;

// 주소 (우편번호 포함)
const ADDRESS_PATTERN = /(소재지|주소|본사소재지)\s*[:：]?\s*([\s\S]{10,120}?)(?=(전화|TEL|대표|업종|$))/i;

// 우편번호 추출
const ZIPCODE_PATTERN = /\((\d{5})\)/;

// 전화번호 (라벨 기반)
const PHONE_PATTERN = /(대표전화|전화번호|TEL|Tel)\s*[:：]?\s*(0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4})/;

// 지역 추출 (주소에서)
const REGION_PATTERN = /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s*([가-힣]+시|[가-힣]+군|[가-힣]+구)?/;
```

### 4.3 텍스트 정규화

```javascript
function normalizeText(rawText) {
    return rawText
        .replace(/\s+/g, ' ')           // 연속 공백 → 1칸
        .replace(/\r\n/g, '\n')         // 줄바꿈 통일
        .replace(/[-‐‑–—]/g, '-')       // 하이픈 통일
        .trim();
}
```

### 4.4 후처리 옵션

```javascript
// 업체명에서 (주) 제거
function removeCorpSuffix(name) {
    return name.replace(/\(주\)|\(유\)|주식회사/g, '').trim();
}

// 사업자번호 정규화 (숫자만 10자리)
function normalizeBusinessNo(input) {
    const digitsOnly = input.replace(/\D/g, '');
    if (digitsOnly.length !== 10) return null;
    return digitsOnly; // DB 저장용: 1234567890
}

// 사업자번호 포맷 (표시용)
function formatBusinessNo(digitsOnly) {
    if (!digitsOnly || digitsOnly.length !== 10) return '';
    return `${digitsOnly.slice(0,3)}-${digitsOnly.slice(3,5)}-${digitsOnly.slice(5)}`;
    // 결과: 123-45-67890
}

// 주소에서 우편번호, 동리명 제거
function cleanAddress(address) {
    return address
        .replace(/\(\d{5}\)\s*/, '')    // (38208) 제거
        .replace(/\([가-힣]+리?\)\s*$/, '') // (모화리) 제거
        .trim();
}

// 지역에서 '시' 제거 (드롭다운 매칭용)
function extractRegion(address) {
    const match = address.match(REGION_PATTERN);
    if (match) {
        let region = match[2] || '';
        return region.replace(/시$/, ''); // 경주시 → 경주
    }
    return '';
}
```

## 5. UI 설계

### 5.1 드롭존 컴포넌트

```html
<!-- company-register.html에 추가 -->
<div id="pdfDropzone" class="pdf-dropzone">
    <div class="dropzone-icon">📄</div>
    <div class="dropzone-text">
        CRETOP PDF 파일을 여기에 드래그하거나<br>
        <label class="dropzone-browse">
            파일 선택
            <input type="file" id="pdfFileInput" accept=".pdf" hidden>
        </label>
    </div>
    <div id="dropzoneStatus" class="dropzone-status hidden"></div>
</div>

<!-- 파싱 결과 미리보기 -->
<div id="parsePreview" class="parse-preview hidden">
    <h4>추출된 정보</h4>
    <table class="preview-table">
        <tr><td>업체명</td><td id="previewCompanyName">-</td></tr>
        <tr><td>사업자번호</td><td id="previewBusinessNo">-</td></tr>
        <tr><td>지역</td><td id="previewRegion">-</td></tr>
        <tr><td>주소</td><td id="previewAddress">-</td></tr>
        <tr><td>전화번호</td><td id="previewPhone">-</td></tr>
    </table>
    <div class="preview-actions">
        <button type="button" id="applyParseBtn" class="btn btn-primary">폼에 적용</button>
        <button type="button" id="cancelParseBtn" class="btn btn-secondary">취소</button>
    </div>
</div>
```

### 5.2 CSS 스타일

```css
.pdf-dropzone {
    border: 2px dashed #ccc;
    border-radius: 8px;
    padding: 30px;
    text-align: center;
    background: #f9f9f9;
    transition: all 0.3s;
    margin-bottom: 20px;
}

.pdf-dropzone.dragover {
    border-color: #007bff;
    background: #e8f4ff;
}

.pdf-dropzone.processing {
    border-color: #ffc107;
    background: #fff8e1;
}

.pdf-dropzone.success {
    border-color: #28a745;
    background: #e8f5e9;
}

.dropzone-icon {
    font-size: 48px;
    margin-bottom: 10px;
}

.dropzone-browse {
    color: #007bff;
    cursor: pointer;
    text-decoration: underline;
}

.parse-preview {
    background: #f0f8ff;
    border: 1px solid #b3d9ff;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;
}

.preview-table {
    width: 100%;
    margin-bottom: 15px;
}

.preview-table td:first-child {
    font-weight: bold;
    width: 80px;
}

/* 사업자번호 중복 상태 스타일 */
.business-no-status {
    font-size: 12px;
    margin-top: 4px;
}
.business-no-status.checking {
    color: #6c757d;
}
.business-no-status.duplicate {
    color: #dc3545;
    font-weight: bold;
}
.business-no-status.available {
    color: #28a745;
}
```

## 5.3 사업자번호 중복 체크 로직

### 중복 체크 방식 (ChatGPT 권장: 하이브리드)

```javascript
// 1. blur 이벤트로 실시간 체크 (UX용)
document.getElementById('businessNo').addEventListener('blur', async function() {
    const businessNo = normalizeBusinessNo(this.value);
    if (!businessNo) return;

    const isDuplicate = await checkBusinessNoDuplicate(businessNo);
    if (isDuplicate) {
        alert('중복입니다');
        document.getElementById('submitBtn').disabled = true;
        showStatus('duplicate', '이미 등록된 사업자번호입니다');
    } else {
        document.getElementById('submitBtn').disabled = false;
        showStatus('available', '등록 가능');
    }
});

// 2. 제출 직전 재검증 (레이스 컨디션 방지)
async function validateBeforeSubmit() {
    const businessNo = normalizeBusinessNo(document.getElementById('businessNo').value);
    if (businessNo) {
        const isDuplicate = await checkBusinessNoDuplicate(businessNo);
        if (isDuplicate) {
            alert('중복입니다');
            return false;
        }
    }
    return true;
}

// Supabase 중복 체크 함수
async function checkBusinessNoDuplicate(businessNo) {
    const { data, error } = await window.db.client
        .from('companies')
        .select('id')
        .eq('business_no', businessNo)
        .limit(1);

    return data && data.length > 0;
}
```

### DB 설정 (필수)

```sql
-- companies 테이블에 사업자번호 컬럼 추가
ALTER TABLE companies ADD COLUMN business_no VARCHAR(10);

-- UNIQUE 인덱스 생성 (중복 방지 + 성능)
CREATE UNIQUE INDEX idx_companies_business_no ON companies(business_no) WHERE business_no IS NOT NULL;
```

## 6. 구현 순서

### Phase 1: DB 스키마 변경
- [ ] companies 테이블에 business_no 컬럼 추가
- [ ] UNIQUE 인덱스 생성

### Phase 2: UI 추가
- [ ] company-register.html에 드롭존 HTML 추가
- [ ] company-register.html에 사업자번호 입력 필드 추가 (업체명 바로 밑)
- [ ] company-detail.html에 사업자번호 표시 추가 (업체명 바로 밑)
- [ ] styles.css에 드롭존 CSS 추가
- [ ] 드래그앤드롭 이벤트 핸들러 구현

### Phase 3: PDF 텍스트 추출
- [ ] PDF.js CDN 추가
- [ ] pdf-text-extractor.js 모듈 구현
- [ ] 페이지별 텍스트 추출 로직

### Phase 4: CRETOP 파서
- [ ] cretop-parser.js 모듈 구현
- [ ] 정규식 패턴 테스트 (업체명, 사업자번호, 주소, 전화번호)
- [ ] 후처리 함수 구현 (사업자번호 정규화 포함)

### Phase 5: 사업자번호 중복 체크
- [ ] blur 이벤트 핸들러 구현
- [ ] checkBusinessNoDuplicate() 함수 구현
- [ ] 제출 직전 재검증 로직 추가
- [ ] 중복 시 등록 버튼 비활성화

### Phase 6: 폼 자동입력
- [ ] 파싱 결과 → 폼 필드 매핑 (사업자번호 포함)
- [ ] 드롭다운 자동 선택 로직

### Phase 7: Storage 저장
- [ ] 기존 uploadPdfFiles() 함수 활용
- [ ] 업체 등록 시 PDF 함께 저장

### Phase 8: 테스트 및 수정
- [ ] 다양한 CRETOP PDF로 테스트
- [ ] 사업자번호 중복 체크 테스트
- [ ] 엣지 케이스 처리

## 7. 주의사항

### 7.1 스캔 PDF 미지원 (v1)
- PDF.js는 텍스트 레이어가 있는 PDF만 추출 가능
- 스캔본(이미지 PDF)은 빈 문자열 반환
- 추출 실패 시 "텍스트 추출 실패. 직접 입력해주세요." 안내

### 7.2 파싱 정확도 한계
- CRETOP PDF 형식이 변경되면 파싱 실패 가능
- 사용자가 반드시 결과 확인 후 적용하도록 UX 설계
- 신뢰도 낮은 필드는 노란 하이라이트 표시

### 7.3 파일 크기 제한
- 클라이언트 PDF 처리는 메모리 사용량 높음
- 10MB 이상 파일은 경고 표시
- 첫 2페이지만 파싱 (대부분의 정보는 첫 페이지에 있음)

### 7.4 기존 기능과의 호환성
- company-detail.js의 uploadPdfFiles(), displayPdfFiles() 함수 재사용
- 기존 company-pdfs Storage 버킷 사용

## 8. 테스트 체크리스트

### PDF 기능
- [ ] PDF 드래그앤드롭 동작 확인
- [ ] 파일 선택 버튼 동작 확인
- [ ] 텍스트 추출 성공 케이스
- [ ] 텍스트 추출 실패 케이스 (스캔 PDF)
- [ ] 파싱 결과 미리보기 표시 (사업자번호 포함)
- [ ] "폼에 적용" 버튼 동작
- [ ] 지역 드롭다운 자동 선택
- [ ] 업체 등록 시 PDF 저장
- [ ] company-detail.html에서 PDF 표시

### 사업자번호 기능
- [ ] 사업자번호 입력 필드 표시 (업체명 밑)
- [ ] 사업자번호 포맷 검증 (xxx-xx-xxxxx)
- [ ] blur 이벤트로 중복 체크 동작
- [ ] 중복 시 alert('중복입니다') 표시
- [ ] 중복 시 등록 버튼 비활성화
- [ ] 미중복 시 등록 버튼 활성화
- [ ] 제출 직전 재검증 동작
- [ ] DB UNIQUE 제약으로 동시 등록 방지
- [ ] company-detail.html에서 사업자번호 표시

---
*작성일: 2026-01-06*
*최종 업데이트: 2026-01-06*
*ChatGPT + Claude 협업 결과*
