# 보안 가이드

## 중요한 보안 주의사항

### ⚠️ 즉시 수정이 필요한 보안 문제

1. **비밀번호 해싱**
   - 현재 비밀번호가 평문으로 저장됨
   - 실제 운영환경에서는 bcrypt 등을 사용하여 해싱 필요

2. **기본 계정 비밀번호 변경**
   - `master123`, `admin123` 등 기본 비밀번호 즉시 변경
   - 강력한 비밀번호 정책 적용

3. **환경변수 설정**
   - `.env` 파일에 실제 Supabase 키 설정
   - `.env` 파일은 절대 GitHub에 커밋하지 말 것

### 🔧 권장 보안 개선사항

1. **Content Security Policy (CSP) 추가**
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.supabase.co">
```

2. **입력값 검증 및 XSS 방지**
```javascript
// DOMPurify 사용 권장
const sanitizedInput = DOMPurify.sanitize(userInput);
```

3. **HTTPS 강제 사용**
```javascript
// HTTP에서 HTTPS로 리다이렉트
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    location.replace('https:' + window.location.href.substring(window.location.protocol.length));
}
```

4. **세션 관리 개선**
- localStorage 대신 httpOnly 쿠키 사용
- 세션 만료 시간 설정
- 적절한 로그아웃 처리

### 🚫 운영환경에서 제거해야 할 것들

1. **Console.log 문장**
   - 모든 console.log 제거 또는 조건부 처리
   - 민감한 정보 로깅 금지

2. **테스트 계정**
   - 기본 관리자 계정 삭제 또는 비활성화
   - 실제 운영용 계정으로 대체

3. **개발용 설정**
   - 디버그 모드 비활성화
   - 에러 메시지에서 시스템 정보 노출 방지

### 📋 보안 체크리스트

- [ ] 환경변수 설정 완료
- [ ] 기본 비밀번호 변경
- [ ] HTTPS 설정
- [ ] CSP 헤더 추가
- [ ] 입력값 검증 구현
- [ ] Console.log 제거
- [ ] 에러 처리 개선
- [ ] 파일 업로드 검증
- [ ] 데이터베이스 보안 설정
- [ ] 정기 보안 업데이트

### 🔍 정기 보안 점검

1. **월별**
   - 액세스 로그 검토
   - 사용자 권한 검토
   - 의심스러운 활동 모니터링

2. **분기별**
   - 전체 보안 감사
   - 라이브러리 업데이트
   - 취약점 스캔

3. **연간**
   - 포괄적 보안 테스트
   - 보안 정책 검토
   - 직원 보안 교육