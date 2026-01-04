# 개발 환경 설정 🛠️

## 🚀 빠른 시작

### 필수 요구사항
- **웹 브라우저**: Chrome, Firefox, Safari (최신 버전)
- **HTTP 서버**: Python, Node.js, 또는 Live Server 확장
- **Supabase 계정**: 데이터베이스 및 스토리지용

### 1. 프로젝트 클론
```bash
git clone [repository-url]
cd namkyungst
```

### 2. HTTP 서버 실행
```bash
# Python (권장)
python -m http.server 8000

# Node.js
npx http-server -p 8000

# PHP (대안)
php -S localhost:8000
```

### 3. 브라우저에서 접속
```
http://localhost:8000/index.html
```

## ⚙️ Supabase 설정

### 1. Supabase 프로젝트 생성
1. [Supabase](https://supabase.com) 회원가입
2. 새 프로젝트 생성
3. Project Settings → API → URL, anon key 복사

### 2. 데이터베이스 스키마 설정
SQL 파일들을 순서대로 실행:

```sql
-- 1. 기본 테이블 생성
\i 01_core_tables.sql

-- 2. 인덱스 및 제약조건
\i 02_indexes_and_constraints.sql

-- 3. 보안 및 RLS 정책
\i 03_security_and_rls.sql

-- 4. 초기 데이터
\i 04_initial_data.sql

-- 5. 추가 기능들 (선택)
\i 05_fix_rls_policy_simple.sql
\i 06_emergency_rls_fix.sql
\i 07_document_requests_table.sql
\i 08_color_meaning_column.sql
\i 09_add_pdf_column.sql
```

### 3. Storage 버킷 설정
```sql
-- company-pdfs 버킷 생성
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-pdfs', 'company-pdfs', true);

-- 업로드 정책 설정
CREATE POLICY "Anyone can upload PDF files" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'company-pdfs');

CREATE POLICY "Anyone can view PDF files" ON storage.objects 
FOR SELECT USING (bucket_id = 'company-pdfs');
```

## 🔑 환경 변수 설정

### database.js 설정
```javascript
// Supabase 설정 수정
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### Kakao OAuth 설정 (선택)
```javascript
// 카카오 개발자 콘솔에서 앱 등록 후
window.Kakao.init('YOUR_KAKAO_APP_KEY');
```

## 🧪 로컬 개발 환경

### 1. 포트 설정
기본 포트는 8000 사용:
```bash
# 기본 포트 8000 사용
python -m http.server 8000

# Kakao OAuth를 사용하는 경우 특정 포트 필요 (카카오 개발자 콘솔 등록 포트)
# python -m http.server 5650  # Kakao OAuth 등록된 포트가 5650인 경우만 사용
```

### 2. HTTPS 설정 (프로덕션용)
```bash
# SSL 인증서를 사용한 HTTPS 서버
python -m http.server 8000 --bind 127.0.0.1

# 또는 ngrok 사용
ngrok http 8000
```

### 3. 개발자 도구 설정
```javascript
// 디버깅 모드 활성화
localStorage.setItem('debug', 'true');

// 콘솔 로깅 레벨 설정
window.DEBUG_LEVEL = 'verbose';
```

## 📁 프로젝트 구조 이해

```
namkyungst/
├── 📄 index.html              # 메인 로그인 페이지
├── 📄 worklog.html           # 업체 목록 페이지
├── 📄 company-detail.html    # 업체 상세 페이지
├── 📄 company-register.html  # 업체 등록 페이지
├── 📄 work-log-entry.html   # 업무일지 작성
├── 📄 settings.html          # 사용자 설정
├── 📄 employee-dashboard.html # 직원 대시보드
│
├── 📜 database.js            # 데이터베이스 매니저
├── 📜 data-loader.js         # 데이터 로더
├── 📜 data-stability.js      # 안정성 관리자
├── 📜 company-detail.js      # 업체 상세 로직
├── 📜 settings.js            # 설정 페이지 로직
├── 📜 main.js                # 공통 메인 로직
│
├── 📁 shared-assets/         # 공통 자산
│   ├── 📁 css/              # 스타일시트
│   ├── 📁 js/               # 공통 스크립트
│   └── 📁 images/           # 이미지 파일
│
├── 📁 assets/                # 정적 자산
├── 📁 includes/              # 재사용 컴포넌트
└── 📜 *.sql                  # 데이터베이스 스키마
```

## 🔧 개발 도구

### VS Code 확장 추천
```json
{
  "recommendations": [
    "ms-vscode.vscode-html-css-support",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "ritwickdey.liveserver"
  ]
}
```

### Chrome 확장 추천
- **Supabase DevTools**: 데이터베이스 디버깅
- **JSON Viewer**: API 응답 확인
- **Web Developer**: 개발자 도구

### 디버깅 설정
```javascript
// 브라우저 콘솔에서
window.DEBUG = true;
window.VERBOSE_LOGGING = true;

// 네트워크 요청 로깅
window.LOG_API_CALLS = true;
```

## 🧪 테스트 환경

### 1. 테스트 데이터 생성
```javascript
// 브라우저 콘솔에서 실행
await createTestData();
```

### 2. 로컬 테스트 체크리스트
- [ ] 로그인 기능 작동
- [ ] 업체 등록/수정 기능
- [ ] 업무일지 작성 기능
- [ ] 설정 페이지 기능
- [ ] PDF 파일 업로드 기능
- [ ] 검색 및 필터링 기능

### 3. 브라우저 호환성 테스트
- [ ] Chrome (최신)
- [ ] Firefox (최신)
- [ ] Safari (최신)
- [ ] Edge (최신)

## 🚨 문제 해결

### 자주 발생하는 문제들

#### CORS 에러
```javascript
// 해결방법: HTTP 서버를 통해 접속
// file:// 프로토콜 사용 금지
```

#### Supabase 연결 오류
```javascript
// 1. URL과 API 키 확인
// 2. RLS 정책 확인
// 3. 네트워크 연결 확인
```

#### OAuth 인증 실패
```javascript
// 1. 도메인 등록 확인
// 2. 앱 키 확인
// 3. 리다이렉트 URL 확인
```

### 디버깅 명령어
```javascript
// 현재 사용자 확인
console.log(sessionStorage.getItem('currentUser'));

// 데이터베이스 연결 상태
console.log(window.db?.client);

// 캐시 상태 확인
console.log(window.dataStability?.cache);
```

## 🔒 보안 설정

### 인증 및 권한 (Kakao OAuth 2.0)
```javascript
// 안전한 세션 관리
sessionStorage.setItem('kakaoToken', authObj.access_token); // OK
// localStorage 사용 금지 - 보안 위험
```

### Row Level Security (RLS)
```sql
-- 사용자별 데이터 격리
CREATE POLICY "Users can only access their own companies"
ON client_companies FOR ALL
USING (user_id = auth.uid()::integer);

-- RLS 활성화 필수
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
```

### XSS 방지
```javascript
// HTML 이스케이프 필수
function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// innerHTML 대신 textContent 사용 권장
```

### 파일 업로드 검증
- **PDF 전용**: `file.type === 'application/pdf'`
- **크기 제한**: 50MB 이하
- **파일명**: 영문/숫자만 허용

## 🚀 배포 가이드

### GitHub Pages 배포 (권장)
```bash
# 1. 저장소 푸시
git add . && git commit -m "Deploy" && git push origin main

# 2. GitHub 설정
# Settings → Pages → Source: main / (root)

# 3. 커스텀 도메인 (선택)
echo "namkyungsteel.com" > CNAME
```

### DNS 설정 (커스텀 도메인)
```
Type: A     → 185.199.108.153, 185.199.109.153
Type: CNAME → www → username.github.io
```

### 배포 전 체크리스트
- [ ] Supabase URL/Key 프로덕션용 확인
- [ ] 디버그 코드 제거 (`console.log` 정리)
- [ ] RLS 정책 활성화 확인
- [ ] HTTPS 강제 설정
- [ ] 캐시 버스팅 쿼리 추가 (`?v=버전`)

### 배포 후 검증
- [ ] 로그인 기능 테스트
- [ ] 데이터베이스 연결 확인
- [ ] 파일 업로드 테스트
- [ ] 모바일 반응형 확인

## 📚 추가 학습 자료

### 공식 문서
- [Supabase 문서](https://supabase.com/docs)
- [MDN Web Docs](https://developer.mozilla.org/)
- [JavaScript 가이드](https://javascript.info/)

### 프로젝트 문서
- [프로젝트 개요](PROJECT_DOCUMENTATION.md)
- [데이터베이스 설계](DATABASE_DESIGN.md)
- [사용자 가이드](USER_GUIDE.md)
- [변경 이력](CHANGELOG.md)

---
*개발/보안/배포 관련 문의는 이슈를 등록하세요.*