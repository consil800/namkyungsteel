// 관리자 시스템 공통 JavaScript
class AdminSystem {
    constructor() {
        this.currentUser = null;
        this.templateId = null;
        this.init();
    }

    init() {
        // 현재 템플릿 ID 확인
        const pathParts = window.location.pathname.split('/');
        const templateIndex = pathParts.indexOf('2-templates');
        if (templateIndex !== -1 && pathParts[templateIndex + 1]) {
            this.templateId = pathParts[templateIndex + 1];
        }

        // 사용자 정보 로드
        this.loadCurrentUser();
        
        // 관리자 버튼 추가
        this.addAdminButton();
    }

    loadCurrentUser() {
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }

    addAdminButton() {
        // 이미 버튼이 있으면 제거
        const existingBtn = document.getElementById('adminSystemBtn');
        if (existingBtn) {
            existingBtn.remove();
        }

        const adminBtn = document.createElement('div');
        adminBtn.id = 'adminSystemBtn';
        adminBtn.innerHTML = `
            <button style="
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 10000;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 25px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
                font-family: 'Noto Sans KR', sans-serif;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(102, 126, 234, 0.6)'" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)'"
               onclick="adminSystem.showAdminPanel()">
                <i class="fas fa-cog"></i> 관리자 설정
            </button>
        `;
        document.body.appendChild(adminBtn);
    }

    showAdminPanel() {
        // 로그인 확인
        if (!this.currentUser) {
            this.showLoginModal();
            return;
        }

        // 권한 확인
        if (!this.hasAdminPermission()) {
            alert('관리자 권한이 필요합니다.');
            return;
        }

        this.openAdminDashboard();
    }

    hasAdminPermission() {
        if (!this.currentUser) return false;
        const adminRoles = ['master', 'company_admin', 'company_manager'];
        return adminRoles.includes(this.currentUser.role);
    }

    showLoginModal() {
        const modal = document.createElement('div');
        modal.id = 'adminLoginModal';
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Noto Sans KR', sans-serif;
            ">
                <div style="
                    background: white;
                    padding: 2rem;
                    border-radius: 10px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                    position: relative;
                ">
                    <button onclick="adminSystem.closeLoginModal()" style="
                        position: absolute;
                        top: 1rem;
                        right: 1rem;
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        cursor: pointer;
                        color: #666;
                    ">&times;</button>
                    
                    <h2 style="margin-top: 0; color: #333;">관리자 로그인</h2>
                    <p style="color: #666; margin-bottom: 1.5rem;">관리자 설정에 접근하려면 로그인이 필요합니다.</p>
                    
                    <form onsubmit="adminSystem.handleLogin(event); return false;">
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; color: #555; font-weight: 500;">이메일</label>
                            <input type="email" id="adminLoginEmail" required style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-size: 1rem;
                                box-sizing: border-box;
                            ">
                        </div>
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; color: #555; font-weight: 500;">비밀번호</label>
                            <input type="password" id="adminLoginPassword" required style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-size: 1rem;
                                box-sizing: border-box;
                            ">
                        </div>
                        <button type="submit" style="
                            width: 100%;
                            padding: 0.75rem;
                            background: linear-gradient(135deg, #667eea, #764ba2);
                            color: white;
                            border: none;
                            border-radius: 5px;
                            font-size: 1rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        ">로그인</button>
                    </form>
                    
                    <div style="
                        margin-top: 1.5rem;
                        padding-top: 1.5rem;
                        border-top: 1px solid #eee;
                        text-align: center;
                    ">
                        <p style="margin-bottom: 0.5rem; color: #666; font-size: 0.9rem;">데모 계정:</p>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center;">
                            <button onclick="adminSystem.demoLogin('master')" style="
                                padding: 0.5rem 1rem;
                                background: #f8f9fa;
                                border: 1px solid #dee2e6;
                                border-radius: 5px;
                                font-size: 0.875rem;
                                cursor: pointer;
                                transition: all 0.3s ease;
                            ">마스터</button>
                            <button onclick="adminSystem.demoLogin('admin')" style="
                                padding: 0.5rem 1rem;
                                background: #f8f9fa;
                                border: 1px solid #dee2e6;
                                border-radius: 5px;
                                font-size: 0.875rem;
                                cursor: pointer;
                                transition: all 0.3s ease;
                            ">회사 대표</button>
                            <button onclick="adminSystem.demoLogin('manager')" style="
                                padding: 0.5rem 1rem;
                                background: #f8f9fa;
                                border: 1px solid #dee2e6;
                                border-radius: 5px;
                                font-size: 0.875rem;
                                cursor: pointer;
                                transition: all 0.3s ease;
                            ">관리자</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    closeLoginModal() {
        const modal = document.getElementById('adminLoginModal');
        if (modal) {
            modal.remove();
        }
    }

    handleLogin(event) {
        event.preventDefault();
        const email = document.getElementById('adminLoginEmail').value;
        const password = document.getElementById('adminLoginPassword').value;
        
        if (typeof AuthManager !== 'undefined') {
            const result = AuthManager.login(email, password);
            if (result.success) {
                this.currentUser = result.user;
                this.closeLoginModal();
                this.openAdminDashboard();
            } else {
                alert(result.message);
            }
        } else {
            alert('로그인 시스템 오류가 발생했습니다.');
        }
    }

    demoLogin(type) {
        // 하드코딩된 마스터 계정 제거 - 데이터베이스 기반 인증만 사용
        console.log('데모 로그인이 비활성화되었습니다. 실제 계정으로 로그인하세요.');
        return false;
        
        let email, password;
        switch(type) {
            case 'master':
                // 하드코딩된 계정 제거됨
                return false;
            case 'admin':
                email = 'ceo@seokyoung.com';
                password = 'demo123';
                break;
            case 'manager':
                email = 'admin@seokyoung.com';
                password = 'demo123';
                break;
        }
        
        if (typeof AuthManager !== 'undefined') {
            const result = AuthManager.login(email, password);
            if (result.success) {
                this.currentUser = result.user;
                this.closeLoginModal();
                this.openAdminDashboard();
            }
        }
    }

    openAdminDashboard() {
        // 템플릿 ID 저장
        if (this.templateId) {
            localStorage.setItem('currentTemplateId', this.templateId);
        }
        
        // 관리자 대시보드로 이동
        window.location.href = '../../2-member-management/admin/admin-dashboard.html';
    }
}

// 전역 인스턴스 생성
window.adminSystem = new AdminSystem();