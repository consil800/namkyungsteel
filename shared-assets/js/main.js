/**
 * SteelWorks Platform - Main JavaScript
 */

// Global State
const SteelWorks = {
    currentUser: null,
    companies: [],
    isLoading: false,
    
    // Initialize the platform
    init() {
        this.setupEventListeners();
        this.loadCompanies();
        this.animateCounters();
        this.setupScrollEffects();
        this.setupIntersectionObserver();
    },
    
    // Event Listeners
    setupEventListeners() {
        // Navigation scroll effect
        window.addEventListener('scroll', this.handleNavbarScroll);
        
        // Contact form submission
        const contactForm = document.getElementById('contactForm');
        if (contactForm) {
            contactForm.addEventListener('submit', this.handleContactSubmit);
        }
        
        // Login form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLoginSubmit);
        }
        
        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', this.handleSmoothScroll);
        });
        
        // Company card clicks
        document.addEventListener('click', (e) => {
            const companyCard = e.target.closest('.company-card');
            if (companyCard) {
                const companyId = companyCard.dataset.companyId;
                this.visitCompany(companyId);
            }
        });
        
        // Service card hover effects
        document.querySelectorAll('.service-card').forEach(card => {
            card.addEventListener('mouseenter', this.handleServiceHover);
            card.addEventListener('mouseleave', this.handleServiceLeave);
        });
        
        // Timeline animation
        this.setupTimelineAnimation();
    },
    
    // Navigation Effects
    handleNavbarScroll() {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    },
    
    // Smooth Scrolling
    handleSmoothScroll(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
            const offsetTop = targetElement.offsetTop - 80; // Account for fixed navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    },
    
    // Counter Animation
    animateCounters() {
        const counters = document.querySelectorAll('.stat-number[data-count]');
        
        counters.forEach(counter => {
            const target = parseInt(counter.dataset.count);
            const increment = target / 100;
            let current = 0;
            
            const updateCounter = () => {
                if (current < target) {
                    current += increment;
                    counter.textContent = Math.floor(current);
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target;
                }
            };
            
            // Start animation when element is visible
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        updateCounter();
                        observer.unobserve(entry.target);
                    }
                });
            });
            
            observer.observe(counter);
        });
    },
    
    // Scroll Effects
    setupScrollEffects() {
        const parallaxElements = document.querySelectorAll('.hero-background');
        
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            
            parallaxElements.forEach(element => {
                const rate = scrolled * -0.5;
                element.style.transform = `translateY(${rate}px)`;
            });
        });
    },
    
    // Intersection Observer for animations
    setupIntersectionObserver() {
        const options = {
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
        }, options);
        
        // Observe sections for animation
        document.querySelectorAll('.section-header, .service-card, .feature-item').forEach(el => {
            observer.observe(el);
        });
    },
    
    // Timeline Animation
    setupTimelineAnimation() {
        const timelineItems = document.querySelectorAll('.timeline-item');
        let currentIndex = 0;
        
        const animateTimeline = () => {
            timelineItems.forEach((item, index) => {
                item.classList.remove('active');
                if (index === currentIndex) {
                    item.classList.add('active');
                }
            });
            
            currentIndex = (currentIndex + 1) % timelineItems.length;
        };
        
        // Start timeline animation
        if (timelineItems.length > 0) {
            animateTimeline();
            setInterval(animateTimeline, 3000);
        }
    },
    
    // Service Card Effects
    handleServiceHover(e) {
        const card = e.currentTarget;
        const icon = card.querySelector('.service-icon');
        
        if (icon) {
            icon.style.transform = 'scale(1.1) rotate(5deg)';
        }
    },
    
    handleServiceLeave(e) {
        const card = e.currentTarget;
        const icon = card.querySelector('.service-icon');
        
        if (icon) {
            icon.style.transform = 'scale(1) rotate(0deg)';
        }
    },
    
    // Load Companies Data
    loadCompanies() {
        // Sample company data - in real implementation, this would come from API
        this.companies = [
            {
                id: 1,
                name: '대한철강',
                type: '제조업',
                logo: '대한',
                color: '#2563eb',
                employees: 150,
                projects: 23,
                revenue: '200억'
            },
            {
                id: 2,
                name: '한국스틸',
                type: '유통업',
                logo: '한국',
                color: '#10b981',
                employees: 120,
                projects: 18,
                revenue: '180억'
            },
            {
                id: 3,
                name: '서울메탈',
                type: '가공업',
                logo: '서울',
                color: '#f59e0b',
                employees: 95,
                projects: 15,
                revenue: '150억'
            },
            {
                id: 4,
                name: '부산철강',
                type: '제조업',
                logo: '부산',
                color: '#ef4444',
                employees: 180,
                projects: 28,
                revenue: '250억'
            },
            {
                id: 5,
                name: '광주스틸',
                type: '유통업',
                logo: '광주',
                color: '#8b5cf6',
                employees: 110,
                projects: 20,
                revenue: '170억'
            },
            {
                id: 6,
                name: '울산철강',
                type: '제조업',
                logo: '울산',
                color: '#06b6d4',
                employees: 200,
                projects: 32,
                revenue: '300억'
            }
        ];
        
        this.renderCompanies();
    },
    
    // Render Companies Grid
    renderCompanies() {
        const grid = document.getElementById('companiesGrid');
        if (!grid) return;
        
        grid.innerHTML = this.companies.map(company => `
            <div class="company-card" data-company-id="${company.id}">
                <div class="company-logo" style="background: ${company.color};">
                    ${company.logo}
                </div>
                <div class="company-name">${company.name}</div>
                <div class="company-type">${company.type}</div>
                <div class="company-stats">
                    <div class="company-stat">
                        <div class="company-stat-number">${company.employees}</div>
                        <div class="company-stat-label">직원</div>
                    </div>
                    <div class="company-stat">
                        <div class="company-stat-number">${company.projects}</div>
                        <div class="company-stat-label">프로젝트</div>
                    </div>
                    <div class="company-stat">
                        <div class="company-stat-number">${company.revenue}</div>
                        <div class="company-stat-label">매출</div>
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    // Visit Company Homepage
    visitCompany(companyId) {
        const company = this.companies.find(c => c.id == companyId);
        if (company) {
            // Redirect to company homepage
            window.location.href = `pages/company/index.html?company=${companyId}`;
        }
    },
    
    // Contact Form Handling
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
                
                SteelWorks.showNotification('문의가 성공적으로 전송되었습니다!', 'success');
            }, 2000);
        }, 1500);
    },
    
    // Login Form Handling
    handleLoginSubmit(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> 로그인 중...';
        submitBtn.disabled = true;
        
        // Simulate login
        setTimeout(() => {
            const userType = document.querySelector('.tab-btn.active').textContent.includes('기업') ? 'admin' : 'employee';
            SteelWorks.loginUser(email, userType);
            
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            closeModal('loginModal');
        }, 1500);
    },
    
    // User Authentication
    loginUser(email, type) {
        this.currentUser = {
            email,
            type,
            company: type === 'admin' ? this.companies[0] : this.companies[1]
        };
        
        // 플랫폼에서는 자동 리다이렉트 하지 않음
        console.log('SteelWorks loginUser 호출됨 - 자동 리다이렉트 비활성화');
    },
    
    // Demo Login
    loginDemo(type) {
        // 플랫폼에서는 사용하지 않음 - AuthManager 사용
        console.log('SteelWorks loginDemo 호출됨 - 무시됨, type:', type);
        return false;
    },
    
    // Notification System
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button onclick="this.parentElement.remove()" class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--error-color)' : 'var(--primary-color)'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 1rem;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
};

// Modal Functions
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function showDemoModal() {
    SteelWorks.showNotification('데모 모달 기능을 준비 중입니다.', 'info');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function switchTab(tabType) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.target.classList.add('active');
}

function exploreCompanies() {
    const companiesSection = document.getElementById('companies');
    if (companiesSection) {
        companiesSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function loadMoreCompanies() {
    SteelWorks.showNotification('더 많은 기업을 로딩 중입니다...', 'info');
}

function loginDemo(type) {
    // 플랫폼 전용 로그인은 별도 함수로 처리
    console.log('main.js loginDemo 호출됨 - 무시됨, type:', type);
    return false;
}

// Add custom CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        transition: background-color 0.2s;
    }
    
    .notification-close:hover {
        background-color: rgba(255, 255, 255, 0.2);
    }
`;
document.head.appendChild(style);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    SteelWorks.init();
});

// Export for use in other files
window.SteelWorks = SteelWorks;