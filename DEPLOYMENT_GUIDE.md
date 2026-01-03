# 배포 가이드 🚀

## 배포 개요

남경철강 업무일지 시스템은 정적 사이트로 구성되어 있어 다양한 호스팅 서비스에 배포 가능합니다.

## 🌐 GitHub Pages 배포 (권장)

### 1. GitHub 저장소 설정
```bash
# 새 저장소 생성 후
git clone https://github.com/username/namkyungst.git
cd namkyungst

# 파일 추가
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. GitHub Pages 활성화
1. GitHub 저장소 → Settings → Pages
2. Source: Deploy from a branch
3. Branch: main / (root)
4. Save 클릭

### 3. 커스텀 도메인 설정 (선택)
```bash
# CNAME 파일 생성
echo "namkyungsteel.com" > CNAME
git add CNAME
git commit -m "Add custom domain"
git push origin main
```

### 4. DNS 설정
```
Type: A
Name: @
Value: 185.199.108.153
       185.199.109.153
       185.199.110.153
       185.199.111.153

Type: CNAME
Name: www
Value: username.github.io
```

## 🔧 배포 전 체크리스트

### 환경 변수 확인
```javascript
// database.js에서 프로덕션 설정 확인
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 파일 최적화
```bash
# HTML 파일 최적화
# - 불필요한 주석 제거
# - 공백 최적화

# JavaScript 파일 최적화
# - 디버그 코드 제거
# - 콘솔 로그 정리

# CSS 파일 최적화
# - 미사용 스타일 제거
# - 압축 가능
```

### 보안 설정
```javascript
// 민감한 정보 제거
// - 테스트용 계정 정보
// - 개발용 API 키
// - 디버그 플래그
```

## 📊 성능 최적화

### 이미지 최적화
```bash
# 이미지 압축 (권장 도구)
# - TinyPNG
# - ImageOptim
# - WebP 변환
```

### 캐싱 설정
```html
<!-- index.html에 캐시 메타태그 추가 -->
<meta http-equiv="Cache-Control" content="public, max-age=31536000">
<meta http-equiv="Expires" content="Mon, 31 Dec 2025 23:59:59 GMT">
```

### CDN 활용
```html
<!-- 외부 라이브러리 CDN 사용 -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
```

## 🔒 보안 설정

### Supabase RLS 정책 확인
```sql
-- 모든 테이블에 RLS 활성화 확인
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;

-- 정책 확인
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### HTTPS 강제 설정
```html
<!-- 모든 페이지 상단에 추가 -->
<script>
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    location.replace('https:' + window.location.href.substring(window.location.protocol.length));
}
</script>
```

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self' https:; 
               script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://developers.kakao.com;
               style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;">
```

## 📱 다른 호스팅 서비스

### Netlify 배포
```bash
# 빌드 설정
[build]
  publish = "."
  command = "echo 'Static site - no build needed'"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Vercel 배포
```json
{
  "name": "namkyungst",
  "version": 2,
  "public": true,
  "github": {
    "silent": true
  }
}
```

### Firebase Hosting
```bash
# Firebase CLI 설치
npm install -g firebase-tools

# 프로젝트 초기화
firebase init hosting

# 배포
firebase deploy
```

## 🔄 CI/CD 자동화

### GitHub Actions 설정
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
      
    - name: Setup Node
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./
```

### 자동 배포 스크립트
```bash
#!/bin/bash
# deploy.sh

echo "🚀 배포 시작..."

# 파일 최적화
echo "📝 파일 최적화 중..."
# HTML, CSS, JS 최적화 스크립트 실행

# Git 푸시
echo "📤 GitHub에 푸시 중..."
git add .
git commit -m "Deploy: $(date +'%Y-%m-%d %H:%M:%S')"
git push origin main

echo "✅ 배포 완료!"
echo "🌐 사이트: https://namkyungsteel.com"
```

## 📊 배포 후 모니터링

### 성능 모니터링
```javascript
// Google Analytics 추가 (선택)
gtag('config', 'GA_MEASUREMENT_ID');

// 핵심 웹 지표 추적
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Performance:', entry.name, entry.value);
  }
}).observe({entryTypes: ['measure']});
```

### 오류 모니터링
```javascript
// 전역 오류 핸들러
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  // 오류 로깅 서비스에 전송 (Sentry 등)
});

// 네트워크 오류 추적
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});
```

### 사용자 피드백 수집
```javascript
// 간단한 피드백 시스템
function collectFeedback(action, details) {
  // Supabase에 피드백 데이터 저장
  window.db.client
    .from('user_feedback')
    .insert({
      action: action,
      details: details,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent
    });
}
```

## 🔧 배포 문제 해결

### 자주 발생하는 문제들

#### 404 오류 (GitHub Pages)
```bash
# 해결방법: 404.html 파일 생성
cp index.html 404.html
```

#### 캐싱 문제
```html
<!-- 버전 쿼리 파라미터 추가 -->
<script src="database.js?v=20250101"></script>
<link rel="stylesheet" href="styles.css?v=20250101">
```

#### OAuth 리다이렉트 오류
```javascript
// 프로덕션 도메인을 OAuth 설정에 추가
const redirectUri = location.origin + '/oauth-redirect.html';
```

### 배포 검증 체크리스트
- [ ] 모든 페이지 로딩 확인
- [ ] 로그인 기능 테스트
- [ ] 데이터베이스 연결 확인
- [ ] 파일 업로드 기능 확인
- [ ] 모바일 반응형 확인
- [ ] 브라우저 호환성 확인
- [ ] HTTPS 적용 확인
- [ ] 성능 최적화 확인

## 📞 지원 및 문의

### 배포 관련 이슈
- GitHub Issues 활용
- 배포 로그 확인
- 브라우저 개발자 도구 확인

### 성능 문제
- Lighthouse 보고서 확인
- Network 탭에서 로딩 시간 확인
- Console 에러 로그 확인

---
*배포 가이드는 지속적으로 업데이트되며, 새로운 배포 방식도 추가될 예정입니다.*