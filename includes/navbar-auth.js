// 네비바 로그인 상태 관리 스크립트
console.log('🔧 navbar-auth.js: 스크립트 로드됨');

// 로그인 상태 확인 및 네비바 업데이트
function checkAndUpdateNavbarLoginState() {
    console.log('🔍 네비바: 로그인 상태 확인 시작');
    
    const currentUser = getCurrentUserFromSessionStorage();
    console.log('🔍 네비바: sessionStorage에서 가져온 사용자:', currentUser);
    
    // 네비바 요소들이 존재하는지 확인
    const loginBtn = document.getElementById('mainLoginBtn');
    const userProfile = document.getElementById('userProfile');
    console.log('🔍 네비바: 요소 확인', {
        loginBtn: !!loginBtn,
        userProfile: !!userProfile,
        loginBtnDisplay: loginBtn ? loginBtn.style.display : 'not found',
        userProfileDisplay: userProfile ? userProfile.style.display : 'not found'
    });
    
    if (currentUser && currentUser.name) {
        console.log('✅ 네비바: 로그인된 사용자 확인됨:', currentUser.name);
        updateNavbarForLoggedInUser(currentUser);
    } else {
        console.log('ℹ️ 네비바: 로그인되지 않은 상태');
        updateNavbarForLoggedOutUser();
    }
}

// sessionStorage에서 사용자 정보 가져오기
function getCurrentUserFromSessionStorage() {
    try {
        const userJson = sessionStorage.getItem('currentUser');
        if (!userJson) return null;
        
        const user = JSON.parse(userJson);
        return user;
    } catch (error) {
        console.error('❌ 네비바: 사용자 정보 파싱 오류:', error);
        return null;
    }
}

// 로그인된 사용자용 네비바 업데이트
function updateNavbarForLoggedInUser(user) {
    console.log('🔄 네비바: 로그인 상태로 업데이트 시작', user);
    
    const loginBtn = document.getElementById('mainLoginBtn');
    const userProfile = document.getElementById('userProfile');
    const profileImage = document.getElementById('profileImage');
    const profileName = document.getElementById('profileName');
    
    console.log('🔄 네비바: 요소 찾기 결과', {
        loginBtn: !!loginBtn,
        userProfile: !!userProfile,
        profileImage: !!profileImage,
        profileName: !!profileName
    });
    
    if (loginBtn && userProfile) {
        // 로그인 버튼 숨기고 프로필 표시
        loginBtn.style.display = 'none';
        userProfile.style.display = 'flex';
        
        console.log('✅ 네비바: 버튼 표시 상태 변경 완료', {
            loginBtnDisplay: loginBtn.style.display,
            userProfileDisplay: userProfile.style.display
        });
        
        // 프로필 이미지 설정
        if (profileImage) {
            if (user.profileImage || user.profile_image) {
                profileImage.src = user.profileImage || user.profile_image;
            } else {
                // 기본 아바타 생성
                profileImage.src = generateNavbarDefaultAvatar(user.name || user.email || 'User');
            }
            console.log('🖼️ 네비바: 프로필 이미지 설정 완료');
        }
        
        // 사용자 이름 설정
        if (profileName) {
            profileName.textContent = user.name || user.email || '사용자';
            console.log('👤 네비바: 사용자 이름 설정 완료:', profileName.textContent);
        }
    } else {
        console.error('❌ 네비바: 필수 요소를 찾을 수 없음');
    }
}

// 로그아웃 상태용 네비바 업데이트
function updateNavbarForLoggedOutUser() {
    console.log('🔄 네비바: 로그아웃 상태로 업데이트 시작');
    
    const loginBtn = document.getElementById('mainLoginBtn');
    const userProfile = document.getElementById('userProfile');
    
    if (loginBtn && userProfile) {
        // 프로필 숨기고 로그인 버튼 표시
        loginBtn.style.display = 'flex';
        userProfile.style.display = 'none';
        
        console.log('✅ 네비바: 로그아웃 상태 업데이트 완료', {
            loginBtnDisplay: loginBtn.style.display,
            userProfileDisplay: userProfile.style.display
        });
    } else {
        console.error('❌ 네비바: 로그아웃 업데이트 - 필수 요소를 찾을 수 없음');
    }
}

// 네비바용 기본 아바타 생성
function generateNavbarDefaultAvatar(name) {
    const initial = name ? name.charAt(0).toUpperCase() : 'U';
    const safeInitial = /^[A-Za-z가-힣]/.test(initial) ? initial : 'U';
    
    const svgContent = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="20" fill="#667eea"/>
        <text x="20" y="26" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="central">${safeInitial}</text>
    </svg>`;
    
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}

// 네비바 로그인 모달 표시 함수 (각 페이지에서 정의된 함수 호출)
function showLoginModal() {
    if (window.showLoginModal && typeof window.showLoginModal === 'function') {
        window.showLoginModal();
    } else {
        // 기본 로그인 페이지로 이동
        window.location.href = 'login.html';
    }
}

// 네비바 프로필 클릭 함수 (각 페이지에서 정의된 함수 호출)
function handleProfileClick() {
    if (window.handleProfileClick && typeof window.handleProfileClick === 'function') {
        window.handleProfileClick();
    } else if (window.showProfileModal && typeof window.showProfileModal === 'function') {
        window.showProfileModal();
    } else {
        // 기본 대시보드로 이동
        window.location.href = 'employee-dashboard.html';
    }
}

// 전역 함수로 네비바 상태 업데이트 함수 노출
window.updateNavbarLoginState = checkAndUpdateNavbarLoginState;

// 다양한 시점에서 로그인 상태 확인
setTimeout(checkAndUpdateNavbarLoginState, 100);
setTimeout(checkAndUpdateNavbarLoginState, 500);
setTimeout(checkAndUpdateNavbarLoginState, 1000);

// sessionStorage 변경 감지 (다른 탭에서의 로그인/로그아웃 반영)
window.addEventListener('storage', function(e) {
    if (e.key === 'currentUser') {
        checkAndUpdateNavbarLoginState();
    }
});

console.log('✅ navbar-auth.js: 초기화 완료');