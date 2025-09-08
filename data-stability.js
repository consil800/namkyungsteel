// 데이터 안정성 유틸리티
console.log('🛠️ data-stability.js 로드됨');

class DataStabilityManager {
    constructor() {
        this.retryAttempts = 0;
        this.maxRetries = 10;
        this.baseDelay = 1000;
        this.cache = new Map();
        this.isOnline = navigator.onLine;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 네트워크 상태 모니터링
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 네트워크 연결됨');
            this.retryFailedRequests();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('🌐 네트워크 연결 끊김');
        });

        // 페이지 숨김/보임 감지 (탭 전환 시 재연결)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnline) {
                this.checkDatabaseConnection();
            }
        });
    }

    // 데이터베이스 연결 확인
    async ensureDatabaseConnection() {
        console.log('🔄 데이터베이스 연결 확인 중...');
        
        let attempts = 0;
        while (attempts < this.maxRetries) {
            try {
                // 데이터베이스 클라이언트 확인
                if (!window.db || !window.db.client) {
                    console.log(`⏳ 데이터베이스 클라이언트 대기 중... (${attempts + 1}/${this.maxRetries})`);
                    await this.sleep(this.getRetryDelay(attempts));
                    attempts++;
                    continue;
                }

                // 실제 연결 테스트 (간단한 쿼리)
                const { data, error } = await window.db.client
                    .from('users')
                    .select('id')
                    .limit(1);

                if (error) {
                    throw error;
                }

                console.log('✅ 데이터베이스 연결 확인됨');
                this.retryAttempts = 0; // 성공 시 재시도 카운터 리셋
                return true;

            } catch (error) {
                console.warn(`⚠️ 데이터베이스 연결 테스트 실패 (${attempts + 1}/${this.maxRetries}):`, error);
                
                if (attempts >= this.maxRetries - 1) {
                    console.error('❌ 데이터베이스 연결 실패 - 최대 재시도 횟수 초과');
                    return false;
                }

                await this.sleep(this.getRetryDelay(attempts));
                attempts++;
            }
        }

        return false;
    }

    // 지수 백오프를 사용한 재시도 지연
    getRetryDelay(attemptNumber) {
        return Math.min(this.baseDelay * Math.pow(2, attemptNumber), 10000); // 최대 10초
    }

    // Sleep 유틸리티
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 안전한 데이터 로딩 (캐시 및 폴백 지원)
    async safeLoadData(loadFunction, cacheKey, defaultValue = null) {
        try {
            console.log(`📊 데이터 로딩 시작: ${cacheKey}`);

            // 먼저 데이터베이스 연결 확인
            if (!await this.ensureDatabaseConnection()) {
                throw new Error('데이터베이스 연결 실패');
            }

            // 데이터 로딩 시도
            const data = await loadFunction();
            
            // 성공 시 캐시 저장
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now(),
                ttl: 5 * 60 * 1000 // 5분 TTL
            });

            console.log(`✅ 데이터 로딩 성공: ${cacheKey}`);
            return data;

        } catch (error) {
            console.error(`❌ 데이터 로딩 실패: ${cacheKey}`, error);

            // 캐시에서 데이터 시도
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) {
                console.log(`📦 캐시된 데이터 사용: ${cacheKey}`);
                this.showWarning('일부 데이터가 최신이 아닐 수 있습니다.');
                return cachedData;
            }

            // 기본값 반환
            console.log(`🔄 기본값 반환: ${cacheKey}`);
            this.showError(`데이터를 불러올 수 없습니다: ${cacheKey}`);
            return defaultValue;
        }
    }

    // 캐시에서 데이터 가져오기
    getCachedData(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (!cached) return null;

        // TTL 확인
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(cacheKey);
            return null;
        }

        return cached.data;
    }

    // 실패한 요청 재시도
    async retryFailedRequests() {
        if (this.retryAttempts > 0) {
            console.log('🔄 네트워크 복구로 인한 재시도');
            // 현재 페이지 새로고침 또는 데이터 재로딩
            if (typeof window.refreshCurrentData === 'function') {
                await window.refreshCurrentData();
            }
        }
    }

    // 데이터베이스 연결 상태 체크
    async checkDatabaseConnection() {
        const isConnected = await this.ensureDatabaseConnection();
        if (!isConnected) {
            this.showConnectionError();
        }
        return isConnected;
    }

    // 사용자 친화적 경고 메시지
    showWarning(message) {
        const warningDiv = this.getOrCreateStatusDiv('warning');
        warningDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
            <button onclick="location.reload()" style="margin-left: 10px; padding: 2px 8px; background: #f59e0b; color: white; border: none; border-radius: 3px; cursor: pointer;">
                새로고침
            </button>
        `;
        warningDiv.style.display = 'block';
        
        // 자동으로 5초 후 숨기기
        setTimeout(() => {
            warningDiv.style.display = 'none';
        }, 5000);
    }

    // 사용자 친화적 에러 메시지
    showError(message) {
        const errorDiv = this.getOrCreateStatusDiv('error');
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            ${message}
            <button onclick="location.reload()" style="margin-left: 10px; padding: 2px 8px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer;">
                새로고침
            </button>
        `;
        errorDiv.style.display = 'block';
    }

    // 연결 오류 메시지
    showConnectionError() {
        const errorDiv = this.getOrCreateStatusDiv('connection-error');
        errorDiv.innerHTML = `
            <i class="fas fa-wifi" style="opacity: 0.5;"></i>
            데이터베이스 연결에 문제가 있습니다. 
            <button onclick="location.reload()" style="margin-left: 10px; padding: 5px 15px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">
                다시 시도
            </button>
        `;
        errorDiv.style.display = 'block';
    }

    // 상태 표시 div 생성/가져오기
    getOrCreateStatusDiv(type) {
        const id = `dataStatus_${type}`;
        let div = document.getElementById(id);
        
        if (!div) {
            div = document.createElement('div');
            div.id = id;
            div.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 9999;
                padding: 10px 15px;
                border-radius: 5px;
                color: white;
                font-size: 14px;
                font-weight: 500;
                display: none;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                font-family: 'Noto Sans KR', sans-serif;
            `;

            // 타입별 스타일
            if (type === 'warning') {
                div.style.backgroundColor = '#f59e0b';
            } else if (type === 'error') {
                div.style.backgroundColor = '#ef4444';
            } else if (type === 'connection-error') {
                div.style.backgroundColor = '#6b7280';
            }

            document.body.appendChild(div);
        }

        return div;
    }

    // 안전한 사용자 정보 가져오기
    async getCurrentUserSafely() {
        try {
            // sessionStorage에서 사용자 정보 시도
            let currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            
            if (!currentUser.id) {
                // localStorage에서도 시도
                currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            }

            if (!currentUser.id) {
                throw new Error('사용자 정보가 없습니다');
            }

            // 데이터베이스에서 최신 정보 확인 (선택사항)
            if (await this.ensureDatabaseConnection()) {
                try {
                    const { data: dbUser, error } = await window.db.client
                        .from('users')
                        .select('*')
                        .eq('email', currentUser.email)
                        .single();
                    
                    if (!error && dbUser) {
                        // 최신 정보로 업데이트
                        const updatedUser = { ...currentUser, ...dbUser };
                        sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
                        return updatedUser;
                    }
                } catch (dbError) {
                    console.warn('데이터베이스에서 사용자 정보 업데이트 실패:', dbError);
                }
            }

            return currentUser;

        } catch (error) {
            console.error('사용자 정보 가져오기 실패:', error);
            // 로그인 페이지로 리다이렉트
            if (window.location.pathname !== '/login.html' && !window.location.pathname.includes('index.html')) {
                console.log('🔑 로그인 페이지로 리다이렉트');
                window.location.href = 'login.html';
            }
            return null;
        }
    }

    // 전역 새로고침 함수
    async refreshCurrentData() {
        console.log('🔄 데이터 새로고침 시작');
        
        try {
            // 캐시 클리어
            this.cache.clear();
            
            // 현재 페이지의 데이터 로딩 함수 찾기
            const refreshFunctions = [
                'loadPendingMembers',
                'renderEmployeeList',
                'loadDashboardData',
                'checkPendingMembers',
                'loadUserSettings',
                'getClientCompanies',
                'getWorkLogs'
            ];

            for (const funcName of refreshFunctions) {
                if (typeof window[funcName] === 'function') {
                    console.log(`🔄 ${funcName} 실행 중...`);
                    try {
                        await window[funcName]();
                    } catch (error) {
                        console.warn(`⚠️ ${funcName} 실행 실패:`, error);
                    }
                }
            }
            
            console.log('✅ 데이터 새로고침 완료');
            
        } catch (error) {
            console.error('❌ 데이터 새로고침 실패:', error);
            this.showError('데이터 새로고침에 실패했습니다.');
        }
    }

    // 특정 키의 캐시 데이터 삭제
    clearCachedData(key) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
            console.log(`🗑️ 캐시 삭제됨: ${key}`);
        }
    }

    // 모든 캐시 삭제
    clearAllCache() {
        this.cache.clear();
        console.log('🗑️ 모든 캐시 삭제됨');
    }
}

// 전역 인스턴스 생성
window.dataStability = new DataStabilityManager();

// 전역 함수로 내보내기
window.refreshCurrentData = () => window.dataStability.refreshCurrentData();
window.safeLoadData = (loadFunction, cacheKey, defaultValue) => 
    window.dataStability.safeLoadData(loadFunction, cacheKey, defaultValue);
window.getCurrentUserSafely = () => window.dataStability.getCurrentUserSafely();
window.clearCachedData = (key) => window.dataStability.clearCachedData(key);
window.clearAllCache = () => window.dataStability.clearAllCache();

console.log('✅ DataStabilityManager 초기화 완료');