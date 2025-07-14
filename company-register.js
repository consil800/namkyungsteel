// 업체 등록 페이지 JavaScript

let currentUser = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('업체 등록 페이지 로드 시작');
    
    // 데이터베이스 초기화 대기
    await waitForDatabase();
    
    // 로그인 확인
    currentUser = AuthManager.getCurrentUser();
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        window.location.href = 'login.html';
        return;
    }

    console.log('현재 사용자:', currentUser);

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
            company_color: formData.get('companyColor') || '',
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

            console.log('데이터베이스 저장 시작');
            
            // 데이터베이스에 저장 (개인 업체로)
            if (window.db && window.db.client) {
                const result = await window.db.createClientCompany(companyData);
                console.log('저장 결과:', result);
                
                if (result.success) {
                    alert('업체가 성공적으로 등록되었습니다.');
                    // worklog.html로 돌아가기
                    window.location.href = 'worklog.html';
                } else {
                    throw new Error('업체 등록에 실패했습니다.');
                }
            } else {
                throw new Error('데이터베이스 연결이 필요합니다.');
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

// 데이터베이스 초기화 대기
async function waitForDatabase() {
    let retryCount = 0;
    while ((!window.db || !window.db.client) && retryCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
    }
    console.log('데이터베이스 초기화 상태:', !!window.db, !!window.db?.client);
}

// 드롭다운 옵션 로드
async function loadDropdownOptions() {
    console.log('드롭다운 옵션 로드 시작');
    
    try {
        // 로컬 스토리지에서 설정 가져오기
        const storedSettings = localStorage.getItem('dropdownSettings');
        let settings;
        
        if (storedSettings) {
            settings = JSON.parse(storedSettings);
        } else {
            // 기본값 설정
            settings = {
                paymentTerms: ['현금', '월말결제', '30일', '45일', '60일', '90일', '어음', '기타'],
                businessTypes: ['제조업', '건설업', '유통업', '기타'],
                regions: ['서울','부산','대구','경주','김해','양산','함안','밀양','창원','창녕','울산','목포','광주','광양'].sort((a, b) => a.localeCompare(b)),
                colors: [
                    { key: 'red', name: '빨강', value: '#e74c3c' },
                    { key: 'orange', name: '주황', value: '#f39c12' },
                    { key: 'yellow', name: '노랑', value: '#f1c40f' },
                    { key: 'green', name: '초록', value: '#27ae60' },
                    { key: 'blue', name: '파랑', value: '#3498db' },
                    { key: 'purple', name: '보라', value: '#9b59b6' },
                    { key: 'gray', name: '회색', value: '#95a5a6' }
                ]
            };
        }

        console.log('드롭다운 설정:', settings);

        // 지역 드롭다운 로드
        const regionSelect = document.getElementById('region');
        if (regionSelect && settings.regions) {
            settings.regions.forEach(region => {
                const option = document.createElement('option');
                option.value = region;
                option.textContent = region;
                regionSelect.appendChild(option);
            });
        }

        // 결제조건 드롭다운 로드
        const paymentTermsSelect = document.getElementById('paymentTerms');
        if (paymentTermsSelect && settings.paymentTerms) {
            settings.paymentTerms.forEach(term => {
                const option = document.createElement('option');
                option.value = term;
                option.textContent = term;
                paymentTermsSelect.appendChild(option);
            });
        }

        // 업종 드롭다운 로드
        const businessTypeSelect = document.getElementById('businessType');
        if (businessTypeSelect && settings.businessTypes) {
            settings.businessTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                businessTypeSelect.appendChild(option);
            });
        }

        // 색상 드롭다운 로드
        const colorSelect = document.getElementById('companyColor');
        if (colorSelect && settings.colors) {
            settings.colors.forEach(color => {
                const option = document.createElement('option');
                option.value = color.key;
                option.textContent = color.name;
                option.style.backgroundColor = color.value;
                option.style.color = getContrastColor(color.value);
                colorSelect.appendChild(option);
            });
        }

        console.log('드롭다운 옵션 로드 완료');

    } catch (error) {
        console.error('드롭다운 옵션 로드 오류:', error);
        
        // 오류 시 최소한의 기본값 로드
        loadBasicOptions();
    }
}

// 기본 옵션 로드 (오류 시 백업)
function loadBasicOptions() {
    console.log('기본 옵션 로드');
    
    // 기본 지역
    const regions = ['서울','부산','대구','경주','김해','양산','함안','밀양','창원','창녕','울산','목포','광주','광양'];
    const regionSelect = document.getElementById('region');
    if (regionSelect) {
        regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            regionSelect.appendChild(option);
        });
    }

    // 기본 결제조건
    const paymentTerms = ['현금', '월말결제', '30일', '45일', '60일', '90일', '어음', '기타'];
    const paymentTermsSelect = document.getElementById('paymentTerms');
    if (paymentTermsSelect) {
        paymentTerms.forEach(term => {
            const option = document.createElement('option');
            option.value = term;
            option.textContent = term;
            paymentTermsSelect.appendChild(option);
        });
    }

    // 기본 업종
    const businessTypes = ['제조업', '건설업', '유통업', '기타'];
    const businessTypeSelect = document.getElementById('businessType');
    if (businessTypeSelect) {
        businessTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            businessTypeSelect.appendChild(option);
        });
    }

    // 기본 색상
    const colors = [
        { key: 'red', name: '빨강', value: '#e74c3c' },
        { key: 'orange', name: '주황', value: '#f39c12' },
        { key: 'yellow', name: '노랑', value: '#f1c40f' },
        { key: 'green', name: '초록', value: '#27ae60' },
        { key: 'blue', name: '파랑', value: '#3498db' },
        { key: 'purple', name: '보라', value: '#9b59b6' },
        { key: 'gray', name: '회색', value: '#95a5a6' }
    ];
    const colorSelect = document.getElementById('companyColor');
    if (colorSelect) {
        colors.forEach(color => {
            const option = document.createElement('option');
            option.value = color.key;
            option.textContent = color.name;
            option.style.backgroundColor = color.value;
            option.style.color = getContrastColor(color.value);
            colorSelect.appendChild(option);
        });
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