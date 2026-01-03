// 모든 페이지의 네비게이션 바를 표준화하는 스크립트

const fs = require('fs');
const path = require('path');

// 업데이트할 파일 목록
const filesToUpdate = [
    'location.html',
    'product-inquiry.html', 
    'technical-support.html',
    'steel-manufacturing.html',
    'processing-service.html',
    'tech-research.html',
    'ceo-message.html',
    'company-history.html',
    'vision-mission.html',
    'organization.html',
    'certificates.html',
    'service1-details.html',
    'service2-details.html',
    'service3-details.html',
    'service4-details.html'
];

// 표준 네비게이션 바 HTML
const standardNavbar = `    <header id="header" class="header d-flex align-items-center sticky-top">
        <div class="container-fluid container-xl position-relative d-flex align-items-center">
            <a href="index.html" class="logo d-flex align-items-center me-auto">
                <img src="logo.jpg" alt="남경스틸 로고" style="height: 40px; margin-right: 10px;">
                <h1 class="sitename" id="companyNameHeader">남경스틸(주)</h1>
            </a>
            
            <nav id="navmenu" class="navmenu">
                <ul>
                    <li><a href="index.html">홈</a></li>
                    <li class="dropdown"><a href="index.html#about"><span>회사소개</span> <i class="bi bi-chevron-down toggle-dropdown"></i></a>
                        <ul>
                            <li><a href="ceo-message.html">CEO 인사말</a></li>
                            <li><a href="company-history.html">회사연혁</a></li>
                            <li><a href="vision-mission.html">비전/미션</a></li>
                            <li><a href="organization.html">조직도</a></li>
                            <li><a href="certificates.html">인증서</a></li>
                        </ul>
                    </li>
                    <li class="dropdown"><a href="index.html#services"><span>제품소개</span> <i class="bi bi-chevron-down toggle-dropdown"></i></a>
                        <ul>
                            <li><a href="service1-details.html">열연강판</a></li>
                            <li><a href="service2-details.html">냉연강판</a></li>
                            <li><a href="service3-details.html">특수강</a></li>
                            <li><a href="service4-details.html">맞춤 가공</a></li>
                        </ul>
                    </li>
                    <li class="dropdown"><a href="#"><span>사업영역</span> <i class="bi bi-chevron-down toggle-dropdown"></i></a>
                        <ul>
                            <li><a href="steel-manufacturing.html">철강제조</a></li>
                            <li><a href="processing-service.html">가공서비스</a></li>
                            <li><a href="tech-research.html">기술연구</a></li>
                        </ul>
                    </li>
                    <li class="dropdown"><a href="#"><span>고객센터</span> <i class="bi bi-chevron-down toggle-dropdown"></i></a>
                        <ul>
                            <li><a href="quote-inquiry.html">견적문의</a></li>
                            <li><a href="catalog.html">카탈로그</a></li>
                            <li><a href="faq.html">FAQ</a></li>
                            <li><a href="location.html">오시는길</a></li>
                            <li><a href="product-inquiry.html">제품문의</a></li>
                            <li><a href="technical-support.html">기술지원</a></li>
                        </ul>
                    </li>
                    <li class="dropdown"><a href="#"><span>홍보센터</span> <i class="bi bi-chevron-down toggle-dropdown"></i></a>
                        <ul>
                            <li><a href="notice.html">공지사항</a></li>
                            <li><a href="newsroom.html">뉴스룸</a></li>
                            <li><a href="media-materials.html">홍보자료</a></li>
                        </ul>
                    </li>
                </ul>
                <i class="mobile-nav-toggle d-xl-none bi bi-list"></i>
            </nav>

            <!-- 로그인 버튼 -->
            <a class="login-btn" href="#" onclick="showLoginModal(); return false;" id="mainLoginBtn">
                <i class="bi bi-person-circle"></i> <span id="loginBtnText">로그인</span>
            </a>
            
            <!-- 로그인 후 프로필 아이콘 -->
            <div class="user-profile" id="userProfile" style="display: none;">
                <div class="profile-icon" onclick="handleProfileClick()">
                    <img id="profileImage" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIyMCIgeT0iMjQiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPvCfkYQ8L3N2Zz4KPC9zdmc+" alt="프로필" />
                    <span class="profile-name" id="profileName">사용자</span>
                </div>
            </div>

        </div>
    </header>`;

// 각 파일 업데이트 함수
function updateFile(filename) {
    try {
        const content = fs.readFileSync(filename, 'utf8');
        
        // 기존 header 찾기 및 교체
        const headerRegex = /<header[^>]*>[\s\S]*?<\/header>/i;
        
        if (headerRegex.test(content)) {
            const updatedContent = content.replace(headerRegex, standardNavbar);
            fs.writeFileSync(filename, updatedContent, 'utf8');
            console.log(`✅ Updated: ${filename}`);
        } else {
            console.log(`⚠️  No header found in: ${filename}`);
        }
    } catch (error) {
        console.log(`❌ Error updating ${filename}:`, error.message);
    }
}

// 모든 파일 업데이트 실행
console.log('🚀 Starting navbar updates...');
filesToUpdate.forEach(updateFile);
console.log('✨ Navbar updates completed!');