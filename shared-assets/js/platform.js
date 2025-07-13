// SteelWorks Platform JavaScript
console.log('Platform.js 로드 완료');

// 글로벌 테스트 함수 (브라우저 콘솔에서 호출 가능)
window.testGlobalSteelPreview = function() {
    console.log('테스트 함수 호출됨');
    previewTemplate('global-steel');
};

// 플랫폼 데이터 관리
let platformData = {
    templates: [
        {
            id: 'global-steel',
            name: 'Global Steel',
            description: '전세계를 잇는 글로벌 철강 네트워크 템플릿 (석영에스앤티 스타일)',
            category: 'global',
            image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=300&fit=crop',
            features: ['글로벌 네트워크', '실시간 연결', '세계지도 배경', '석영에스앤티 디자인'],
            demoPath: '../2-templates/seokyoung-snt/seokyoung-preview.html',
            price: '₩2,500,000',
            popular: true
        },
        {
            id: 'steel-solutions',
            name: 'Steel Solutions',
            description: '맞춤형 철강 솔루션과 통합 서비스 템플릿',
            category: 'business',
            image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=400&h=300&fit=crop',
            features: ['솔루션 중심', '모듈형 구조', '통합 플랫폼', '전문가 팀'],
            demoPath: './dynamic-demos/steel-solutions/index.html',
            price: '₩2,200,000',
            popular: false
        },
        {
            id: 'industrial-premium',
            name: 'Industrial Premium',
            description: '고급 산업용 철강 전문 기업을 위한 프리미엄 템플릿',
            category: 'premium',
            image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop',
            features: ['프리미엄 디자인', '고급 애니메이션', '산업 특화', '맞춤 제작'],
            demoPath: '#',
            price: '₩3,500,000',
            popular: false
        },
        {
            id: 'modern-steel',
            name: 'Modern Steel',
            description: '현대적이고 세련된 디자인의 철강 기업 템플릿',
            category: 'modern',
            image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop',
            features: ['모던 디자인', '반응형 레이아웃', '깔끔한 UI', '빠른 로딩'],
            demoPath: '#',
            price: '₩1,800,000',
            popular: false
        },
        {
            id: 'corporate-steel',
            name: 'Corporate Steel',
            description: '대기업을 위한 기업형 철강 비즈니스 템플릿',
            category: 'corporate',
            image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop',
            features: ['기업형 구조', '다부서 관리', '통합 시스템', '보안 강화'],
            demoPath: '#',
            price: '₩4,200,000',
            popular: false
        },
        {
            id: 'startup-steel',
            name: 'Startup Steel',
            description: '신생 철강 기업을 위한 경제적이고 효율적인 템플릿',
            category: 'startup',
            image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop',
            features: ['경제적 가격', '빠른 구축', '성장 지원', '간편 관리'],
            demoPath: '#',
            price: '₩980,000',
            popular: true
        }
    ],
    customers: [],
    employees: []
};

// 템플릿 갤러리 렌더링
function renderTemplatesGrid() {
    const grid = document.getElementById('templatesGrid');
    if (!grid) return;

    grid.innerHTML = platformData.templates.map(template => `
        <div class="template-card" data-template="${template.id}">
            <div class="template-image">
                <img src="${template.image}" alt="${template.name}" loading="lazy">
                <div class="template-overlay">
                    <button class="template-preview-btn" data-template-id="${template.id}" onclick="previewTemplate('${template.id}')">
                        <i class="fas fa-eye"></i> 미리보기
                    </button>
                    <button class="template-select-btn" data-template-id="${template.id}" onclick="selectTemplate('${template.id}')">
                        <i class="fas fa-check"></i> 선택하기
                    </button>
                </div>
                ${template.popular ? '<div class="template-badge">인기</div>' : ''}
            </div>
            <div class="template-content">
                <div class="template-header">
                    <h3 class="template-title">${template.name}</h3>
                    <div class="template-price">${template.price}</div>
                </div>
                <p class="template-description">${template.description}</p>
                <div class="template-features">
                    ${template.features.map(feature => `<span class="feature-tag">${feature}</span>`).join('')}
                </div>
                <div class="template-actions">
                    <button class="btn btn-outline template-preview-action" data-template-id="${template.id}" onclick="previewTemplate('${template.id}')">
                        <i class="fas fa-eye"></i> 미리보기
                    </button>
                    <button class="btn btn-primary template-select-action" data-template-id="${template.id}" onclick="selectTemplate('${template.id}')">
                        <i class="fas fa-shopping-cart"></i> 구매하기
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    console.log('템플릿 갤러리 렌더링 완료');
}

// 더 이상 필요하지 않음 - onclick 속성 사용

// 템플릿 미리보기
function previewTemplate(templateId) {
    console.log('🔍 previewTemplate 호출됨:', templateId);
    
    // Global Steel 템플릿은 바로 석영에스앤티 홈페이지 열기
    if (templateId === 'global-steel') {
        console.log('🎯 Global Steel 템플릿 - 석영에스앤티 홈페이지 열기');
        try {
            const previewWindow = window.open('../2-templates/seokyoung-snt/seokyoung-preview.html', '_blank');
            if (previewWindow) {
                console.log('✅ 석영에스앤티 홈페이지 미리보기 창 열기 성공!');
                showNotification('Global Steel 템플릿 (석영에스앤티) 미리보기를 새 탭에서 열었습니다!', 'success');
            } else {
                console.log('❌ 팝업이 차단되었습니다');
                showNotification('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.', 'error');
            }
        } catch (error) {
            console.error('❌ 미리보기 창 열기 오류:', error);
            showNotification('미리보기 열기 중 오류가 발생했습니다: ' + error.message, 'error');
        }
        return;
    }
    
    // 다른 템플릿들 처리
    const template = platformData.templates.find(t => t.id === templateId);
    if (!template) {
        console.log('❌ 템플릿을 찾을 수 없음:', templateId);
        showNotification('템플릿을 찾을 수 없습니다.', 'error');
        return;
    }

    console.log('📋 템플릿 정보:', template);
    
    if (template.demoPath === '#' || template.demoPath === 'dynamic') {
        showNotification('이 템플릿의 미리보기는 준비 중입니다.', 'info');
        return;
    }

    // 다른 템플릿들은 기존 방식으로 처리
    try {
        console.log('🔗 미리보기 창 열기 시도:', template.demoPath);
        const previewWindow = window.open(template.demoPath, '_blank');
        
        if (previewWindow) {
            showNotification(`${template.name} 템플릿 미리보기를 새 탭에서 열었습니다.`, 'success');
            console.log('✅ 미리보기 창 열기 성공');
        } else {
            showNotification('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.', 'error');
            console.log('❌ 팝업이 차단되었습니다');
        }
    } catch (error) {
        console.error('❌ 미리보기 오류:', error);
        showNotification('미리보기 열기 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 석영에스앤티 홈페이지 HTML 생성 함수
function createSeokyoungHomepage() {
    console.log('createSeokyoungHomepage 함수 시작');
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>석영에스앤티 - 철강 전문 기업</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Noto Sans KR', sans-serif; line-height: 1.6; color: #333; overflow-x: hidden; }
        .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 1rem 0; position: fixed; width: 100%; top: 0; z-index: 1000; backdrop-filter: blur(10px); border-bottom: 2px solid rgba(59, 130, 246, 0.3); }
        .header-content { max-width: 1200px; margin: 0 auto; padding: 0 2rem; display: flex; justify-content: space-between; align-items: center; }
        .logo { display: flex; align-items: center; gap: 1rem; font-size: 1.8rem; font-weight: 800; color: #3b82f6; }
        .logo-icon { width: 50px; height: 50px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; }
        .nav-menu { display: flex; gap: 2rem; list-style: none; }
        .nav-link { color: white; text-decoration: none; font-weight: 500; padding: 0.5rem 1rem; border-radius: 5px; transition: all 0.3s ease; }
        .nav-link:hover { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
        .contact-info { font-size: 0.9rem; color: rgba(255, 255, 255, 0.8); }
        .hero { background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(51, 65, 85, 0.9)), url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1600&h=900&fit=crop') center/cover; height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; color: white; position: relative; }
        .hero-content { max-width: 800px; padding: 0 2rem; z-index: 2; }
        .hero-badge { display: inline-block; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.5); color: #93c5fd; padding: 0.5rem 1.5rem; border-radius: 25px; font-size: 0.9rem; font-weight: 600; margin-bottom: 2rem; backdrop-filter: blur(10px); }
        .hero-title { font-size: clamp(3rem, 8vw, 5rem); font-weight: 900; margin-bottom: 1.5rem; background: linear-gradient(135deg, #ffffff, #93c5fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1.1; }
        .hero-subtitle { font-size: 1.5rem; color: #93c5fd; margin-bottom: 1rem; font-weight: 600; }
        .hero-description { font-size: 1.2rem; margin-bottom: 3rem; color: rgba(255, 255, 255, 0.9); line-height: 1.8; }
        .hero-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 2rem; margin-bottom: 3rem; }
        .stat { text-align: center; }
        .stat-number { font-size: 2.5rem; font-weight: 900; color: #3b82f6; margin-bottom: 0.5rem; }
        .stat-label { color: rgba(255, 255, 255, 0.8); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .cta-buttons { display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; }
        .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; border: none; border-radius: 50px; font-weight: 600; text-decoration: none; transition: all 0.3s ease; cursor: pointer; font-size: 1rem; }
        .btn-primary { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); }
        .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(59, 130, 246, 0.6); }
        .btn-outline { background: transparent; border: 2px solid white; color: white; }
        .btn-outline:hover { background: white; color: #1e293b; }
        .preview-banner { position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 0.75rem; text-align: center; font-weight: 600; z-index: 2000; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2); }
        .preview-banner i { margin-right: 0.5rem; }
        .header { top: 50px; }
        .hero { padding-top: 50px; }
        @media (max-width: 768px) { .header-content { flex-direction: column; gap: 1rem; } .nav-menu { display: none; } .hero-title { font-size: 3rem; } .hero-stats { grid-template-columns: repeat(2, 1fr); } .cta-buttons { flex-direction: column; align-items: center; } }
    </style>
</head>
<body>
    <div class="preview-banner">
        <i class="fas fa-eye"></i>
        이것은 Global Steel 템플릿의 미리보기입니다 - 석영에스앤티 철강 전문 기업
    </div>

    <header class="header">
        <div class="header-content">
            <div class="logo">
                <div class="logo-icon">
                    <i class="fas fa-industry"></i>
                </div>
                <span>석영에스앤티</span>
            </div>
            <nav class="nav-menu">
                <a href="#home" class="nav-link">홈</a>
                <a href="#about" class="nav-link">회사소개</a>
                <a href="#products" class="nav-link">제품소개</a>
                <a href="#contact" class="nav-link">문의</a>
            </nav>
            <div class="contact-info">
                <div>📞 02-1234-5678</div>
                <div>📧 info@seokyoungst.co.kr</div>
            </div>
        </div>
    </header>

    <section class="hero" id="home">
        <div class="hero-content">
            <div class="hero-badge">
                <i class="fas fa-award"></i>
                철강업계 선도기업
            </div>
            <h1 class="hero-title">석영에스앤티</h1>
            <div class="hero-subtitle">품질과 신뢰로 만드는 철강의 미래</div>
            <p class="hero-description">
                25년간 축적된 기술력과 경험으로<br>
                최고 품질의 철강제품을 공급하는 전문 기업입니다
            </p>
            
            <div class="hero-stats">
                <div class="stat">
                    <div class="stat-number">25년</div>
                    <div class="stat-label">업계 경험</div>
                </div>
                <div class="stat">
                    <div class="stat-number">50,000톤</div>
                    <div class="stat-label">연간 생산량</div>
                </div>
                <div class="stat">
                    <div class="stat-number">99.8%</div>
                    <div class="stat-label">품질 만족도</div>
                </div>
                <div class="stat">
                    <div class="stat-number">500+</div>
                    <div class="stat-label">거래 업체</div>
                </div>
            </div>

            <div class="cta-buttons">
                <a href="#products" class="btn btn-primary">
                    <i class="fas fa-box"></i>
                    제품 둘러보기
                </a>
                <a href="#contact" class="btn btn-outline">
                    <i class="fas fa-phone"></i>
                    견적 문의
                </a>
            </div>
        </div>
    </section>

    <script>
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    </script>
</body>
</html>`;
}

// 템플릿 선택
function selectTemplate(templateId) {
    const template = platformData.templates.find(t => t.id === templateId);
    if (!template) return;

    // 템플릿 선택 모달 표시
    showTemplateSelectionModal(template);
}

// 템플릿 선택 모달 표시
function showTemplateSelectionModal(template) {
    const modalHTML = `
        <div class="modal active" id="templateSelectionModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${template.name} 템플릿 구매</h3>
                    <button onclick="closeModal('templateSelectionModal')" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="template-selection-info">
                        <img src="${template.image}" alt="${template.name}" class="template-modal-image">
                        <div class="template-modal-details">
                            <h4>${template.name}</h4>
                            <p>${template.description}</p>
                            <div class="template-modal-price">${template.price}</div>
                            <div class="template-modal-features">
                                ${template.features.map(feature => `<span class="feature-tag">${feature}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <form id="templatePurchaseForm">
                        <div class="form-group">
                            <label for="companyName">회사명</label>
                            <input type="text" id="companyName" name="companyName" required class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="contactPerson">담당자명</label>
                            <input type="text" id="contactPerson" name="contactPerson" required class="form-input">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="email">이메일</label>
                                <input type="email" id="email" name="email" required class="form-input">
                            </div>
                            <div class="form-group">
                                <label for="phone">연락처</label>
                                <input type="tel" id="phone" name="phone" required class="form-input">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="requirements">특별 요구사항</label>
                            <textarea id="requirements" name="requirements" class="form-textarea" rows="3" placeholder="추가적인 요구사항이나 수정사항을 입력해주세요..."></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-outline" onclick="closeModal('templateSelectionModal')">취소</button>
                    <button type="button" class="btn btn-primary" onclick="purchaseTemplate('${template.id}')">
                        <i class="fas fa-credit-card"></i> 구매 진행
                    </button>
                </div>
            </div>
        </div>
    `;

    // 기존 모달 제거
    const existingModal = document.getElementById('templateSelectionModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 새 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// 템플릿 구매 처리
function purchaseTemplate(templateId) {
    const form = document.getElementById('templatePurchaseForm');
    const formData = new FormData(form);
    
    // 폼 유효성 검사
    if (!form.checkValidity()) {
        showNotification('모든 필수 항목을 입력해주세요.', 'error');
        return;
    }

    const template = platformData.templates.find(t => t.id === templateId);
    const purchaseData = {
        templateId: templateId,
        templateName: template.name,
        companyName: formData.get('companyName'),
        contactPerson: formData.get('contactPerson'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        requirements: formData.get('requirements'),
        price: template.price,
        purchaseDate: new Date().toISOString(),
        status: 'pending'
    };

    // 구매 데이터 저장 (실제로는 서버로 전송)
    const purchases = JSON.parse(localStorage.getItem('steelworks_purchases') || '[]');
    purchases.push(purchaseData);
    localStorage.setItem('steelworks_purchases', JSON.stringify(purchases));

    closeModal('templateSelectionModal');
    showNotification(`${template.name} 템플릿 구매 요청이 접수되었습니다. 담당자가 연락드리겠습니다.`, 'success');

    // 고객 관리 페이지로 이동
    setTimeout(() => {
        window.location.href = '../3-company-dashboards/seokyoung-snt/customer-management.html';
    }, 2000);
}

// 더 많은 템플릿 로드
function loadMoreTemplates() {
    // 추가 템플릿 데이터
    const additionalTemplates = [
        {
            id: 'industrial-premium',
            name: 'Industrial Premium',
            description: '고급 산업용 철강 전문 기업을 위한 프리미엄 템플릿',
            category: 'premium',
            image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop',
            features: ['프리미엄 디자인', '고급 애니메이션', '산업 특화', '맞춤 제작'],
            demoPath: '#',
            price: '₩3,500,000',
            popular: false
        },
        {
            id: 'modern-steel',
            name: 'Modern Steel',
            description: '현대적이고 세련된 디자인의 철강 기업 템플릿',
            category: 'modern',
            image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop',
            features: ['모던 디자인', '반응형 레이아웃', '깔끔한 UI', '빠른 로딩'],
            demoPath: '#',
            price: '₩1,800,000',
            popular: false
        },
        {
            id: 'corporate-steel',
            name: 'Corporate Steel',
            description: '대기업을 위한 기업형 철강 비즈니스 템플릿',
            category: 'corporate',
            image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop',
            features: ['기업형 구조', '다부서 관리', '통합 시스템', '보안 강화'],
            demoPath: '#',
            price: '₩4,200,000',
            popular: false
        }
    ];

    // 기존 템플릿에 추가
    platformData.templates = platformData.templates.concat(additionalTemplates);
    
    // 템플릿 갤러리 다시 렌더링
    renderTemplatesGrid();
    
    showNotification('새로운 템플릿 3개가 추가되었습니다!', 'success');
    
    // 버튼 텍스트 변경
    event.target.innerHTML = '<i class="fas fa-check"></i> 모든 템플릿 로드됨';
    event.target.disabled = true;
    event.target.style.opacity = '0.6';
}

// 로그인 모달 표시
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('active');
    }
}

// 모달 닫기
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        // 동적으로 생성된 모달의 경우 제거
        if (modalId === 'templateSelectionModal') {
            modal.remove();
        }
    }
}

// 데모 모달 표시
function showDemoModal() {
    const demoModalHTML = `
        <div class="modal active" id="demoModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>플랫폼 데모</h3>
                    <button onclick="closeModal('demoModal')" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="demo-options">
                        <div class="demo-option" onclick="previewTemplate('global-steel'); closeModal('demoModal');">
                            <i class="fas fa-globe"></i>
                            <h4>Global Steel 데모</h4>
                            <p>글로벌 철강 네트워크 템플릿 체험 (석영에스앤티)</p>
                        </div>
                        <div class="demo-option" onclick="window.open('./pages/customer-management.html', '_blank'); closeModal('demoModal');">
                            <i class="fas fa-user-cog"></i>
                            <h4>고객 관리 시스템 데모</h4>
                            <p>템플릿 구매 및 관리 시스템 체험</p>
                        </div>
                        <div class="demo-option" onclick="window.open('./pages/employee-workspace.html', '_blank'); closeModal('demoModal');">
                            <i class="fas fa-briefcase"></i>
                            <h4>직원 업무 시스템 데모</h4>
                            <p>업무일지 및 프로젝트 관리 시스템 체험</p>
                        </div>
                        <div class="demo-option" onclick="window.open('./admin/index.html', '_blank'); closeModal('demoModal');">
                            <i class="fas fa-cogs"></i>
                            <h4>관리자 CMS 데모</h4>
                            <p>홈페이지 편집 및 관리 시스템 체험</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', demoModalHTML);
}

// 참여기업 둘러보기 (이제 템플릿 갤러리로 이동)
function exploreCompanies() {
    document.getElementById('templates').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

// 서비스 카드 클릭 핸들러
function handleServiceClick(serviceType) {
    switch(serviceType) {
        case 'website':
            document.getElementById('templates').scrollIntoView({ behavior: 'smooth' });
            showNotification('홈페이지 템플릿 갤러리로 이동했습니다!', 'info');
            break;
        case 'management':
            window.open('../4-employee-systems/seokyoung-snt/employee-workspace.html', '_blank');
            showNotification('직원 업무 관리 시스템을 새 탭에서 열었습니다!', 'success');
            break;
        case 'analytics':
            window.open('../3-company-dashboards/seokyoung-snt/customer-management.html', '_blank');
            showNotification('고객 관리 및 분석 시스템을 새 탭에서 열었습니다!', 'success');
            break;
        case 'security':
            window.open('../3-company-dashboards/seokyoung-snt/admin/index.html', '_blank');
            showNotification('보안 관리자 시스템을 새 탭에서 열었습니다!', 'success');
            break;
        default:
            showNotification('해당 서비스는 준비 중입니다.', 'info');
    }
}

// 로그인 탭 전환
function switchTab(type) {
    const tabs = document.querySelectorAll('.tab-btn');
    const activeTab = document.querySelector(`.tab-btn[onclick="switchTab('${type}')"]`);
    
    tabs.forEach(tab => tab.classList.remove('active'));
    activeTab.classList.add('active');

    // 탭에 따른 로그인 폼 변경
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');

    if (type === 'company') {
        emailInput.placeholder = '기업 관리자 이메일';
        passwordInput.placeholder = '관리자 비밀번호';
    } else {
        emailInput.placeholder = '직원 이메일';
        passwordInput.placeholder = '직원 비밀번호';
    }
}

// 데모 로그인 - 플랫폼에서는 사용하지 않음
function loginDemo(type) {
    console.log('platform.js loginDemo 호출됨 - 무시됨, type:', type);
    return false; // 아무것도 하지 않음
}

// 알림 표시
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    // 자동 제거
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// 연락처 폼 제출
function handleContactForm(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const contactData = {
        companyName: formData.get('companyName'),
        contactName: formData.get('contactName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        message: formData.get('message'),
        submitDate: new Date().toISOString()
    };

    // 문의 데이터 저장
    const contacts = JSON.parse(localStorage.getItem('steelworks_contacts') || '[]');
    contacts.push(contactData);
    localStorage.setItem('steelworks_contacts', JSON.stringify(contacts));

    showNotification('문의가 성공적으로 접수되었습니다. 빠른 시일 내에 연락드리겠습니다.', 'success');
    event.target.reset();
}

// 스크롤 애니메이션
function initScrollAnimations() {
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

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Platform 초기화 시작');

    // 템플릿 갤러리 렌더링
    console.log('📋 템플릿 갤러리 렌더링 시작');
    renderTemplatesGrid();

    // 연락처 폼 이벤트 리스너
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactForm);
    }

    // 로그인 폼 이벤트 리스너 - 플랫폼 전용 로그인은 index.html에서 처리
    // const loginForm = document.getElementById('loginForm');
    // 비활성화됨 - 충돌 방지

    // 스크롤 애니메이션 초기화
    initScrollAnimations();

    // 부드러운 스크롤
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // 서비스 카드 클릭 이벤트 (이미 HTML에 onclick 있지만 보조)
    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0px)';
        });
    });

    console.log('✅ Platform 초기화 완료 - 모든 버튼과 링크가 활성화되었습니다!');
    
    // 템플릿 갤러리가 렌더링되었는지 확인
    setTimeout(() => {
        const templateCards = document.querySelectorAll('.template-card');
        console.log('📊 렌더링된 템플릿 카드 수:', templateCards.length);
        
        const globalSteelCard = document.querySelector('[data-template="global-steel"]');
        if (globalSteelCard) {
            console.log('🎯 Global Steel 카드 찾음:', globalSteelCard);
            const previewBtns = globalSteelCard.querySelectorAll('.template-preview-btn, .template-preview-action');
            console.log('🔍 미리보기 버튼 개수:', previewBtns.length);
            
            previewBtns.forEach((btn, index) => {
                console.log(`🔗 미리보기 버튼 ${index + 1}:`, btn);
                console.log(`🏷️ onclick 속성: ${btn.getAttribute('onclick')}`);
            });
        } else {
            console.log('❌ Global Steel 카드를 찾을 수 없음');
        }
        
        // previewTemplate 함수가 전역에서 접근 가능한지 확인
        console.log('🔧 previewTemplate 함수 접근 가능:', typeof window.previewTemplate !== 'undefined' ? '✅' : '❌');
        if (typeof window.previewTemplate === 'undefined') {
            window.previewTemplate = previewTemplate;
            console.log('🔧 previewTemplate을 window 객체에 추가함');
        }
    }, 500);
});

// 윈도우 클릭 이벤트로 모달 닫기
window.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// 직원 수 동기화 함수 (admin-dashboard.html에서 직원 추가/삭제 시 호출)
window.syncEmployeeCount = function(companyId) {
    console.log('🔄 직원 수 동기화 시작:', companyId);
    
    // companyId가 null이면 동기화하지 않음 (마스터 모드)
    if (!companyId || companyId === 'null') {
        console.log('⚠️ companyId가 null이므로 동기화를 건너뜁니다.');
        
        // 마스터 대시보드가 열려있다면 통계만 업데이트
        if (typeof window.updateMasterDashboardStats === 'function') {
            window.updateMasterDashboardStats();
            console.log('📊 마스터 대시보드 통계 즉시 업데이트');
        }
        
        console.log('✅ 직원 수 동기화 완료 (마스터 모드)');
        return;
    }
    
    // 회사별 직원 데이터 확인
    const companyEmployeesKey = `company_${companyId}_employees`;
    const companyEmployees = JSON.parse(localStorage.getItem(companyEmployeesKey) || '[]');
    const actualEmployeeCount = companyEmployees.length;
    
    console.log(`📊 회사별 직원 데이터: ${companyEmployeesKey} = ${actualEmployeeCount}명`);
    
    // platform_companies 업데이트
    const companies = JSON.parse(localStorage.getItem('platform_companies') || '[]');
    const companyIndex = companies.findIndex(c => c.id === companyId);
    
    if (companyIndex !== -1) {
        companies[companyIndex].users = actualEmployeeCount;
        localStorage.setItem('platform_companies', JSON.stringify(companies));
        console.log(`✅ ${companyId} 회사의 직원 수 업데이트: ${actualEmployeeCount}명`);
    } else {
        console.log(`⚠️ 회사 ID ${companyId}를 platform_companies에서 찾을 수 없음`);
    }
    
    // 통합 직원 목록 동기화 (특정 회사만)
    const allEmployees = JSON.parse(localStorage.getItem('employees') || '[]');
    console.log(`📋 동기화 전 통합 직원 수: ${allEmployees.length}명`);
    
    const filteredEmployees = allEmployees.filter(emp => emp.companyId !== companyId);
    const updatedEmployees = [...filteredEmployees, ...companyEmployees];
    
    console.log(`📋 동기화 후 통합 직원 수: ${updatedEmployees.length}명`);
    localStorage.setItem('employees', JSON.stringify(updatedEmployees));
    
    // 마스터 대시보드가 열려있다면 통계 즉시 업데이트
    if (typeof window.updateMasterDashboardStats === 'function') {
        window.updateMasterDashboardStats();
        console.log('📊 마스터 대시보드 통계 즉시 업데이트');
    }
    
    console.log('✅ 직원 수 동기화 완료');
};