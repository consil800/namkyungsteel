# 사용자 승인 시스템

> 신규 가입 → 관리자 승인 → 서비스 이용

## 가입 플로우

```
1. 회원가입 (role=null, is_approved=false)
2. 관리자 알림 발송
3. pending-members.html에서 승인
4. role 지정 + is_approved=true
5. 정상 로그인 가능
```

## 역할 체계

| 역할 | 권한 |
|------|------|
| master | 시스템 전체 관리 |
| company_CEO | 회사 관리, 사용자 승인 |
| company_admin | 사용자 승인, 설정 관리 |
| company_manager | 팀 관리 |
| employee | 일반 사용 |
| null | 미승인 대기 |

## 관련 파일

| 파일 | 역할 |
|------|------|
| register.html | 회원가입 폼 |
| pending-members.html | 승인 대기자 관리 |
| auth.js | 가입 로직 |
| database.js | createUser 함수 |

## 핵심 필드

| 컬럼 | 설명 |
|------|------|
| role | 역할 (null=미승인) |
| is_approved | 승인 여부 |
| is_active | 활성화 여부 |

---
*최종 업데이트: 2026-01-12*
