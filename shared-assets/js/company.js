/**
 * SteelWorks Platform - Company JavaScript
 * 개별 철강회사 홈페이지 기능
 */

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeCompanyWebsite();
});

/**
 * 회사 웹사이트 초기화
 */
function initializeCompanyWebsite() {
    initializeNavigation();
    initializeScrollEffects();
    initializeHeroAnimations();
    initializeContactForm();
    initializeFloatingActions();
    initializeSmoothScrolling();
}

/**
 * 네비게이션 관리
 */
function initializeNavigation() {
    const navbar = document.querySelector('.navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // 스크롤 시 네비게이션 스타일 변경
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        // 현재 섹션에 따른 네비게이션 활성화
        updateActiveNavLink();
    });
    
    // 네비게이션 링크 클릭 이벤트
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            scrollToSection(targetId);
        });
    });
}

/**
 * 현재 섹션에 따른 네비게이션 활성화 업데이트
 */
function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let currentSection = '';
    
    sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 100 && rect.bottom >= 100) {
            currentSection = section.id;
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSection}`) {
            link.classList.add('active');
        }
    });
}

/**
 * 스크롤 효과 초기화
 */
function initializeScrollEffects() {
    // Intersection Observer를 사용한 요소 애니메이션
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // 애니메이션 대상 요소들 관찰
    const animateElements = document.querySelectorAll(
        '.service-card, .value-item, .project-card, .contact-item'
    );
    
    animateElements.forEach(el => {
        observer.observe(el);
    });
}

/**
 * 히어로 섹션 애니메이션
 */
function initializeHeroAnimations() {
    // 통계 카운터 애니메이션
    const statNumbers = document.querySelectorAll('.stat-number');
    
    statNumbers.forEach(stat => {
        const finalValue = stat.textContent;
        const isPercentage = finalValue.includes('%');
        const numericValue = parseFloat(finalValue.replace(/[^\d.]/g, ''));
        
        animateCounter(stat, 0, numericValue, 2000, isPercentage);
    });
    
    // 히어로 배지 애니메이션
    const heroBadge = document.querySelector('.hero-badge');
    if (heroBadge) {
        setTimeout(() => {
            heroBadge.style.opacity = '1';
            heroBadge.style.transform = 'translateY(0)';
        }, 500);
    }
}

/**
 * 카운터 애니메이션
 */
function animateCounter(element, start, end, duration, isPercentage = false) {
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // easeOutExpo 이징 함수
        const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        
        const currentValue = start + (end - start) * easedProgress;
        
        if (isPercentage) {
            element.textContent = currentValue.toFixed(1) + '%';
        } else if (end >= 1000) {
            element.textContent = Math.floor(currentValue).toLocaleString() + '+';
        } else {
            element.textContent = Math.floor(currentValue) + '+';
        }
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

/**
 * 연락처 폼 관리
 */
function initializeContactForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleContactFormSubmit(this);
        });
        
        // 폼 입력 유효성 검사
        const formInputs = contactForm.querySelectorAll('input, textarea, select');
        formInputs.forEach(input => {
            input.addEventListener('blur', validateFormField);
            input.addEventListener('input', clearFieldError);
        });
    }
}

/**
 * 연락처 폼 제출 처리
 */
function handleContactFormSubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // 폼 유효성 검사
    if (!validateContactForm(data)) {
        return;
    }
    
    // 제출 버튼 비활성화
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 전송 중...';
    
    // 실제 서버 전송 시뮬레이션 (2초 후 성공)
    setTimeout(() => {
        showNotification('문의가 성공적으로 전송되었습니다!', 'success');
        form.reset();
        
        // 버튼 상태 복원
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }, 2000);
}

/**
 * 폼 유효성 검사
 */
function validateContactForm(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length < 2) {
        errors.push('성명을 정확히 입력해주세요.');
    }
    
    if (!data.email || !isValidEmail(data.email)) {
        errors.push('올바른 이메일 주소를 입력해주세요.');
    }
    
    if (!data.phone || data.phone.trim().length < 10) {
        errors.push('연락처를 정확히 입력해주세요.');
    }
    
    if (!data.subject) {
        errors.push('문의 유형을 선택해주세요.');
    }
    
    if (!data.message || data.message.trim().length < 10) {
        errors.push('문의 내용을 최소 10자 이상 입력해주세요.');
    }
    
    if (errors.length > 0) {
        showNotification(errors.join('\n'), 'error');
        return false;
    }
    
    return true;
}

/**
 * 이메일 유효성 검사
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 폼 필드 유효성 검사
 */
function validateFormField(e) {
    const field = e.target;
    const value = field.value.trim();
    
    clearFieldError(field);
    
    switch (field.type) {
        case 'email':
            if (value && !isValidEmail(value)) {
                showFieldError(field, '올바른 이메일 형식이 아닙니다.');
            }
            break;
        case 'tel':
            if (value && value.length < 10) {
                showFieldError(field, '연락처를 정확히 입력해주세요.');
            }
            break;
    }
    
    if (field.required && !value) {
        showFieldError(field, '필수 입력 항목입니다.');
    }
}

/**
 * 필드 에러 표시
 */
function showFieldError(field, message) {
    clearFieldError(field);
    
    field.style.borderColor = '#ef4444';
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.color = '#ef4444';
    errorDiv.style.fontSize = '0.875rem';
    errorDiv.style.marginTop = '0.25rem';
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
}

/**
 * 필드 에러 제거
 */
function clearFieldError(field) {
    if (typeof field === 'object' && field.target) {
        field = field.target;
    }
    
    field.style.borderColor = '';
    
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

/**
 * 플로팅 액션 버튼
 */
function initializeFloatingActions() {
    // 맨 위로 가기 버튼 생성
    const scrollTopBtn = createFloatingButton('fas fa-chevron-up', '맨 위로', scrollToTop);
    
    // 문의하기 버튼 생성
    const contactBtn = createFloatingButton('fas fa-phone', '문의하기', () => scrollToSection('contact'));
    
    // 플로팅 컨테이너 생성
    const floatingContainer = document.createElement('div');
    floatingContainer.className = 'floating-actions';
    floatingContainer.appendChild(contactBtn);
    floatingContainer.appendChild(scrollTopBtn);
    
    document.body.appendChild(floatingContainer);
    
    // 스크롤 위치에 따른 버튼 표시/숨김
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            floatingContainer.style.opacity = '1';
            floatingContainer.style.transform = 'translateY(0)';
        } else {
            floatingContainer.style.opacity = '0';
            floatingContainer.style.transform = 'translateY(20px)';
        }
    });
}

/**
 * 플로팅 버튼 생성
 */
function createFloatingButton(iconClass, tooltip, onClick) {
    const button = document.createElement('button');
    button.className = 'floating-btn';
    button.innerHTML = `<i class="${iconClass}"></i>`;
    button.title = tooltip;
    button.addEventListener('click', onClick);
    
    return button;
}

/**
 * 부드러운 스크롤링
 */
function initializeSmoothScrolling() {
    // 모든 앵커 링크에 부드러운 스크롤 적용
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            if (targetId) {
                scrollToSection(targetId);
            }
        });
    });
}

/**
 * 섹션으로 스크롤
 */
function scrollToSection(sectionId) {
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        const headerHeight = document.querySelector('.navbar').offsetHeight;
        const targetPosition = targetSection.offsetTop - headerHeight - 20;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
}

/**
 * 맨 위로 스크롤
 */
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/**
 * 알림 메시지 표시
 */
function showNotification(message, type = 'info') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 새 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        white-space: pre-line;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 애니메이션
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 자동 제거
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// CSS 애니메이션 스타일 동적 추가
const style = document.createElement('style');
style.textContent = `
    .floating-actions {
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
    }
    
    .animate-in {
        animation: slideInUp 0.6s ease forwards;
    }
    
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .hero-badge {
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.6s ease;
    }
    
    .service-card,
    .project-card {
        transition: all 0.3s ease;
    }
    
    .floating-btn {
        transition: all 0.3s ease;
    }
    
    .floating-btn:hover {
        transform: scale(1.1) rotate(5deg);
    }
`;

document.head.appendChild(style);

// Company Homepage Manager
const CompanyManager = {
    currentCompany: null,
    
    // Get color value from color code
    getColorValue(colorCode) {
        const colorMap = {
            'red': '#e74c3c',
            'orange': '#f39c12',
            'yellow': '#f1c40f',
            'green': '#27ae60',
            'blue': '#3498db',
            'purple': '#9b59b6',
            'gray': '#95a5a6'
        };
        return colorMap[colorCode] || '#95a5a6'; // Default to gray
    },
    
    // Company Data
    companies: {
        1: {
            id: 1,
            name: '대한철강',
            logo: '대한',
            color: '#2563eb',
            tagline: '철강업계의 신뢰받는 리더',
            description: '1995년 설립 이래 철강 제조 분야에서 최고 품질의 제품을 공급하며 업계를 선도하고 있습니다.',
            established: 1995,
            employees: 150,
            projects: 500,
            address: '서울시 강남구 테헤란로 123',
            phone: '02-1234-5678',
            email: 'info@daehan.co.kr',
            awards: 15,
            globalPartners: 25,
            growthRate: 25,
            products: [
                {
                    id: 1,
                    title: '철강재 제조',
                    description: '최신 설비와 기술로 고품질 철강재를 생산합니다.',
                    icon: 'fa-industry',
                    features: ['고품질', '대량생산', '맞춤제작']
                },
                {
                    id: 2,
                    title: '정밀 가공',
                    description: '고객 요구사항에 맞는 정밀 절단 및 가공 서비스를 제공합니다.',
                    icon: 'fa-cogs',
                    features: ['정밀가공', '빠른납기', '품질보증']
                },
                {
                    id: 3,
                    title: '물류 서비스',
                    description: '전국 어디든 신속하고 안전한 배송 서비스를 제공합니다.',
                    icon: 'fa-shipping-fast',
                    features: ['전국배송', '안전포장', '실시간추적']
                }
            ],
            gallery: [
                {
                    id: 1,
                    title: '제조 공장',
                    description: '최신 설비를 갖춘 철강 제조 공장 전경',
                    category: 'factory',
                    icon: 'fa-industry'
                },
                {
                    id: 2,
                    title: '생산 라인',
                    description: '자동화된 철강재 생산 라인의 모습',
                    category: 'factory',
                    icon: 'fa-cogs'
                },
                {
                    id: 3,
                    title: '완제품',
                    description: '품질관리를 마친 고품질 철강재 제품',
                    category: 'products',
                    icon: 'fa-cube'
                },
                {
                    id: 4,
                    title: '품질 검사',
                    description: '엄격한 품질 검사 과정',
                    category: 'factory',
                    icon: 'fa-search'
                },
                {
                    id: 5,
                    title: '연구개발팀',
                    description: '혁신적인 기술 개발을 위한 연구팀',
                    category: 'team',
                    icon: 'fa-users'
                },
                {
                    id: 6,
                    title: '고객 상담',
                    description: '전문 상담진의 고객 서비스',
                    category: 'team',
                    icon: 'fa-handshake'
                }
            ],
            news: [
                {
                    id: 1,
                    title: '신규 생산라인 가동 개시',
                    excerpt: '최신 자동화 설비를 도입한 신규 생산라인이 본격 가동을 시작했습니다.',
                    date: '2024-01-15',
                    image: 'fa-industry'
                },
                {
                    id: 2,
                    title: 'ISO 14001 환경경영 인증 획득',
                    excerpt: '친환경 경영 시스템 구축으로 국제 환경경영 인증을 획득했습니다.',
                    date: '2024-01-10',
                    image: 'fa-leaf'
                },
                {
                    id: 3,
                    title: '해외 수출 계약 체결',
                    excerpt: '동남아시아 3개국과 철강재 공급 계약을 체결하여 해외 진출을 확대했습니다.',
                    date: '2024-01-05',
                    image: 'fa-globe'
                }
            ]
        },
        2: {
            id: 2,
            name: '한국스틸',
            logo: '한국',
            color: '#10b981',
            tagline: '스틸 유통의 새로운 기준',
            description: '전국 최대 규모의 철강 유통 네트워크를 구축하여 고객에게 최적의 솔루션을 제공합니다.',
            established: 2000,
            employees: 120,
            projects: 400,
            address: '경기도 안산시 단원구 중앙대로 456',
            phone: '031-2345-6789',
            email: 'info@korea.co.kr',
            awards: 12,
            globalPartners: 18,
            growthRate: 30,
            products: [
                {
                    id: 1,
                    title: '철강재 유통',
                    description: '다양한 규격의 철강재를 안정적으로 공급합니다.',
                    icon: 'fa-warehouse',
                    features: ['다양한규격', '안정공급', '경쟁력있는가격']
                },
                {
                    id: 2,
                    title: '신속 배송',
                    description: '전국 어디든 당일/익일 배송 서비스를 제공합니다.',
                    icon: 'fa-truck',
                    features: ['당일배송', '전국망', '실시간추적']
                },
                {
                    id: 3,
                    title: '맞춤 솔루션',
                    description: '고객별 특성에 맞는 최적의 철강재 솔루션을 제공합니다.',
                    icon: 'fa-puzzle-piece',
                    features: ['맞춤제작', '전문상담', '애프터서비스']
                }
            ],
            gallery: [
                {
                    id: 1,
                    title: '대형 창고',
                    description: '다양한 철강재를 보관하는 대형 유통 창고',
                    category: 'factory',
                    icon: 'fa-warehouse'
                },
                {
                    id: 2,
                    title: '하역 장비',
                    description: '효율적인 하역을 위한 최신 장비들',
                    category: 'factory',
                    icon: 'fa-forklift'
                },
                {
                    id: 3,
                    title: '제품 진열',
                    description: '체계적으로 분류된 철강재 제품들',
                    category: 'products',
                    icon: 'fa-cubes'
                },
                {
                    id: 4,
                    title: '배송 준비',
                    description: '신속한 배송을 위한 체계적인 포장 과정',
                    category: 'factory',
                    icon: 'fa-truck-loading'
                },
                {
                    id: 5,
                    title: '영업팀',
                    description: '전문적인 상담을 제공하는 영업팀',
                    category: 'team',
                    icon: 'fa-users'
                },
                {
                    id: 6,
                    title: '고객 방문',
                    description: '고객사 현장 방문 서비스',
                    category: 'team',
                    icon: 'fa-handshake'
                }
            ],
            news: [
                {
                    id: 1,
                    title: '신규 물류센터 오픈',
                    excerpt: '경기남부 지역 서비스 확대를 위한 신규 물류센터가 오픈했습니다.',
                    date: '2024-01-20',
                    image: 'fa-warehouse'
                },
                {
                    id: 2,
                    title: '디지털 플랫폼 도입',
                    excerpt: '실시간 재고 확인 및 주문 시스템을 갖춘 디지털 플랫폼을 도입했습니다.',
                    date: '2024-01-12',
                    image: 'fa-laptop'
                },
                {
                    id: 3,
                    title: '고객 만족도 1위 달성',
                    excerpt: '업계 고객 만족도 조사에서 3년 연속 1위를 달성했습니다.',
                    date: '2024-01-08',
                    image: 'fa-star'
                }
            ]
        }
    },
    
    // Initialize company homepage
    init() {
        this.loadCompanyData();
        this.setupEventListeners();
        this.setupScrollEffects();
        this.setupGalleryFilter();
        this.renderContent();
    },
    
    // Load company data from URL parameter
    loadCompanyData() {
        const urlParams = new URLSearchParams(window.location.search);
        const companyId = urlParams.get('company') || '1';
        
        this.currentCompany = this.companies[companyId];
        
        if (!this.currentCompany) {
            // Redirect to first company if invalid ID
            window.location.href = '../../1-homepage/templates/index.html?company=1';
            return;
        }
        
        // Set CSS custom property for company color
        const colorValue = this.getColorValue(this.currentCompany.color_code);
        document.documentElement.style.setProperty('--company-primary', colorValue);
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Navigation scroll effect
        window.addEventListener('scroll', this.handleNavbarScroll);
        
        // Contact form submission
        const contactForm = document.getElementById('companyContactForm');
        if (contactForm) {
            contactForm.addEventListener('submit', this.handleContactSubmit);
        }
        
        // Employee login form
        const employeeForm = document.getElementById('employeeLoginForm');
        if (employeeForm) {
            employeeForm.addEventListener('submit', this.handleEmployeeLogin);
        }
        
        // Smooth scrolling for navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', this.handleNavClick);
        });
        
        // Gallery filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', this.handleGalleryFilter);
        });
    },
    
    // Navigation scroll effect
    handleNavbarScroll() {
        const navbar = document.querySelector('.company-navbar');
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        // Update active navigation link
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link');
        
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            if (window.scrollY >= sectionTop) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    },
    
    // Handle navigation clicks
    handleNavClick(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        scrollToSection(targetId);
    },
    
    // Setup scroll effects
    setupScrollEffects() {
        // Parallax effect for hero background
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const heroBackground = document.querySelector('.hero-background');
            
            if (heroBackground) {
                const rate = scrolled * -0.5;
                heroBackground.style.transform = `translateY(${rate}px)`;
            }
        });
        
        // Fade in animation for sections
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fadeInUp');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        // Observe elements for animation
        document.querySelectorAll('.product-card, .gallery-item, .news-card, .value-item').forEach(el => {
            observer.observe(el);
        });
    },
    
    // Setup gallery filter functionality
    setupGalleryFilter() {
        this.galleryFilter = {
            activeFilter: 'all',
            
            filter(category) {
                this.activeFilter = category;
                const items = document.querySelectorAll('.gallery-item');
                
                items.forEach(item => {
                    const itemCategory = item.dataset.category;
                    if (category === 'all' || itemCategory === category) {
                        item.style.display = 'block';
                        setTimeout(() => {
                            item.style.opacity = '1';
                            item.style.transform = 'translateY(0)';
                        }, 100);
                    } else {
                        item.style.opacity = '0';
                        item.style.transform = 'translateY(20px)';
                        setTimeout(() => {
                            item.style.display = 'none';
                        }, 300);
                    }
                });
                
                // Update filter buttons
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.filter === category) {
                        btn.classList.add('active');
                    }
                });
            }
        };
    },
    
    // Handle gallery filter clicks
    handleGalleryFilter(e) {
        const filter = e.target.dataset.filter;
        CompanyManager.galleryFilter.filter(filter);
    },
    
    // Render all content
    renderContent() {
        this.renderBranding();
        this.renderHeroSection();
        this.renderAboutSection();
        this.renderProductsSection();
        this.renderGallerySection();
        this.renderNewsSection();
        this.renderContactSection();
        this.renderFooter();
    },
    
    // Render company branding
    renderBranding() {
        const company = this.currentCompany;
        
        // Page title
        document.getElementById('pageTitle').textContent = `${company.name} - ${company.tagline}`;
        
        // Navigation brand
        const companyBrand = document.getElementById('companyBrand');
        companyBrand.innerHTML = `
            <div class="company-brand-logo" style="background: ${company.color};">
                ${company.logo}
            </div>
            <div class="company-brand-text">
                <div class="company-brand-name">${company.name}</div>
                <div class="company-brand-tagline">${company.tagline}</div>
            </div>
        `;
    },
    
    // Render hero section
    renderHeroSection() {
        const company = this.currentCompany;
        
        document.getElementById('heroLogo').innerHTML = company.logo;
        document.getElementById('heroLogo').style.background = company.color;
        document.getElementById('heroTitle').textContent = company.name;
        document.getElementById('heroSubtitle').textContent = company.tagline;
        document.getElementById('heroDescription').textContent = company.description;
        
        document.getElementById('establishedYear').textContent = company.established;
        document.getElementById('employeeCount').textContent = `${company.employees}+`;
        document.getElementById('projectCount').textContent = `${company.projects}+`;
    },
    
    // Render about section
    renderAboutSection() {
        const company = this.currentCompany;
        const currentYear = new Date().getFullYear();
        const experience = currentYear - company.established;
        
        document.getElementById('companyOverview').textContent = company.description;
        document.getElementById('yearsOfExperience').textContent = experience;
        document.getElementById('awards').textContent = company.awards;
        document.getElementById('globalPartners').textContent = company.globalPartners;
        document.getElementById('growthRate').textContent = `${company.growthRate}%`;
    },
    
    // Render products section
    renderProductsSection() {
        const company = this.currentCompany;
        const productsGrid = document.getElementById('productsGrid');
        
        productsGrid.innerHTML = company.products.map(product => `
            <div class="product-card">
                <div class="product-image" style="background: linear-gradient(135deg, ${company.color}, ${company.color}dd);">
                    <i class="fas ${product.icon}"></i>
                </div>
                <div class="product-content">
                    <h3 class="product-title">${product.title}</h3>
                    <p class="product-description">${product.description}</p>
                    <div class="product-features">
                        ${product.features.map(feature => `
                            <span class="feature-badge">${feature}</span>
                        `).join('')}
                    </div>
                    <div class="product-action">
                        <button onclick="showQuickContact('${product.title}')" class="btn btn-outline">
                            <i class="fas fa-info-circle"></i> 자세히 보기
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    // Render gallery section
    renderGallerySection() {
        const company = this.currentCompany;
        const galleryGrid = document.getElementById('galleryGrid');
        
        galleryGrid.innerHTML = company.gallery.map(item => `
            <div class="gallery-item" data-category="${item.category}">
                <div class="gallery-image" style="background: linear-gradient(45deg, ${company.color}, ${company.color}bb);">
                    <i class="fas ${item.icon}"></i>
                </div>
                <div class="gallery-overlay">
                    <div class="gallery-title">${item.title}</div>
                    <div class="gallery-description">${item.description}</div>
                </div>
            </div>
        `).join('');
    },
    
    // Render news section
    renderNewsSection() {
        const company = this.currentCompany;
        const newsGrid = document.getElementById('newsGrid');
        
        newsGrid.innerHTML = company.news.map(article => `
            <div class="news-card" onclick="openNewsArticle(${article.id})">
                <div class="news-image" style="background: linear-gradient(135deg, ${company.color}, ${company.color}bb);">
                    <i class="fas ${article.image}"></i>
                </div>
                <div class="news-content">
                    <div class="news-date">${new Date(article.date).toLocaleDateString('ko-KR')}</div>
                    <h3 class="news-title">${article.title}</h3>
                    <p class="news-excerpt">${article.excerpt}</p>
                    <a href="#" class="news-read-more">자세히 읽기 →</a>
                </div>
            </div>
        `).join('');
    },
    
    // Render contact section
    renderContactSection() {
        const company = this.currentCompany;
        
        document.getElementById('contactAddress').textContent = company.address;
        document.getElementById('contactPhone').textContent = company.phone;
        document.getElementById('contactEmail').textContent = company.email;
    },
    
    // Render footer
    renderFooter() {
        const company = this.currentCompany;
        
        const footerLogo = document.getElementById('footerLogo');
        footerLogo.innerHTML = company.logo;
        footerLogo.style.background = company.color;
        
        document.getElementById('footerCompanyName').textContent = company.name;
        document.getElementById('footerDescription').textContent = company.tagline;
        document.getElementById('footerPhone').textContent = company.phone;
        document.getElementById('footerEmail').textContent = company.email;
        document.getElementById('footerAddress').textContent = company.address;
        document.getElementById('copyrightCompany').textContent = company.name;
    },
    
    // Handle contact form submission
    handleContactSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> 전송 중...';
        submitBtn.disabled = true;
        
        // Simulate API call
        setTimeout(() => {
            submitBtn.innerHTML = '<i class="fas fa-check"></i> 전송 완료';
            submitBtn.style.backgroundColor = 'var(--success-color)';
            
            // Reset form
            setTimeout(() => {
                e.target.reset();
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                submitBtn.style.backgroundColor = '';
                
                showNotification('문의가 성공적으로 전송되었습니다!', 'success');
            }, 2000);
        }, 1500);
    },
    
    // Handle employee login
    handleEmployeeLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('employeeEmail').value;
        const password = document.getElementById('employeePassword').value;
        
        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> 로그인 중...';
        submitBtn.disabled = true;
        
        // Simulate login
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            closeModal('employeeLoginModal');
            
            // Redirect to employee dashboard
            window.location.href = '../employee/dashboard.html';
        }, 1500);
    }
};

// Utility Functions
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const offsetTop = section.offsetTop - 80; // Account for fixed navbar
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
    }
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function showEmployeeLogin() {
    const modal = document.getElementById('employeeLoginModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showQuickContact(productName = '') {
    const subject = productName ? `${productName} 문의` : '일반 문의';
    const subjectField = document.getElementById('inquirySubject');
    if (subjectField) {
        subjectField.value = subject;
    }
    
    scrollToSection('contact');
}

function employeeDemo() {
    closeModal('employeeLoginModal');
    showNotification('직원 데모 계정으로 로그인합니다...', 'info');
    
    setTimeout(() => {
        window.location.href = '../employee/dashboard.html';
    }, 1500);
}

function openNewsArticle(articleId) {
    showNotification('뉴스 기사 상세 페이지로 이동합니다.', 'info');
}

function showNotification(message, type = 'info') {
    // Use the notification system from main.js
    if (window.SteelWorks && window.SteelWorks.showNotification) {
        window.SteelWorks.showNotification(message, type);
    } else {
        alert(message);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    CompanyManager.init();
});

// Export for use in other files
window.CompanyManager = CompanyManager;