# 시스템 아키텍처 🏗️

## 전체 시스템 구조

```
┌──────────────────────────────────────────────────────────────────┐
│                         클라이언트 (Frontend)                       │
├────────────────┬─────────────────┬──────────────────┬─────────────┤
│  Presentation  │   Application   │   Data Access    │   Cache     │
│  Layer         │   Layer         │   Layer          │   Layer     │
│ • HTML Pages   │ • main.js       │ • database.js    │ • Local     │
│ • CSS Styles   │ • company-*.js  │ • data-loader.js │   Storage   │
│ • UI Controls  │ • settings.js   │ • API calls      │ • Session   │
└────────────────┴─────────────────┴──────────────────┴─────────────┘
                              ↕ HTTPS
┌──────────────────────────────────────────────────────────────────┐
│                         백엔드 (Supabase)                          │
├────────────────┬─────────────────┬──────────────────┬─────────────┤
│   Database     │   Storage       │  Authentication  │   Security  │
│ • PostgreSQL   │ • PDF Files     │ • Kakao OAuth   │ • RLS       │
│ • Tables       │ • Documents     │ • User Sessions │ • Policies  │
│ • Indexes      │ • Images        │ • JWT Tokens    │ • CORS      │
└────────────────┴─────────────────┴──────────────────┴─────────────┘
```

## 🔄 핵심 데이터 흐름

### 1. 사용자 인증 프로세스
```mermaid
사용자 접속 → Kakao 로그인 페이지
    ↓
OAuth 인증 → 액세스 토큰 발급
    ↓
사용자 정보 조회 → Supabase 저장
    ↓
권한 확인 → 세션 생성 → 메인 화면
```

### 2. 업체 데이터 관리
```mermaid
검색/조회 → 캐시 확인 → DB 쿼리
    ↓
RLS 정책 적용 → 권한 검증
    ↓
데이터 반환 → 캐시 저장 → UI 렌더링
```

### 3. 실시간 동기화
```mermaid
데이터 변경 → DB 업데이트
    ↓
캐시 무효화 → 이벤트 발생
    ↓
연결된 클라이언트 → 자동 새로고침
```

## 🧱 주요 컴포넌트 상세

### Frontend 컴포넌트

#### 1. **Core Modules**
- `database.js` - Supabase 클라이언트 및 DB 작업
- `data-loader.js` - 데이터 로딩 및 캐싱
- `auth.js` - 인증 관리

#### 2. **Feature Modules**
- `main.js` - 메인 페이지 로직
- `company-detail.js` - 업체 상세 관리
- `company-network.js` - 관계도 시각화
- `settings.js` - 사용자 설정

#### 3. **Utility Modules**
- `dropdown-loader.js` - 드롭다운 데이터
- `data-cache.js` - 캐시 관리
- `error-handler.js` - 에러 처리

### Backend 구조 (Supabase)

#### 1. **데이터베이스 테이블**
- `users` - 사용자 정보
- `client_companies` - 업체 정보
- `work_logs` - 업무일지
- `user_settings` - 사용자별 설정
- `pdf_files` - PDF 문서 메타데이터

#### 2. **보안 정책 (RLS)**
- 사용자별 데이터 격리
- 회사 도메인별 접근 제어
- 역할 기반 권한 관리

#### 3. **스토리지**
- PDF 파일 저장
- 프로필 이미지
- 업체 관련 문서

## 🔐 보안 아키텍처

### 인증 계층
1. **Kakao OAuth 2.0**
   - 안전한 소셜 로그인
   - 토큰 기반 인증
   - 자동 토큰 갱신

2. **세션 관리**
   - SessionStorage 활용
   - 브라우저 탭별 독립
   - 자동 만료 처리

3. **권한 검증**
   - 프론트엔드 사전 검증
   - 백엔드 RLS 최종 검증
   - 다중 레이어 보안

### 데이터 보호
1. **전송 암호화**
   - HTTPS 전용
   - TLS 1.3 지원

2. **저장 암호화**
   - Supabase 자동 암호화
   - 민감 데이터 해싱

3. **접근 제어**
   - IP 화이트리스트
   - CORS 정책
   - Rate Limiting

## 🚀 성능 최적화

### 캐싱 전략
1. **메모리 캐시**
   - 자주 사용하는 데이터
   - 5분 TTL

2. **LocalStorage**
   - 사용자 설정
   - 세션 정보

3. **SessionStorage**
   - 검색 상태
   - 임시 데이터

### 로딩 최적화
1. **Lazy Loading**
   - 필요시 데이터 로드
   - 초기 로드 최소화

2. **검색 우선 UI**
   - 빈 목록으로 시작
   - 검색시에만 데이터 표시

3. **배치 처리**
   - PDF 상태 일괄 확인
   - 통계 사전 계산

## 📊 모니터링 포인트

### 성능 지표
- 페이지 로드 시간 < 2초
- API 응답 시간 < 500ms
- 캐시 히트율 > 80%

### 에러 추적
- JavaScript 콘솔 에러
- API 에러 응답
- 네트워크 타임아웃

### 사용성 지표
- 검색 사용률
- 기능별 사용 빈도
- 세션 지속 시간

---

*더 자세한 기술 사양은 [API 문서](API_DOCUMENTATION.md)를 참고하세요.*