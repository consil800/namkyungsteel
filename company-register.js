// 업체 등록 페이지 JavaScript

let currentUser = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 업체 등록 페이지 로드 시작');
    
    // 간단한 사용자 인증
    currentUser = await window.dataLoader.getCurrentUser();
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        window.location.href = 'login.html';
        return;
    }

    console.log('✅ 현재 사용자:', currentUser.name);

    // 드롭다운 옵션 로드
    await loadDropdownOptions();

    const form = document.getElementById('companyForm');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // 폼 제출 이벤트
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('폼 제출 시작');
        
        const formData = new FormData(form);
        const companyData = {
            company_name: formData.get('companyName').trim(),
            region: formData.get('region').trim(),
            address: formData.get('address').trim(),
            phone: formData.get('phone').trim(),
            contact_person: formData.get('contactPerson').trim(),
            mobile: formData.get('mobile').trim(),
            email: formData.get('email').trim(),
            payment_terms: formData.get('paymentTerms').trim(),
            debt_amount: formData.get('debtAmount').trim(),
            business_type: formData.get('businessType').trim(),
            products: formData.get('products').trim(),
            usage_items: formData.get('usageItems').trim(),
            notes: formData.get('notes').trim(),
            color_code: formData.get('companyColor') || '',
            visit_count: 0,
            last_visit_date: null,
            user_id: currentUser.id,
            company_domain: currentUser.company_domain || 'namkyungsteel.com'
        };

        console.log('폼 데이터:', companyData);

        // 필수 필드 검증
        if (!companyData.company_name) {
            alert('업체명을 입력해주세요.');
            document.getElementById('companyName').focus();
            return;
        }

        if (!companyData.region) {
            alert('지역을 선택해주세요.');
            document.getElementById('region').focus();
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = '등록 중...';

            console.log('📝 업체 등록 시작');
            
            // 간단한 업체 등록
            const result = await window.dataLoader.createCompany(companyData, currentUser.id);
            
            if (result.success) {
                // 업체 목록 캐시 무효화
                window.DataCache.clearCompanies(currentUser.id);
                
                alert('업체가 성공적으로 등록되었습니다.');
                window.location.href = 'worklog.html';
            } else {
                throw new Error('업체 등록에 실패했습니다.');
            }

        } catch (error) {
            console.error('업체 등록 오류:', error);
            alert('업체 등록 중 오류가 발생했습니다: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '등록';
        }
    });

    // 취소 버튼
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (confirm('작성 중인 내용이 사라집니다. 정말로 취소하시겠습니까?')) {
                window.location.href = 'worklog.html';
            }
        });
    }
});

// 제거됨 - data-loader.js에서 처리

// 드롭다운 옵션 로드
async function loadDropdownOptions() {
    console.log('드롭다운 옵션 로드 시작');
    
    try {
        // 데이터베이스 초기화 대기
        if (!window.DropdownLoader) {
            console.error('DropdownLoader가 로드되지 않았습니다.');
            loadBasicOptions();
            return;
        }

        // 각 드롭다운 로드 (직접입력 옵션 없이)
        const regionSelect = document.getElementById('region');
        if (regionSelect) {
            await DropdownLoader.loadRegionsOnly(regionSelect);
        }

        const paymentTermsSelect = document.getElementById('paymentTerms');
        if (paymentTermsSelect) {
            await DropdownLoader.loadPaymentTermsOnly(paymentTermsSelect);
        }

        const businessTypeSelect = document.getElementById('businessType');
        if (businessTypeSelect) {
            await DropdownLoader.loadBusinessTypesOnly(businessTypeSelect);
        }

        const colorSelect = document.getElementById('companyColor');
        if (colorSelect) {
            await DropdownLoader.loadColorsOnly(colorSelect);
        }

        console.log('드롭다운 옵션 로드 완료');

    } catch (error) {
        console.error('드롭다운 옵션 로드 오류:', error);
        
        // 오류 시 최소한의 기본값 로드
        loadBasicOptions();
    }
}

// 빈 옵션 로드 (오류 시 백업)
function loadBasicOptions() {
    console.log('빈 옵션 로드 - 사용자가 설정 페이지에서 항목을 추가해야 합니다.');
    
    // 드롭다운에는 기본 선택 옵션만 남겨두고 직접입력 옵션은 제거
    const regionSelect = document.getElementById('region');
    if (regionSelect && regionSelect.options.length <= 1) {
        console.log('지역 드롭다운이 비어있습니다. 설정 페이지에서 항목을 추가하세요.');
    }

    const paymentTermsSelect = document.getElementById('paymentTerms');
    if (paymentTermsSelect && paymentTermsSelect.options.length <= 1) {
        console.log('결제조건 드롭다운이 비어있습니다. 설정 페이지에서 항목을 추가하세요.');
    }

    const businessTypeSelect = document.getElementById('businessType');
    if (businessTypeSelect && businessTypeSelect.options.length <= 1) {
        console.log('업종 드롭다운이 비어있습니다. 설정 페이지에서 항목을 추가하세요.');
    }

    const colorSelect = document.getElementById('companyColor');
    if (colorSelect && colorSelect.options.length <= 1) {
        console.log('색상 드롭다운이 비어있습니다. 설정 페이지에서 항목을 추가하세요.');
    }
}

// 텍스트 대비 색상 계산
function getContrastColor(hexcolor) {
    if (!hexcolor) return '#000000';
    
    // # 제거
    hexcolor = hexcolor.replace('#', '');
    
    // RGB 값 추출
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    
    // 밝기 계산
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    return brightness > 155 ? '#000000' : '#ffffff';
}