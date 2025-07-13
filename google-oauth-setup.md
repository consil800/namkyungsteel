# Google OAuth 설정 가이드

## Supabase에서 Google OAuth 활성화

### 1. Supabase 대시보드 설정
1. **Supabase 프로젝트** 접속
2. 왼쪽 메뉴에서 **"Authentication"** 클릭
3. **"Providers"** 탭 선택
4. **"Google"** 찾아서 활성화

### 2. Google Cloud Console 설정
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **"APIs & Services" > "Credentials"** 이동
4. **"+ CREATE CREDENTIALS" > "OAuth 2.0 Client IDs"** 클릭

### 3. OAuth Client 설정
- **Application type**: Web application
- **Name**: Namkyung Steel OAuth
- **Authorized JavaScript origins**: 
  ```
  http://localhost:3000
  https://yourdomain.com
  ```
- **Authorized redirect URIs**:
  ```
  https://zgyawfmjconubxaiamod.supabase.co/auth/v1/callback
  ```

### 4. Supabase에 Google 설정 추가
1. Google에서 생성된 **Client ID**와 **Client Secret** 복사
2. Supabase > Authentication > Providers > Google에서:
   - **Enabled**: 체크
   - **Client ID**: 붙여넣기
   - **Client Secret**: 붙여넣기
   - **Save** 클릭

### 5. 테스트
- 웹사이트에서 "Google로 로그인" 버튼 클릭
- Google 로그인 페이지로 리다이렉트
- 로그인 완료 후 employee-dashboard.html로 자동 이동

## 보안 고려사항
- **HTTPS 필수**: 프로덕션에서는 반드시 HTTPS 사용
- **도메인 제한**: Authorized origins에 실제 도메인만 추가
- **Client Secret 보안**: 절대 공개 저장소에 노출 금지

## 문제 해결
- **"redirect_uri_mismatch"**: Authorized redirect URIs 확인
- **"invalid_client"**: Client ID/Secret 재확인
- **콘솔 에러**: 브라우저 개발자 도구에서 상세 에러 확인