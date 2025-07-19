// 공통 네비바와 푸터 로드 함수
async function loadNavbar() {
    try {
        const response = await fetch('includes/navbar.html');
        const navbarHTML = await response.text();
        
        // 기존 네비바가 있다면 제거
        const existingHeader = document.querySelector('header');
        if (existingHeader) {
            existingHeader.remove();
        }
        
        // body 시작 부분에 네비바 삽입
        document.body.insertAdjacentHTML('afterbegin', navbarHTML);
        
        // 네비바 로드 후 이벤트 리스너 재설정
        initializeNavbar();
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
});