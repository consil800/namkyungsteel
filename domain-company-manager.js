// 도메인별 회사 정보 자동 설정 관리자
class DomainCompanyManager {
    constructor() {
        this.companyMappings = {
            'namkyungsteel.com': {
                companyName: '남경스틸(주)',
                domain: 'namkyungsteel.com',
                displayName: '남경스틸(주)',
                companyType: 'steel',
                defaultRole: 'employee',
                departments: ['영업부', '생산부', '품질관리부', '관리부', '기술부'],
                positions: ['사원', '주임', '대리', '과장', '차장', '부장', '이사']
            },
            'localhost': {
                companyName: '남경스틸(주)',
                domain: 'namkyungsteel.com',
                displayName: '남경스틸(주)',
                companyType: 'steel',
                defaultRole: 'employee',
                departments: ['영업부', '생산부', '품질관리부', '관리부', '기술부'],
                positions: ['사원', '주임', '대리', '과장', '차장', '부장', '이사']
            },
            '127.0.0.1': {
                companyName: '남경스틸(주)',
                domain: 'namkyungsteel.com',
                displayName: '남경스틸(주)',
                companyType: 'steel',
                defaultRole: 'employee',
                departments: ['영업부', '생산부', '품질관리부', '관리부', '기술부'],
                positions: ['사원', '주임', '대리', '과장', '차장', '부장', '이사']
            }
        };
    }

    // 현재 도메인 기반으로 회사 정보 가져오기
    getCurrentCompanyInfo() {
        const hostname = window.location.hostname;
        console.log('🌐 현재 도메인:', hostname);
        
        // 정확한 도메인 매칭
        if (this.companyMappings[hostname]) {
            console.log('✅ 도메인 매칭 성공:', this.companyMappings[hostname]);
            return this.companyMappings[hostname];
        }
        
        // 하위 도메인 또는 포트가 있는 경우 처리
        for (const domain in this.companyMappings) {
            if (hostname.includes(domain) || domain.includes(hostname)) {
                console.log('✅ 유사 도메인 매칭:', this.companyMappings[domain]);
                return this.companyMappings[domain];
            }
        }
        
        // 기본값 (남경스틸)
        console.log('⚠️ 도메인 매칭 실패, 기본값 사용');
        return this.companyMappings['namkyungsteel.com'];
    }

    // 회사 정보로 사용자 데이터 보강
    enhanceUserData(userData) {
        const companyInfo = this.getCurrentCompanyInfo();
        
        return {
            ...userData,
            company_domain: companyInfo.domain,
            company_name: companyInfo.companyName,
            role: userData.role || companyInfo.defaultRole
        };
    }

    // HTML 요소에 회사 정보 적용
    updatePageWithCompanyInfo() {
        const companyInfo = this.getCurrentCompanyInfo();
        
        // 페이지 타이틀 업데이트
        const titleElements = document.querySelectorAll('title, #companyNameHeader, .sitename');
        titleElements.forEach(element => {
            if (element.tagName === 'TITLE') {
                element.textContent = element.textContent.replace(/남경스틸\(주\)/, companyInfo.displayName);
            } else {
                element.textContent = companyInfo.displayName;
            }
        });

        // 부서 옵션 업데이트
        const departmentSelects = document.querySelectorAll('#registerDepartment, select[id*="department"]');
        departmentSelects.forEach(select => {
            // 기존 옵션 지우기 (첫 번째 옵션 제외)
            while (select.options.length > 1) {
                select.remove(1);
            }
            
            // 새 부서 옵션 추가
            companyInfo.departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                select.appendChild(option);
            });
        });

        console.log('✅ 페이지에 회사 정보 적용 완료:', companyInfo.displayName);
    }

    // 로그인 시 회사 정보 검증
    validateUserCompany(user) {
        const companyInfo = this.getCurrentCompanyInfo();
        
        // 사용자의 회사 도메인이 현재 도메인과 일치하는지 확인
        if (user.company_domain && user.company_domain !== companyInfo.domain) {
            console.log('⚠️ 회사 도메인 불일치:', {
                사용자_도메인: user.company_domain,
                현재_도메인: companyInfo.domain
            });
            return false;
        }
        
        return true;
    }
}

// 전역 인스턴스 생성
const domainCompanyManager = new DomainCompanyManager();

// 페이지 로드 시 자동 적용
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        domainCompanyManager.updatePageWithCompanyInfo();
    }, 100);
});

// 전역 접근을 위해 window에 추가
window.domainCompanyManager = domainCompanyManager;