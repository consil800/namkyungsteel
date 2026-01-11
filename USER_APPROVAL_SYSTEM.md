# 사용자 승인 시스템

> 신규 가입 → 관리자 승인 → 서비스 이용 워크플로우

## 개요

신규 사용자는 가입 즉시 서비스를 이용할 수 없습니다.
관리자(company_CEO, company_admin)가 승인해야 정상 이용 가능합니다.

## 사용자 플로우

```
1. 신규 사용자 회원가입 (register.html)
2. DB 저장: role=null, is_approved=false
3. 관리자에게 알림 발송 (notifications 테이블)
4. 관리자가 pending-members.html에서 승인
5. role 지정 + is_approved=true 업데이트
6. 사용자 정상 로그인 가능
```

## 역할(Role) 체계

| 역할 | 권한 | 설명 |
|------|------|------|
| `master` | 최고 관리자 | 시스템 전체 관리 |
| `company_CEO` | 대표이사 | 회사 전체 관리, 사용자 승인 |
| `company_admin` | 관리자 | 사용자 승인, 설정 관리 |
| `company_manager` | 매니저 | 팀 관리 |
| `employee` | 직원 | 일반 사용 |
| `null` | 미승인 | 가입 대기 상태 |

## 데이터베이스

### users 테이블 주요 필드

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `role` | VARCHAR | 'employee' | 역할 (null=미승인) |
| `is_approved` | BOOLEAN | true | 승인 여부 |
| `is_active` | BOOLEAN | true | 활성화 여부 |

### notifications 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGSERIAL | 기본키 |
| `user_id` | BIGINT | 알림 수신자 (FK → users) |
| `type` | VARCHAR(50) | 알림 유형 (new_user_registration 등) |
| `title` | VARCHAR(200) | 알림 제목 |
| `message` | TEXT | 알림 내용 |
| `related_id` | BIGINT | 관련 데이터 ID |
| `company_domain` | VARCHAR(100) | 회사 도메인 |
| `is_read` | BOOLEAN | 읽음 여부 |
| `created_at` | TIMESTAMPTZ | 생성일시 |

## 핵심 코드

### database.js - createUser 함수

```javascript
// 2026-01-10: role과 is_approved null/false 허용 수정
// 기존: role: userData.role || 'employee' → null이 'employee'로 변환되는 버그
// 수정: 'in' 연산자로 속성 존재 여부 확인하여 null 명시 허용
role: 'role' in userData ? userData.role : 'employee',
is_approved: 'is_approved' in userData ? userData.is_approved : true,
```

### auth.js - 회원가입 호출

```javascript
const result = await window.db.createUser({
    // ... 기타 필드
    role: null,           // 가입 시에는 role 없음, 승인 시 설정
    is_approved: false    // 모든 신규 사용자는 승인 대기
});
```

### pending-members.html - 대기자 조회

```javascript
// role이 null인 사용자 = 미승인 대기자
.is('role', null)
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `shared-assets/js/auth.js` | 회원가입 로직, 알림 생성 |
| `database.js` | createUser, updateUser 함수 |
| `pending-members.html` | 승인 대기자 관리 UI |
| `register.html` | 회원가입 폼 |

## 버그 수정 이력

### 2026-01-10: null/false 값 저장 버그 수정

**문제**
- `role: null` 전달 시 `'employee'`로 저장됨
- `is_approved: false` 필드가 누락되어 DB 기본값 `true` 적용
- 결과: 모든 신규 사용자가 자동 승인됨

**원인**
```javascript
// JavaScript OR 연산자는 null을 falsy로 처리
role: userData.role || 'employee'  // null → 'employee'
```

**해결**
```javascript
// 'in' 연산자로 속성 존재 여부만 확인
role: 'role' in userData ? userData.role : 'employee'
is_approved: 'is_approved' in userData ? userData.is_approved : true
```

---
*최종 업데이트: 2026-01-10*
