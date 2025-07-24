// 공통 네비바와 푸터 로드 함수
async function loadNavbar() {
    try {
        const response = await fetch('includes/navbar.html');
        const navbarHTML = await response.text();
        
        // navbar-placeholder가 있으면 그곳에 삽입, 없으면 body 시작 부분에 삽입
        const navbarPlaceholder = document.getElementById('navbar-placeholder');
        if (navbarPlaceholder) {
            navbarPlaceholder.innerHTML = navbarHTML;
            console.log('✅ 네비바 HTML을 navbar-placeholder에 삽입 완료');
        } else {
            // 기존 네비바가 있다면 제거
            const existingHeader = document.querySelector('header');
            if (existingHeader) {
                existingHeader.remove();
            }
            
            // body 시작 부분에 네비바 삽입
            document.body.insertAdjacentHTML('afterbegin', navbarHTML);
            console.log('✅ 네비바 HTML을 body 시작 부분에 삽입 완료');
        }
        
        // 네비바 로드 후 이벤트 리스너 재설정
        initializeNavbar();
        
        // 네비바 인증 스크립트 로드
        loadNavbarAuthScript();
    } catch (error) {
        console.error('네비바 로드 실패:', error);
    }
}

async function loadFooter() {
    try {
        const response = await fetch('includes/footer.html');
        const footerHTML = await response.text();
        
        // 기존 푸터가 있다면 제거
        const existingFooter = document.querySelector('footer');
        if (existingFooter) {
            existingFooter.remove();
        }
        
        // body 끝 부분에 푸터 삽입
        document.body.insertAdjacentHTML('beforeend', footerHTML);
    } catch (error) {
        console.error('푸터 로드 실패:', error);
    }
}

// 네비바 이벤트 리스너 초기화
function initializeNavbar() {
    console.log('🔄 네비바 초기화 시작');
    
    // 드롭다운 메뉴 클릭 기능 (모바일용)
    const dropdownToggles = document.querySelectorAll('.toggle-dropdown');
    console.log('🔍 드롭다운 토글 버튼 발견:', dropdownToggles.length);
    
    dropdownToggles.forEach(function(toggle) {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const dropdown = this.closest('.dropdown');
            const isActive = dropdown.classList.contains('active');
            
            // 다른 모든 드롭다운 닫기
            document.querySelectorAll('.dropdown.active').forEach(function(activeDropdown) {
                if (activeDropdown !== dropdown) {
                    activeDropdown.classList.remove('active');
                }
            });
            
            // 현재 드롭다운 토글
            dropdown.classList.toggle('active', !isActive);
        });
    });
    
    // 외부 클릭 시 드롭다운 닫기
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown.active').forEach(function(dropdown) {
                dropdown.classList.remove('active');
            });
        }
    });
    
    // 현재 페이지에 따라 active 클래스 설정
    setActiveNavItem();
    
    console.log('✅ 네비바 초기화 완료');
}


// 현재 페이지에 따라 네비 메뉴 활성화
function setActiveNavItem() {
    const currentPath = window.location.pathname;
    const fileName = currentPath.split('/').pop() || 'index.html';
    
    // 모든 네비 링크에서 active 클래스 제거
    document.querySelectorAll('.navmenu a').forEach(link => {
        link.classList.remove('active');
    });
    
    // 현재 페이지에 해당하는 링크에 active 클래스 추가
    if (fileName === 'index.html' || fileName === '') {
        const homeLink = document.querySelector('.navmenu a[href="index.html"]');
        if (homeLink) homeLink.classList.add('active');
    } else {
        const currentLink = document.querySelector(`.navmenu a[href="${fileName}"]`);
        if (currentLink) currentLink.classList.add('active');
    }
}

// 페이지 로드 시 네비바와 푸터 로드
document.addEventListener('DOMContentLoaded', async function() {
    await loadNavbar();
    await loadFooter();
    
    // 네비바 로드 완료 후 로그인 상태 확인 (여러 시점에서 시도)
    console.log('🔄 common.js: 컴포넌트 로드 완료');
    
    // 즉시 확인
    setTimeout(function() {
        console.log('🔄 common.js: 100ms 후 네비바 상태 확인');
        if (window.updateNavbarLoginState) {
            window.updateNavbarLoginState();
        } else {
            console.warn('⚠️ updateNavbarLoginState 함수를 찾을 수 없음');
        }
    }, 100);
    
    // 500ms 후 재확인
    setTimeout(function() {
        console.log('🔄 common.js: 500ms 후 네비바 상태 재확인');
        if (window.updateNavbarLoginState) {
            window.updateNavbarLoginState();
        }
    }, 500);
    
    // 1초 후 최종 확인
    setTimeout(function() {
        console.log('🔄 common.js: 1000ms 후 네비바 상태 최종 확인');
        if (window.updateNavbarLoginState) {
            window.updateNavbarLoginState();
        }
    }, 1000);
});

// 네비바 인증 스크립트 동적 로드
function loadNavbarAuthScript() {
    console.log('🔄 네비바 인증 스크립트 로드 시작');
    
    // 이미 로드된 스크립트가 있는지 확인
    if (document.querySelector('script[src*="navbar-auth.js"]')) {
        console.log('⚠️ 네비바 인증 스크립트가 이미 로드됨');
        return;
    }
    
    const script = document.createElement('script');
    script.src = 'includes/navbar-auth.js';
    script.onload = function() {
        console.log('✅ 네비바 인증 스크립트 로드 완료');
    };
    script.onerror = function() {
        console.error('❌ 네비바 인증 스크립트 로드 실패');
    };
    
    document.head.appendChild(script);
}