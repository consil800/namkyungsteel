// 도메인 관리 시스템
// 멀티 테넌트 아키텍처를 위한 도메인 기반 회사 관리

class DomainManager {
    constructor() {
        this.currentDomain = null;
        this.companies = [];
        this.init();
    }

    async init() {
        // 현재 도메인 감지 (실제 환경에서는 window.location.hostname 사용)
        this.currentDomain = this.detectCurrentDomain();
        
        // 회사 목록 로드
        await this.loadCompanies();
        
        console.log('도메인 관리자 초기화됨:', this.currentDomain);
    }

    // 현재 도메인 감지
    detectCurrentDomain() {
        // 개발 환경에서는 localhost 처리
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // 로컬 개발 시 기본 도메인 사용
            return 'namkyungst.com';
        }
        
        // 실제 도메인 반환
        return hostname;
    }

    // 회사 목록 로드
    async loadCompanies() {
        try {
            if (typeof db !== 'undefined' && db.getCompanies) {
                this.companies = await db.getCompanies();
            } else {
                // 폴백: localStorage에서 로드
                this.companies = JSON.parse(localStorage.getItem('companies') || '[]');
            }
        } catch (error) {
            console.error('회사 목록 로드 오류:', error);
            this.companies = [];
        }
    }

    // 현재 도메인 가져오기
    getCurrentDomain() {
        return this.currentDomain;
    }

    // 도메인으로 회사 찾기
    getCompanyByDomain(domain) {
        return this.companies.find(company => company.domain === domain);
    }

    // 현재 회사 정보 가져오기
    getCurrentCompany() {
        return this.getCompanyByDomain(this.currentDomain);
    }

    // 회사 등록
    async registerCompany(companyData) {
        try {
            // 도메인 중복 체크
            const existingCompany = this.getCompanyByDomain(companyData.domain);
            if (existingCompany) {
                return {
                    success: false,
                    error: '이미 등록된 도메인입니다.'
                };
            }

            // 회사 데이터 구성
            const company = {
                company_name: companyData.companyName,
                domain: companyData.domain,
                website: companyData.website || '',
                email: companyData.email || '',
                phone: companyData.phone || '',
                address: companyData.address || '',
                subscription_plan: companyData.subscription_plan || 'basic',
                is_active: true,
                created_at: new Date().toISOString()
            };

            // 데이터베이스에 저장
            let result;
            if (typeof db !== 'undefined' && db.createCompany) {
                result = await db.createCompany(company);
            } else {
                // 폴백: localStorage에 저장
                const companies = JSON.parse(localStorage.getItem('companies') || '[]');
                company.id = Date.now();
                companies.push(company);
                localStorage.setItem('companies', JSON.stringify(companies));
                result = { success: true, data: company };
            }

            if (result.success) {
                // 관리자 계정 생성
                if (companyData.adminData) {
                    await this.createCompanyAdmin(company.domain, companyData.adminData);
                }

                // 로컬 회사 목록 업데이트
                this.companies.push(result.data);
                
                return {
                    success: true,
                    data: result.data,
                    message: '회사가 성공적으로 등록되었습니다.'
                };
            } else {
                return {
                    success: false,
                    error: result.error || '회사 등록 중 오류가 발생했습니다.'
                };
            }

        } catch (error) {
            console.error('회사 등록 오류:', error);
            return {
                success: false,
                error: '회사 등록 중 오류가 발생했습니다: ' + error.message
            };
        }
    }

    // 회사 관리자 계정 생성
    async createCompanyAdmin(companyDomain, adminData) {
        try {
            const admin = {
                username: adminData.username || adminData.email || 'admin',
                email: adminData.email || `admin@${companyDomain}`,
                password: adminData.password || 'admin123',
                name: adminData.name || '관리자',
                phone: adminData.phone || '',
                department: '경영진',
                position: '관리자',
                role: 'company_admin',
                company_domain: companyDomain,
                is_active: true,
                created_at: new Date().toISOString()
            };

            if (typeof db !== 'undefined' && db.createUser) {
                const result = await db.createUser(admin);
                return result;
            } else {
                // 폴백: localStorage에 저장
                const users = JSON.parse(localStorage.getItem('users') || '[]');
                admin.id = Date.now();
                users.push(admin);
                localStorage.setItem('users', JSON.stringify(users));
                return { success: true, data: admin };
            }

        } catch (error) {
            console.error('관리자 계정 생성 오류:', error);
            return {
                success: false,
                error: '관리자 계정 생성 중 오류가 발생했습니다: ' + error.message
            };
        }
    }

    // 회사 정보 업데이트
    async updateCompany(domain, updateData) {
        try {
            let result;
            if (typeof db !== 'undefined' && db.updateCompany) {
                result = await db.updateCompany(domain, updateData);
            } else {
                // 폴백: localStorage에서 업데이트
                const companies = JSON.parse(localStorage.getItem('companies') || '[]');
                const companyIndex = companies.findIndex(c => c.domain === domain);
                if (companyIndex !== -1) {
                    companies[companyIndex] = { ...companies[companyIndex], ...updateData };
                    localStorage.setItem('companies', JSON.stringify(companies));
                    result = { success: true, data: companies[companyIndex] };
                } else {
                    result = { success: false, error: '회사를 찾을 수 없습니다.' };
                }
            }

            if (result.success) {
                // 로컬 회사 목록 업데이트
                const companyIndex = this.companies.findIndex(c => c.domain === domain);
                if (companyIndex !== -1) {
                    this.companies[companyIndex] = { ...this.companies[companyIndex], ...updateData };
                }
            }

            return result;

        } catch (error) {
            console.error('회사 정보 업데이트 오류:', error);
            return {
                success: false,
                error: '회사 정보 업데이트 중 오류가 발생했습니다: ' + error.message
            };
        }
    }

    // 회사 삭제
    async deleteCompany(domain) {
        try {
            let result;
            if (typeof db !== 'undefined' && db.deleteCompany) {
                result = await db.deleteCompany(domain);
            } else {
                // 폴백: localStorage에서 삭제
                const companies = JSON.parse(localStorage.getItem('companies') || '[]');
                const filteredCompanies = companies.filter(c => c.domain !== domain);
                localStorage.setItem('companies', JSON.stringify(filteredCompanies));
                result = { success: true };
            }

            if (result.success) {
                // 로컬 회사 목록에서도 제거
                this.companies = this.companies.filter(c => c.domain !== domain);
                
                // 관련된 사용자들도 삭제
                await this.deleteCompanyUsers(domain);
            }

            return result;

        } catch (error) {
            console.error('회사 삭제 오류:', error);
            return {
                success: false,
                error: '회사 삭제 중 오류가 발생했습니다: ' + error.message
            };
        }
    }

    // 회사 소속 사용자들 삭제
    async deleteCompanyUsers(domain) {
        try {
            if (typeof db !== 'undefined' && db.getUsers) {
                const users = await db.getUsers(domain);
                for (const user of users) {
                    await db.deleteUser(user.id);
                }
            } else {
                // 폴백: localStorage에서 삭제
                const users = JSON.parse(localStorage.getItem('users') || '[]');
                const filteredUsers = users.filter(u => u.company_domain !== domain);
                localStorage.setItem('users', JSON.stringify(filteredUsers));
            }
        } catch (error) {
            console.error('회사 사용자 삭제 오류:', error);
        }
    }

    // 도메인 유효성 검사
    isValidDomain(domain) {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        return domainRegex.test(domain);
    }

    // 서브도메인 지원 (예: company1.platform.com)
    extractCompanyFromSubdomain() {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        
        if (parts.length >= 3) {
            // 서브도메인이 있는 경우
            return parts[0];
        }
        
        return null;
    }

    // 회사별 설정 가져오기
    getCompanySettings(domain = null) {
        const targetDomain = domain || this.currentDomain;
        const company = this.getCompanyByDomain(targetDomain);
        
        if (!company) {
            return null;
        }

        return {
            companyName: company.company_name,
            domain: company.domain,
            website: company.website,
            theme: company.theme || 'default',
            logo: company.logo_url || '',
            primaryColor: company.primary_color || '#667eea',
            secondaryColor: company.secondary_color || '#764ba2'
        };
    }

    // 회사별 브랜딩 적용
    applyCompanyBranding(domain = null) {
        const settings = this.getCompanySettings(domain);
        
        if (!settings) {
            return;
        }

        // 회사명 업데이트
        const titleElements = document.querySelectorAll('.company-name, #companyName');
        titleElements.forEach(el => {
            el.textContent = settings.companyName;
        });

        // 로고 업데이트
        if (settings.logo) {
            const logoElements = document.querySelectorAll('.company-logo');
            logoElements.forEach(el => {
                el.src = settings.logo;
            });
        }

        // 컬러 테마 적용
        if (settings.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
        }
        
        if (settings.secondaryColor) {
            document.documentElement.style.setProperty('--secondary-color', settings.secondaryColor);
        }

        console.log('회사 브랜딩 적용됨:', settings.companyName);
    }

    // 다중 도메인 지원을 위한 라우팅
    routeByDomain() {
        const company = this.getCurrentCompany();
        
        if (!company) {
            // 등록되지 않은 도메인인 경우
            console.warn('등록되지 않은 도메인:', this.currentDomain);
            return false;
        }

        if (!company.is_active) {
            // 비활성화된 회사인 경우
            console.warn('비활성화된 회사:', company.company_name);
            return false;
        }

        // 회사별 브랜딩 적용
        this.applyCompanyBranding();
        
        return true;
    }

    // 통계 정보
    getStatistics() {
        return {
            totalCompanies: this.companies.length,
            activeCompanies: this.companies.filter(c => c.is_active !== false).length,
            inactiveCompanies: this.companies.filter(c => c.is_active === false).length,
            companiesByPlan: {
                basic: this.companies.filter(c => c.subscription_plan === 'basic').length,
                pro: this.companies.filter(c => c.subscription_plan === 'pro').length,
                enterprise: this.companies.filter(c => c.subscription_plan === 'enterprise').length
            }
        };
    }
}

// 전역 도메인 매니저 인스턴스
const domainManager = new DomainManager();

// 전역 함수로 내보내기
window.domainManager = domainManager;

// DOM 로드 완료 후 라우팅 실행
document.addEventListener('DOMContentLoaded', function() {
    // 도메인 기반 라우팅 실행
    setTimeout(() => {
        const isValidDomain = domainManager.routeByDomain();
        if (isValidDomain) {
            console.log('✅ 도메인 라우팅 완료:', domainManager.currentDomain);
        }
    }, 500);
});