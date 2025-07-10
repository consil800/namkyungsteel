# 남경스틸(주) 웹사이트

남경스틸(주)의 공식 웹사이트입니다.

## 주요 기능

- 회사 소개 및 서비스 안내
- 사용자 인증 시스템 (회원가입/로그인)
- 관리자 대시보드
- 직원 관리 시스템
- 업무 일지 관리
- 법인카드 사용내역 관리

## 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Database**: Supabase
- **Authentication**: Custom JWT-based system
- **UI Framework**: Bootstrap 5
- **Icons**: Font Awesome 6

## 설치 및 설정

### 1. 프로젝트 클론

```bash
git clone [repository-url]
cd namkyungst
```

### 2. 환경변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 설정값을 입력하세요.

```bash
cp .env.example .env
```

`.env` 파일에서 다음 값들을 설정하세요:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

### 3. 데이터베이스 설정

Supabase 프로젝트를 생성하고 `database-schema.sql` 파일을 실행하여 필요한 테이블을 생성하세요.

1. [Supabase](https://supabase.com)에 로그인
2. 새 프로젝트 생성
3. SQL Editor에서 `database-schema.sql` 내용 실행
4. 프로젝트 URL과 anon key를 `.env` 파일에 입력

### 4. 웹 서버 실행

정적 웹 서버를 사용하여 프로젝트를 실행하세요:

```bash
# Python 3
python -m http.server 8000

# Node.js (live-server)
npx live-server

# PHP
php -S localhost:8000
```

브라우저에서 `http://localhost:8000`으로 접속하세요.

## 프로젝트 구조

```
namkyungst/
├── index.html              # 메인 홈페이지
├── login.html              # 로그인/회원가입 페이지
├── admin-dashboard.html    # 관리자 대시보드
├── master-dashboard.html   # 마스터 대시보드
├── database.js            # 데이터베이스 연결 관리
├── database-schema.sql    # 데이터베이스 스키마
├── shared-assets/         # 공통 에셋
│   ├── css/              # 스타일시트
│   └── js/               # JavaScript 파일
├── assets/               # 이미지, 폰트 등
└── README.md
```

## 사용자 역할

- **master**: 시스템 최고 관리자
- **company_admin**: 회사 관리자
- **company_manager**: 회사 매니저
- **employee**: 일반 직원

## 보안 고려사항

- 환경변수 파일(`.env`)은 절대 커밋하지 마세요
- 실제 운영환경에서는 비밀번호 해싱을 구현하세요
- HTTPS를 사용하여 배포하세요
- 정기적으로 데이터베이스 백업을 수행하세요

## 개발 가이드

### 새로운 기능 추가

1. 데이터베이스 스키마 수정이 필요한 경우 `database-schema.sql` 업데이트
2. `database.js`에 필요한 데이터베이스 함수 추가
3. 프론트엔드 코드 구현
4. 테스트 수행

### 코드 스타일

- JavaScript: ES6+ 문법 사용
- CSS: BEM 방법론 권장
- HTML: 시맨틱 마크업 사용

## 라이선스

Copyright © 2024 남경스틸(주). All rights reserved.