// 템플릿 로그인 기능
document.addEventListener('DOMContentLoaded', function() {
    // 기존 로그인 버튼에 이벤트 연결
    setupExistingLoginButtons();
});

// 기존 로그인 버튼에 이벤트 연결
function setupExistingLoginButtons() {
    // 기존 헤더의 로그인 버튼 찾기
    const existingLoginBtns = document.querySelectorAll('.login-btn');
    
    existingLoginBtns.forEach(btn => {
        // 기존 onclick 이벤트 제거하고 새로운 이벤트 연결
        btn.removeAttribute('onclick');
        btn.href = '#';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            showTemplateLoginModal();
        });
    });
}

// 로그인 모달 표시
function showTemplateLoginModal() {
    // 현재 템플릿 ID 저장
    const pathParts = window.location.pathname.split('/');
    const templateIndex = pathParts.indexOf('2-templates');
    if (templateIndex !== -1 && pathParts[templateIndex + 1]) {
        localStorage.setItem('currentTemplateId', pathParts[templateIndex + 1]);
    }
    
    const modal = document.createElement('div');
    modal.id = 'loginModal';
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Noto Sans KR', sans-serif;
        ">
            <div style="
                background: white;
                padding: 2rem;
                border-radius: 10px;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                position: relative;
            ">
                <button onclick="closeLoginModal()" style="
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #666;
                    z-index: 1;
                ">&times;</button>
                
                <!-- 탭 메뉴 -->
                <div style="
                    display: flex;
                    margin-bottom: 30px;
                    border-radius: 10px;
                    overflow: hidden;
                    border: 2px solid #e1e5e9;
                ">
                    <button onclick="switchModalTab('login')" id="modalLoginTab" style="
                        flex: 1;
                        padding: 12px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">로그인</button>
                    <button onclick="switchModalTab('register')" id="modalRegisterTab" style="
                        flex: 1;
                        padding: 12px;
                        background: #f8f9fa;
                        color: #333;
                        border: none;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">회원가입</button>
                </div>
                
                <!-- 로그인 폼 -->
                <div id="modalLoginForm" style="display: block;">
                    <h2 style="margin-top: 0; color: #333;">로그인</h2>
                    <p style="color: #666; margin-bottom: 1.5rem;">직원 시스템에 접속하려면 로그인이 필요합니다.</p>
                    
                    <form onsubmit="handleTemplateLogin(event); return false;">
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; color: #555; font-weight: 500;">이메일</label>
                            <input type="email" id="loginEmail" required style="
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
                            <input type="password" id="loginPassword" required style="
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
                </div>
                
                <!-- 회원가입 폼 -->
                <div id="modalRegisterForm" style="display: none;">
                    <h2 style="margin-top: 0; color: #333;">회원가입</h2>
                    <p style="color: #666; margin-bottom: 1.5rem;">새 계정을 만들어 직원 시스템을 이용하세요.</p>
                    
                    <form onsubmit="handleTemplateRegister(event); return false;">
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; color: #555; font-weight: 500;">이름 *</label>
                            <input type="text" id="registerName" required style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-size: 1rem;
                                box-sizing: border-box;
                            ">
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; color: #555; font-weight: 500;">이메일 *</label>
                            <input type="email" id="registerEmail" required style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-size: 1rem;
                                box-sizing: border-box;
                            ">
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; color: #555; font-weight: 500;">비밀번호 *</label>
                            <input type="password" id="registerPassword" required style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-size: 1rem;
                                box-sizing: border-box;
                            ">
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; color: #555; font-weight: 500;">연락처</label>
                            <input type="tel" id="registerPhone" style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-size: 1rem;
                                box-sizing: border-box;
                            ">
                        </div>
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; color: #555; font-weight: 500;">부서</label>
                            <select id="registerDepartment" style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-size: 1rem;
                                box-sizing: border-box;
                            ">
                                <option value="">부서를 선택하세요</option>
                                <option value="영업부">영업부</option>
                                <option value="생산부">생산부</option>
                                <option value="품질관리부">품질관리부</option>
                                <option value="관리부">관리부</option>
                                <option value="기술부">기술부</option>
                            </select>
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
                        ">회원가입</button>
                    </form>
                </div>
                
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 로그인 모달 닫기
function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.remove();
    }
}

// 모달 탭 전환 함수
function switchModalTab(tab) {
    console.log('모달 탭 전환:', tab);
    
    // 탭 버튼 스타일 변경
    const loginTab = document.getElementById('modalLoginTab');
    const registerTab = document.getElementById('modalRegisterTab');
    const loginForm = document.getElementById('modalLoginForm');
    const registerForm = document.getElementById('modalRegisterForm');
    
    if (tab === 'login') {
        // 로그인 탭 활성화
        loginTab.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        loginTab.style.color = 'white';
        registerTab.style.background = '#f8f9fa';
        registerTab.style.color = '#333';
        
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else if (tab === 'register') {
        // 회원가입 탭 활성화
        registerTab.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        registerTab.style.color = 'white';
        loginTab.style.background = '#f8f9fa';
        loginTab.style.color = '#333';
        
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
}

// 로그인 처리
async function handleTemplateLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // AuthManager를 사용하여 로그인 시도
    if (typeof AuthManager !== 'undefined') {
        try {
            const result = await AuthManager.login(email, password);
            
            if (result.success) {
                // 로그인 성공
                closeLoginModal();
                
                // 역할에 따라 리다이렉트
                if (result.user.role === 'master_admin') {
                    window.location.href = 'master-dashboard.html';
                } else {
                    window.location.href = 'employee-dashboard.html';
                }
                return;
            } else {
                // 로그인 실패
                alert(result.message || '로그인에 실패했습니다.');
                return;
            }
        } catch (error) {
            console.error('로그인 오류:', error);
            alert('로그인 중 오류가 발생했습니다.');
            return;
        }
    }
    
    // AuthManager가 로드되지 않았을 경우 폴백 처리
    alert('로그인 시스템을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
}

// 회원가입 처리 함수
function handleTemplateRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const phone = document.getElementById('registerPhone').value;
    const department = document.getElementById('registerDepartment').value;
    
    // 유효성 검사
    if (!name || !email || !password) {
        alert('필수 항목을 모두 입력해주세요.');
        return;
    }
    
    if (password.length < 6) {
        alert('비밀번호는 6자 이상이어야 합니다.');
        return;
    }
    
    // 회원가입 처리
    try {
        // 새 사용자 정보 생성
        const newUser = {
            id: Date.now(),
            name: name,
            email: email,
            password: password,
            phone: phone,
            department: department,
            role: 'employee',
            registeredAt: new Date().toISOString(),
            status: 'active'
        };
        
        // 기존 사용자 목록 가져오기
        let users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        
        // 이메일 중복 체크
        if (users.some(user => user.email === email)) {
            alert('이미 등록된 이메일입니다.');
            return;
        }
        
        // 새 사용자 추가
        users.push(newUser);
        localStorage.setItem('registeredUsers', JSON.stringify(users));
        
        alert('회원가입이 완료되었습니다! 로그인 탭에서 로그인해주세요.');
        
        // 로그인 탭으로 전환
        switchModalTab('login');
        
        // 로그인 폼에 이메일 자동 입력
        document.getElementById('loginEmail').value = email;
        
    } catch (error) {
        console.error('회원가입 오류:', error);
        alert('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}

