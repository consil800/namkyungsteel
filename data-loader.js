// 간단하고 안정적인 데이터 로딩 유틸리티
console.log('🔧 data-loader.js 로드됨');

class SimpleDataLoader {
    constructor() {
        this.retryDelay = 1000; // 1초
        this.maxRetries = 3;
    }

    // 데이터베이스 연결 확인
    async ensureDatabase() {
        let attempts = 0;
        while (attempts < this.maxRetries) {
            if (window.db && window.db.client) {
                console.log('✅ 데이터베이스 연결 확인됨');
                return true;
            }
            
            console.log(`⏳ 데이터베이스 연결 대기... (${attempts + 1}/${this.maxRetries})`);
            await this.sleep(this.retryDelay);
            attempts++;
        }
        
        console.error('❌ 데이터베이스 연결 실패');
        return false;
    }

    // 현재 사용자 정보 가져오기 (단순화)
    async getCurrentUser() {
        try {
            // 1. sessionStorage에서 확인
            const sessionUser = sessionStorage.getItem('currentUser');
            if (sessionUser) {
                const user = JSON.parse(sessionUser);
                if (user && user.id) {
                    console.log('✅ sessionStorage에서 사용자 정보 확인:', user.name);
                    return user;
                }
            }

            // 2. AuthManager 확인
            if (window.AuthManager && typeof AuthManager.getCurrentUser === 'function') {
                const user = AuthManager.getCurrentUser();
                if (user && user.id) {
                    console.log('✅ AuthManager에서 사용자 정보 확인:', user.name);
                    return user;
                }
            }

            // 3. 데이터베이스에서 조회 (마지막 수단)
            if (await this.ensureDatabase()) {
                await window.db.init();
                
                // 로그인 정보로 사용자 조회
                const loginInfo = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
                if (loginInfo.email) {
                    const { data: user } = await window.db.client
                        .from('users')
                        .select('*')
                        .eq('email', loginInfo.email)
                        .single();
                    
                    if (user) {
                        sessionStorage.setItem('currentUser', JSON.stringify(user));
                        console.log('✅ 데이터베이스에서 사용자 정보 확인:', user.name);
                        return user;
                    }
                }
            }

            console.error('❌ 사용자 정보를 찾을 수 없음');
            return null;
            
        } catch (error) {
            console.error('❌ 사용자 정보 조회 오류:', error);
            return null;
        }
    }

    // 사용자 설정 로드
    async loadUserSettings(userId) {
        if (!await this.ensureDatabase()) return null;
        
        try {
            const settings = await window.db.getUserSettings(userId);
            console.log('✅ 사용자 설정 로드 완료');
            return settings;
        } catch (error) {
            console.error('❌ 사용자 설정 로드 오류:', error);
            return null;
        }
    }

    // 업체 목록 로드
    async loadCompanies(userId) {
        if (!await this.ensureDatabase()) return [];
        
        try {
            // RLS를 위한 사용자 ID 설정
            await window.db.client.rpc('set_current_user_id', { user_id: userId.toString() });
            
            const companies = await window.db.getClientCompanies(userId);
            console.log(`✅ 업체 목록 로드 완료: ${companies.length}개`);
            return companies;
        } catch (error) {
            console.error('❌ 업체 목록 로드 오류:', error);
            return [];
        }
    }

    // 업체 등록
    async createCompany(companyData, userId) {
        if (!await this.ensureDatabase()) {
            throw new Error('데이터베이스 연결 실패');
        }
        
        try {
            // RLS를 위한 사용자 ID 설정
            await window.db.client.rpc('set_current_user_id', { user_id: userId.toString() });
            
            const result = await window.db.createClientCompany(companyData);
            console.log('✅ 업체 등록 완료');
            return result;
        } catch (error) {
            console.error('❌ 업체 등록 오류:', error);
            throw error;
        }
    }

    // 지연 함수
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 요소가 존재할 때까지 대기
    async waitForElement(selector, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const element = document.querySelector(selector);
            if (element) return element;
            await this.sleep(100);
        }
        return null;
    }

    // 안전한 DOM 업데이트
    safeUpdateElement(selector, content, isHTML = false) {
        const element = document.querySelector(selector);
        if (element) {
            if (isHTML) {
                element.innerHTML = content;
            } else {
                element.textContent = content;
            }
            return true;
        }
        console.warn(`⚠️ 요소를 찾을 수 없음: ${selector}`);
        return false;
    }
}

// 전역 인스턴스 생성
window.dataLoader = new SimpleDataLoader();