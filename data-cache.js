// 데이터 캐시 매니저
class DataCacheManager {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5분
        this.storageKey = 'namkyung_data_cache';
        this.loadFromStorage();
    }

    // 로컬 스토리지에서 캐시 로드
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                // 만료되지 않은 데이터만 로드
                Object.entries(data).forEach(([key, value]) => {
                    if (value.expiry > Date.now()) {
                        this.cache.set(key, value);
                    }
                });
            }
        } catch (error) {
            console.error('캐시 로드 오류:', error);
        }
    }

    // 로컬 스토리지에 캐시 저장
    saveToStorage() {
        try {
            const data = {};
            this.cache.forEach((value, key) => {
                data[key] = value;
            });
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('캐시 저장 오류:', error);
            // 스토리지 용량 초과 시 오래된 캐시 삭제
            if (error.name === 'QuotaExceededError') {
                this.clearExpired();
                this.saveToStorage();
            }
        }
    }

    // 캐시 키 생성
    generateKey(type, userId, params = {}) {
        const paramStr = Object.entries(params)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join('|');
        return `${type}_${userId}_${paramStr}`;
    }

    // 캐시 저장
    set(key, data, customExpiry = null) {
        const expiry = Date.now() + (customExpiry || this.cacheExpiry);
        this.cache.set(key, {
            data: data,
            expiry: expiry,
            timestamp: Date.now()
        });
        this.saveToStorage();
    }

    // 캐시 조회
    get(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        // 만료 확인
        if (cached.expiry < Date.now()) {
            this.cache.delete(key);
            this.saveToStorage();
            return null;
        }
        
        return cached.data;
    }

    // 캐시 존재 여부 확인
    has(key) {
        const cached = this.cache.get(key);
        if (!cached) return false;
        
        if (cached.expiry < Date.now()) {
            this.cache.delete(key);
            this.saveToStorage();
            return false;
        }
        
        return true;
    }

    // 특정 패턴의 캐시 삭제
    clearPattern(pattern) {
        const keysToDelete = [];
        this.cache.forEach((value, key) => {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => this.cache.delete(key));
        this.saveToStorage();
    }

    // 만료된 캐시 정리
    clearExpired() {
        const now = Date.now();
        const keysToDelete = [];
        this.cache.forEach((value, key) => {
            if (value.expiry < now) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => this.cache.delete(key));
        this.saveToStorage();
    }

    // 전체 캐시 초기화
    clear() {
        this.cache.clear();
        localStorage.removeItem(this.storageKey);
    }

    // 캐시 통계
    getStats() {
        const stats = {
            totalItems: this.cache.size,
            totalSize: 0,
            oldestItem: null,
            newestItem: null
        };
        
        this.cache.forEach((value, key) => {
            const size = JSON.stringify(value).length;
            stats.totalSize += size;
            
            if (!stats.oldestItem || value.timestamp < stats.oldestItem.timestamp) {
                stats.oldestItem = { key, timestamp: value.timestamp };
            }
            
            if (!stats.newestItem || value.timestamp > stats.newestItem.timestamp) {
                stats.newestItem = { key, timestamp: value.timestamp };
            }
        });
        
        return stats;
    }
}

// 전역 캐시 매니저 인스턴스
window.dataCache = new DataCacheManager();

// 캐시된 데이터 로더
class CachedDataLoader {
    constructor() {
        this.cache = window.dataCache;
    }

    // 업체 목록 로드 (캐시 우선)
    async loadCompanies(userId, forceRefresh = false) {
        const cacheKey = this.cache.generateKey('companies', userId);
        
        // 강제 새로고침이 아니고 캐시가 있으면 캐시 사용
        if (!forceRefresh && this.cache.has(cacheKey)) {
            console.log('📦 캐시에서 업체 목록 로드');
            return this.cache.get(cacheKey);
        }
        
        // DB에서 로드
        console.log('🔄 데이터베이스에서 업체 목록 로드');
        try {
            const companies = await window.dataLoader.loadCompanies(userId);
            // 캐시에 저장
            this.cache.set(cacheKey, companies);
            return companies;
        } catch (error) {
            // 오류 발생 시 캐시 데이터 반환 (있으면)
            const cached = this.cache.get(cacheKey);
            if (cached) {
                console.log('⚠️ DB 오류, 캐시 데이터 사용');
                return cached;
            }
            throw error;
        }
    }

    // 업체 검색 (캐시 사용)
    async searchCompanies(region, companyName, userId, forceRefresh = false) {
        const cacheKey = this.cache.generateKey('search', userId, { region, companyName });
        
        if (!forceRefresh && this.cache.has(cacheKey)) {
            console.log('📦 캐시에서 검색 결과 로드');
            return this.cache.get(cacheKey);
        }
        
        console.log('🔄 데이터베이스에서 검색');
        try {
            await window.db.client.rpc('set_current_user_id', { user_id: userId.toString() });
            const results = await window.db.searchClientCompanies(region, companyName, userId);
            // 검색 결과는 짧은 시간만 캐시 (1분)
            this.cache.set(cacheKey, results, 60 * 1000);
            return results;
        } catch (error) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                console.log('⚠️ DB 오류, 캐시된 검색 결과 사용');
                return cached;
            }
            throw error;
        }
    }

    // 사용자 설정 로드 (캐시 사용)
    async loadUserSettings(userId, forceRefresh = false) {
        const cacheKey = this.cache.generateKey('settings', userId);
        
        if (!forceRefresh && this.cache.has(cacheKey)) {
            console.log('📦 캐시에서 사용자 설정 로드');
            return this.cache.get(cacheKey);
        }
        
        console.log('🔄 데이터베이스에서 사용자 설정 로드');
        try {
            const settings = await window.dataLoader.loadUserSettings(userId);
            // 설정은 10분간 캐시
            this.cache.set(cacheKey, settings, 10 * 60 * 1000);
            return settings;
        } catch (error) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                console.log('⚠️ DB 오류, 캐시된 설정 사용');
                return cached;
            }
            throw error;
        }
    }

    // 업체 생성/수정/삭제 시 캐시 무효화
    invalidateCompanyCache(userId) {
        this.cache.clearPattern(`companies_${userId}`);
        this.cache.clearPattern(`search_${userId}`);
    }

    // 설정 변경 시 캐시 무효화
    invalidateSettingsCache(userId) {
        this.cache.clearPattern(`settings_${userId}`);
    }
}

// 전역 캐시된 데이터 로더
window.cachedDataLoader = new CachedDataLoader();