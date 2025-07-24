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
    // 모바일 네비게이션 토글 버튼 초기화
    initializeMobileNavigation();
    
    // 드롭다운 메뉴 클릭 기능 (모바일용)
    const dropdownToggles = document.querySelectorAll('.toggle-dropdown');
    
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
}

// 모바일 네비게이션 초기화
function initializeMobileNavigation() {
    const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');
    
    function mobileNavToogle() {
        document.querySelector('body').classList.toggle('mobile-nav-active');
        mobileNavToggleBtn.classList.toggle('bi-list');
        mobileNavToggleBtn.classList.toggle('bi-x');
    }
    
    if (mobileNavToggleBtn) {
        console.log('✅ 모바일 네비게이션 버튼 발견, 이벤트 리스너 추가');
        mobileNavToggleBtn.addEventListener('click', mobileNavToogle);
        
        // 터치 이벤트도 추가 (모바일 디바이스 지원)
        mobileNavToggleBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            mobileNavToogle();
        });
    } else {
        console.warn('⚠️ 모바일 네비게이션 버튼을 찾을 수 없음');
    }
    
    // 모바일 네비게이션 메뉴 항목 클릭 처리
    document.querySelectorAll('#navmenu a').forEach(navmenu => {
        navmenu.addEventListener('click', (e) => {
            if (document.querySelector('.mobile-nav-active')) {
                // 드롭다운 토글이 아닌 일반 링크인 경우에만 메뉴 닫기
                if (!e.target.classList.contains('toggle-dropdown')) {
                    mobileNavToogle();
                }
            }
        });
    });
    
    // 터치 디바이스 지원
    if ('ontouchstart' in window) {
        document.addEventListener('touchstart', function() {}, {passive: true});
        
        // 모바일에서 링크 클릭 이벤트 보장
        document.querySelectorAll('a').forEach(link => {
            link.addEventListener('touchend', function(e) {
                if (this.href && this.href !== '#' && !this.classList.contains('toggle-dropdown')) {
                    // 터치 이벤트 후 클릭 이벤트 방지
                    e.preventDefault();
                    const href = this.href;
                    
                    // 모바일 메뉴가 열려있으면 닫기
                    if (document.querySelector('.mobile-nav-active') && this.closest('#navmenu')) {
                        mobileNavToogle();
                        // 메뉴 닫힌 후 페이지 이동
                        setTimeout(() => {
                            window.location.href = href;
                        }, 300);
                    } else {
                        window.location.href = href;
                    }
                }
            });
        });
    }
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