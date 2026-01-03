# 보안 가이드 🔒

## 보안 개요

남경철강 업무일지 시스템은 다층 보안 구조를 통해 데이터를 보호합니다.

## 🔐 인증 및 권한 관리

### Kakao OAuth 2.0 인증
```javascript
// 안전한 OAuth 설정
window.Kakao.init('YOUR_KAKAO_APP_KEY');

// 로그인 처리
function handleKakaoLogin() {
    Kakao.Auth.login({
        scope: 'profile_nickname,profile_image,account_email',
        success: function(authObj) {
            console.log('인증 성공:', authObj);
            // 토큰은 세션에만 저장, 로컬 저장소 사용 금지
            sessionStorage.setItem('kakaoToken', authObj.access_token);
        },
        fail: function(err) {
            console.error('인증 실패:', err);
        }
    });
}
```

### 사용자 세션 관리
```javascript
// 안전한 세션 관리
class SessionManager {
    static setUserSession(userData) {
        // 민감한 정보 제외하고 저장
        const safeUserData = {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role,
            // 비밀번호, 토큰 등 민감한 정보는 저장하지 않음
        };
        
        sessionStorage.setItem('currentUser', JSON.stringify(safeUserData));
        
        // 자동 로그아웃 타이머 설정 (8시간)
        this.setAutoLogout(8 * 60 * 60 * 1000);
    }
    
    static setAutoLogout(timeout) {
        setTimeout(() => {
            this.logout();
            alert('보안을 위해 자동 로그아웃되었습니다.');
            window.location.href = 'login.html';
        }, timeout);
    }
    
    static logout() {
        sessionStorage.clear();
        localStorage.removeItem('userPreferences'); // 필요한 경우만
    }
}
```

## 🛡️ Row Level Security (RLS)

### 데이터베이스 보안 정책
```sql
-- 사용자별 데이터 격리 정책
CREATE POLICY "Users can only access their own companies" 
ON client_companies FOR ALL
USING (user_id = auth.uid()::integer);

CREATE POLICY "Users can only access their own work logs" 
ON work_logs FOR ALL  
USING (user_id = auth.uid()::integer);

CREATE POLICY "Users can only access their own settings"
ON user_settings FOR ALL
USING (user_id = auth.uid()::integer);

-- RLS 활성화
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
```

### RLS 헬퍼 함수
```sql
-- 현재 사용자 ID 설정/조회 함수
CREATE OR REPLACE FUNCTION set_current_user_id(user_id text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS text AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql;
```

### JavaScript에서 RLS 사용
```javascript
// 안전한 데이터베이스 접근
class SecureDataAccess {
    static async setUserContext(userId) {
        try {
            const { error } = await window.db.client.rpc('set_current_user_id', {
                user_id: userId.toString()
            });
            
            if (error) {
                console.error('RLS 컨텍스트 설정 실패:', error);
                throw new Error('데이터베이스 보안 설정 실패');
            }
            
            console.log('✅ RLS 사용자 컨텍스트 설정 완료');
        } catch (error) {
            console.error('❌ RLS 설정 오류:', error);
            throw error;
        }
    }
    
    static async getCompanies(userId) {
        // RLS 컨텍스트 설정 후 데이터 조회
        await this.setUserContext(userId);
        
        const { data, error } = await window.db.client
            .from('client_companies')
            .select('*')
            .order('company_name');
            
        if (error) throw error;
        return data;
    }
}
```

## 🔒 입력 데이터 검증

### 클라이언트 사이드 검증
```javascript
// 입력 데이터 검증 함수
class InputValidator {
    static validateCompanyData(data) {
        const errors = [];
        
        // 필수 필드 검증
        if (!data.company_name || data.company_name.trim().length === 0) {
            errors.push('업체명은 필수 입력 항목입니다.');
        }
        
        if (!data.region || data.region.trim().length === 0) {
            errors.push('지역은 필수 입력 항목입니다.');
        }
        
        // 길이 제한 검증
        if (data.company_name && data.company_name.length > 200) {
            errors.push('업체명은 200자 이하로 입력해주세요.');
        }
        
        // 이메일 형식 검증
        if (data.email && !this.isValidEmail(data.email)) {
            errors.push('올바른 이메일 형식을 입력해주세요.');
        }
        
        // 전화번호 형식 검증 (숫자, 하이픈만 허용)
        if (data.phone && !this.isValidPhone(data.phone)) {
            errors.push('올바른 전화번호 형식을 입력해주세요.');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    static isValidPhone(phone) {
        const phoneRegex = /^[0-9-+().\s]+$/;
        return phoneRegex.test(phone);
    }
    
    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .trim()
            .replace(/[<>]/g, '') // HTML 태그 방지
            .replace(/javascript:/gi, '') // JavaScript 인젝션 방지
            .replace(/on\w+\s*=/gi, ''); // 이벤트 핸들러 방지
    }
}
```

### 서버 사이드 검증 (Supabase Functions)
```javascript
// Supabase Edge Function 예시
export async function validateAndInsert(request) {
    const { data } = await request.json();
    
    // 서버사이드에서 재검증
    if (!data.company_name || data.company_name.trim().length === 0) {
        return new Response(
            JSON.stringify({ error: '업체명은 필수 입력 항목입니다.' }),
            { status: 400 }
        );
    }
    
    // SQL 인젝션 방지를 위한 파라미터화된 쿼리 사용
    const { data: result, error } = await supabaseClient
        .from('client_companies')
        .insert([
            {
                company_name: data.company_name,
                region: data.region,
                // 모든 필드를 명시적으로 지정
            }
        ]);
        
    if (error) {
        return new Response(
            JSON.stringify({ error: '데이터 저장 실패' }),
            { status: 500 }
        );
    }
    
    return new Response(JSON.stringify(result));
}
```

## 🔐 XSS 방지

### HTML 이스케이프
```javascript
// XSS 방지를 위한 HTML 이스케이프
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 안전한 HTML 생성
function createSafeHTML(companyData) {
    return `
        <div class="company-info">
            <h3>${escapeHtml(companyData.name)}</h3>
            <p>${escapeHtml(companyData.address)}</p>
            <p>${escapeHtml(companyData.notes)}</p>
        </div>
    `;
}

// innerHTML 대신 textContent 사용 (가능한 경우)
element.textContent = userInput; // 안전
// element.innerHTML = userInput; // 위험
```

### Content Security Policy
```html
<!-- CSP 헤더 설정 -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self' https:; 
               script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://developers.kakao.com https://zgyawfmjconubxaiamod.supabase.co;
               style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
               img-src 'self' data: https:;
               connect-src 'self' https://zgyawfmjconubxaiamod.supabase.co https://kauth.kakao.com;
               font-src 'self' https://cdnjs.cloudflare.com;">
```

## 📁 파일 업로드 보안

### PDF 파일 검증
```javascript
class SecureFileUpload {
    static validatePDFFile(file) {
        const errors = [];
        
        // 파일 타입 검증
        if (file.type !== 'application/pdf') {
            errors.push('PDF 파일만 업로드 가능합니다.');
        }
        
        // 파일 크기 제한 (50MB)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            errors.push('파일 크기는 50MB 이하로 제한됩니다.');
        }
        
        // 파일명 검증 (보안을 위해 영문/숫자만 허용)
        const safeNameRegex = /^[a-zA-Z0-9._-]+\.pdf$/i;
        if (!safeNameRegex.test(file.name)) {
            errors.push('파일명은 영문, 숫자, 점, 하이픈, 언더스코어만 사용 가능합니다.');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    static sanitizeFileName(fileName) {
        // 안전한 파일명 생성
        const name = fileName.split('.')[0];
        const extension = fileName.split('.').pop();
        
        const safeName = name
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .toLowerCase();
            
        return `${Date.now()}_${safeName || 'document'}.${extension}`;
    }
    
    static async uploadSecurely(file, userId) {
        // 파일 검증
        const validation = this.validatePDFFile(file);
        if (!validation.isValid) {
            throw new Error(validation.errors.join('\n'));
        }
        
        // 안전한 파일명 생성
        const safeFileName = this.sanitizeFileName(file.name);
        
        // 사용자별 폴더에 업로드
        const filePath = `${userId}/${safeFileName}`;
        
        const { data, error } = await window.db.client.storage
            .from('company-pdfs')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
            
        if (error) throw error;
        
        return {
            originalName: file.name,
            safeName: safeFileName,
            path: filePath,
            url: data.publicUrl
        };
    }
}
```

### Storage 보안 정책
```sql
-- Storage 객체에 대한 RLS 정책
CREATE POLICY "Users can only upload to their own folder" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'company-pdfs' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can only access files in their own folder" ON storage.objects
FOR SELECT USING (
    bucket_id = 'company-pdfs' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can only delete their own files" ON storage.objects
FOR DELETE USING (
    bucket_id = 'company-pdfs' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);
```

## 🔒 HTTPS 및 전송 보안

### HTTPS 강제 설정
```javascript
// HTTPS 강제 리다이렉트
(function enforceHTTPS() {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        location.replace('https:' + window.location.href.substring(window.location.protocol.length));
    }
})();
```

### 보안 헤더 설정
```html
<!-- 보안 강화 메타 태그 -->
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="X-XSS-Protection" content="1; mode=block">
<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
```

## 🕵️ 보안 모니터링

### 오류 로깅
```javascript
// 보안 관련 오류 모니터링
class SecurityMonitor {
    static logSecurityEvent(event, details) {
        const securityLog = {
            timestamp: new Date().toISOString(),
            event: event,
            details: details,
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.getCurrentUserId()
        };
        
        // 보안 로그를 안전한 곳에 저장
        console.warn('🚨 보안 이벤트:', securityLog);
        
        // 필요시 서버로 전송 (민감한 정보 제외)
        this.sendToSecurityLog(securityLog);
    }
    
    static sendToSecurityLog(logData) {
        // 실제 보안 로깅 서비스로 전송
        // (개인 정보는 제외하고 전송)
        const sanitizedLog = {
            timestamp: logData.timestamp,
            event: logData.event,
            url: logData.url
            // 사용자 ID나 민감한 정보는 제외
        };
        
        fetch('/api/security-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitizedLog)
        }).catch(error => {
            console.error('보안 로그 전송 실패:', error);
        });
    }
    
    static getCurrentUserId() {
        try {
            const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            return user.id || 'anonymous';
        } catch {
            return 'anonymous';
        }
    }
}

// 보안 이벤트 감지
window.addEventListener('error', (e) => {
    if (e.message.includes('Script error')) {
        SecurityMonitor.logSecurityEvent('script_error', {
            message: 'Potential XSS attempt detected'
        });
    }
});
```

## 🛡️ 보안 체크리스트

### 개발 단계 체크리스트
- [ ] **인증**: 모든 API 호출에 인증 확인
- [ ] **권한**: 사용자별 데이터 접근 권한 검증  
- [ ] **입력 검증**: 모든 사용자 입력에 대한 클라이언트/서버 검증
- [ ] **XSS 방지**: HTML 이스케이프 및 CSP 설정
- [ ] **SQL 인젝션 방지**: 파라미터화된 쿼리 사용
- [ ] **파일 업로드**: 파일 타입, 크기, 이름 검증
- [ ] **HTTPS**: 모든 통신 암호화
- [ ] **세션 관리**: 적절한 세션 타임아웃 설정

### 배포 전 보안 점검
- [ ] **API 키**: 프로덕션용 키로 변경
- [ ] **디버그 코드**: 개발용 코드 제거
- [ ] **로그**: 민감한 정보 로그 제거
- [ ] **권한**: 최소 권한 원칙 적용
- [ ] **백업**: 데이터베이스 백업 및 복구 계획
- [ ] **모니터링**: 보안 이벤트 모니터링 설정

### 운영 중 보안 관리
- [ ] **정기 점검**: 월 1회 보안 상태 점검
- [ ] **업데이트**: 라이브러리 및 종속성 업데이트
- [ ] **로그 분석**: 의심스러운 활동 모니터링
- [ ] **백업**: 주기적 데이터 백업 확인
- [ ] **접근 로그**: 비정상 접근 패턴 감지
- [ ] **사용자 교육**: 보안 사용 가이드 제공

---
*보안은 지속적인 관심과 업데이트가 필요합니다. 새로운 위협에 대응하기 위해 정기적으로 보안 조치를 검토하고 개선하세요.*