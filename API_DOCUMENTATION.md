# API 문서 📚

## JavaScript API 함수들

### 🔧 데이터베이스 관리자 (DatabaseManager)

#### 초기화 및 연결
```javascript
const db = new DatabaseManager();
await db.init();
```

#### 업체 관리
```javascript
// 업체 목록 조회
const companies = await db.getClientCompanies(userId);

// 업체 생성
const result = await db.createClientCompany(companyData);

// 업체 수정
const result = await db.updateClientCompany(companyId, updateData);

// 업체 삭제
const result = await db.deleteClientCompany(companyId);
```

#### 업무일지 관리
```javascript
// 업무일지 조회
const workLogs = await db.getWorkLogsByCompany(companyId, userId);

// 업무일지 생성
const result = await db.createWorkLog(workLogData);

// 업무일지 삭제
const result = await db.deleteWorkLog(companyId, workLogId);
```

#### 사용자 설정 관리
```javascript
// 설정 조회
const settings = await db.getUserSettings(userId);

// 설정 추가
const result = await db.addUserSetting(userId, type, value, displayName, colorValue, colorMeaning);

// 설정 삭제
const result = await db.deleteUserSetting(userId, type, value);
```

### 🎨 색상 관리 함수들

#### 색상 변환
```javascript
// 한글 색상을 영어로 변환
const englishColor = convertColorCode('빨강'); // 'red'

// 색상 코드로 색상값 가져오기
const colorValue = getColorValue('red'); // '#e74c3c'

// 색상 이름 가져오기
const colorName = getColorName('red'); // '빨강'
```

#### 색상 설정
```javascript
// 색상 미리보기 업데이트
updateColorPreview();

// 색상 추가 확인
await confirmAddColor();

// 색상 의미 수정
await editColorMeaning(colorName, currentMeaning);
```

### 📋 데이터 로더 (DataLoader)

#### 안전한 데이터 로딩
```javascript
// 현재 사용자 조회
const user = await window.dataLoader.getCurrentUser();

// 사용자 설정 로드
const settings = await window.dataLoader.loadUserSettings(userId);

// 안전한 엘리먼트 업데이트
window.dataLoader.safeUpdateElement('#elementId', content);

// 프로필 이미지 생성
const profileHTML = window.dataLoader.createProfileImage(user, size);
```

### 🛡️ 데이터 안정성 관리자

#### 안전한 데이터 로딩
```javascript
// 안전한 데이터 로드
const data = await window.safeLoadData(loadFunction, cacheKey, defaultValue);

// 현재 사용자 안전하게 가져오기
const user = await window.getCurrentUserSafely();

// 캐시 관리
window.clearCachedData(key);
window.clearAllCache();

// 데이터 새로고침
await window.refreshCurrentData();
```

### 📄 PDF 파일 관리

#### PDF 파일 처리
```javascript
// PDF 파일 표시
displayPdfFiles(pdfFiles);

// PDF 파일 보기
viewPdfFile(url);

// PDF 파일 업로드
const uploadedFiles = await uploadPdfFiles(files);

// PDF 파일 삭제
await removePdfFile(filename);
```

## 🔗 주요 이벤트 및 콜백

### 폼 제출 이벤트
```javascript
// 업체 등록 폼
document.getElementById('companyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleCompanySubmit();
});

// 업무일지 폼
document.getElementById('workLogForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleWorkLogSubmit();
});
```

### 검색 및 필터링
```javascript
// 업체 검색
async function handleSearch() {
    const region = document.getElementById('searchRegion').value;
    const companyName = document.getElementById('searchCompany').value;
    
    await filterCompanies(region, companyName);
}

// 검색 상태 저장
function saveSearchState() {
    sessionStorage.setItem('searchState', JSON.stringify(searchState));
}

// 검색 상태 복원
function restoreSearchState() {
    const saved = sessionStorage.getItem('searchState');
    if (saved) {
        searchState = JSON.parse(saved);
    }
}
```

## 🔒 인증 관련 함수

### 사용자 인증
```javascript
// 로그인 상태 확인
const isLoggedIn = AuthManager.isLoggedIn();

// 현재 사용자 정보
const currentUser = AuthManager.getCurrentUser();

// 권한 확인
const hasPermission = AuthManager.hasPermission(action);

// 로그아웃
AuthManager.logout();
```

### RLS 설정
```javascript
// RLS용 사용자 ID 설정
await db.setCurrentUserForRLS();

// 현재 사용자 ID 설정
await db.client.rpc('set_current_user_id', { user_id: userId });
```

## 📊 유틸리티 함수

### 날짜 처리
```javascript
// 날짜 포맷팅
const formattedDate = formatDate(date); // YYYY-MM-DD

// 오늘 날짜
const today = getTodayDate();

// 날짜 비교
const isValid = isDateValid(dateString);
```

### 문자열 처리
```javascript
// 텍스트 대비 색상
const contrastColor = getContrastColor('#ff0000');

// 안전한 HTML 생성
const safeHTML = escapeHtml(userInput);

// 숫자 포맷팅
const formatted = formatNumber(1234567); // 1,234,567
```

### 파일 처리
```javascript
// 파일 타입 검증
const isValidFile = validateFileType(file, allowedTypes);

// 파일 크기 체크
const isSizeOK = checkFileSize(file, maxSize);

// 파일명 정리
const cleanName = sanitizeFileName(filename);
```

## 🚨 에러 처리

### 에러 핸들링
```javascript
try {
    const result = await someAsyncOperation();
} catch (error) {
    console.error('작업 실패:', error);
    
    // 사용자 친화적 에러 메시지 표시
    if (error.code === '23505') {
        alert('이미 존재하는 데이터입니다.');
    } else {
        alert('작업 중 오류가 발생했습니다.');
    }
}
```

### 데이터 검증
```javascript
// 필수 필드 검증
function validateRequired(data, requiredFields) {
    for (const field of requiredFields) {
        if (!data[field] || data[field].trim() === '') {
            throw new Error(`${field}는 필수 입력 항목입니다.`);
        }
    }
}

// 이메일 검증
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
```

## 🔄 상태 관리

### 로딩 상태
```javascript
// 로딩 시작
function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'block';
}

// 로딩 완료
function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

// 로딩 상태로 비동기 작업 실행
async function withLoading(asyncFunction) {
    showLoading();
    try {
        return await asyncFunction();
    } finally {
        hideLoading();
    }
}
```

---
*API 문서는 개발 과정에서 지속적으로 업데이트됩니다.*