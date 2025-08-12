// 설정 페이지 JavaScript (데이터베이스 기반)
console.log('settings.js 로드됨');

document.addEventListener('DOMContentLoaded', async function() {
    console.log('설정 페이지 DOM 로드 완료');
    
    // 데이터베이스 초기화 대기
    let retryCount = 0;
    while ((!window.db || !window.db.client) && retryCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
    }
    
    await loadSettings();
});

// 빈 설정값 (사용자가 직접 추가해야 함)
const defaultSettings = {
    paymentTerms: [],
    businessTypes: [],
    visitPurposes: [],
    regions: [],
    colors: []
};

// 설정 데이터 관리 (Supabase 사용)
const DropdownSettings = {
    // 현재 사용자 ID 가져오기
    getCurrentUserId: async function() {
        // currentUser에서 먼저 시도
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        console.log('👤 getCurrentUserId - currentUser:', currentUser);
        
        if (currentUser.id) {
            return currentUser.id;
        }
        
        // AuthManager 사용
        if (typeof AuthManager !== 'undefined') {
            const user = AuthManager.getCurrentUser();
            if (user && user.id) {
                return user.id;
            }
        }
        
        // userInfo로도 시도 (레거시 지원)
        const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
        return userInfo.id || null;
    },

    // 설정 가져오기
    get: async function() {
        try {
            const userId = await this.getCurrentUserId();
            console.log('🔍 DropdownSettings.get - userId:', userId);
            
            if (!userId) {
                console.warn('사용자 정보가 없습니다.');
                return { ...defaultSettings };
            }

            const db = new DatabaseManager();
            await db.init();
            const settings = await db.getUserSettings(userId);
            console.log('📊 DropdownSettings.get - 가져온 설정:', settings);
            
            return settings;
        } catch (error) {
            console.error('설정 조회 오류:', error);
            return { ...defaultSettings };
        }
    }
};

// 설정 로드 및 화면 업데이트
async function loadSettings() {
    try {
        console.log('🔄 settings.js loadSettings 시작');
        const settings = await DropdownSettings.get();
        console.log('📊 가져온 설정 데이터:', settings);
        
        // 드롭다운 로드
        console.log('🔄 드롭다운 옵션 로드 시작');
        await loadDropdownOptions(settings);
        console.log('✅ 드롭다운 옵션 로드 완료');
        
        // 목록 표시 (기존 함수들이 있으면)
        if (typeof displayPaymentTerms === 'function') {
            displayPaymentTerms(settings.paymentTerms || []);
        }
        if (typeof displayBusinessTypes === 'function') {
            displayBusinessTypes(settings.businessTypes || []);
        }
        if (typeof displayRegions === 'function') {
            displayRegions(settings.regions || []);
        }
        if (typeof displayVisitPurposes === 'function') {
            displayVisitPurposes(settings.visitPurposes || []);
        }
        if (typeof displayColors === 'function') {
            displayColors(settings.colors || []);
        }
        
    } catch (error) {
        console.error('설정 로드 오류:', error);
        
        // 오류 발생 시 빈 설정으로 드롭다운 로드
        const emptySettings = { ...defaultSettings };
        await loadDropdownOptions(emptySettings);
    }
}

// 드롭다운 옵션 로드
async function loadDropdownOptions(settings) {
    console.log('🔄 loadDropdownOptions 호출됨, settings:', settings);
    
    // 결제조건 드롭다운
    const paymentTermsDropdown = document.getElementById('paymentTermsDropdown');
    loadDropdown(paymentTermsDropdown, settings.paymentTerms || [], '결제조건');
    
    // 업종 드롭다운
    const businessTypesDropdown = document.getElementById('businessTypesDropdown');
    loadDropdown(businessTypesDropdown, settings.businessTypes || [], '업종');
    
    // 지역 드롭다운
    const regionsDropdown = document.getElementById('regionsDropdown');
    loadDropdown(regionsDropdown, settings.regions || [], '지역');
    
    // 방문목적 드롭다운
    const visitPurposesDropdown = document.getElementById('visitPurposesDropdown');
    loadDropdown(visitPurposesDropdown, settings.visitPurposes || [], '방문목적');
    
    // 색상 드롭다운
    const colorsDropdown = document.getElementById('colorsDropdown');
    loadColorDropdown(colorsDropdown, settings.colors || []);
}

// 일반 드롭다운 로드 헬퍼 함수
function loadDropdown(selectElement, items, type) {
    console.log(`🔄 loadDropdown 호출됨 - type: ${type}, items:`, items);
    console.log(`📋 selectElement:`, selectElement);
    
    if (!selectElement) {
        console.warn(`❌ ${type} 드롭다운 요소를 찾을 수 없습니다.`);
        return;
    }
    
    // 드롭다운 초기화
    selectElement.innerHTML = `<option value="">${type} 선택</option>`;
    
    // 아이템들 추가
    if (items && items.length > 0) {
        console.log(`✅ ${type} - ${items.length}개 아이템 추가 중`);
        items.forEach((item, index) => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            selectElement.appendChild(option);
            console.log(`  - ${index + 1}: ${item}`);
        });
    } else {
        console.log(`⚠️ ${type} - 추가할 아이템이 없습니다`);
    }
    
    // 직접입력 옵션 추가
    const customOption = document.createElement('option');
    customOption.value = '__custom__';
    customOption.textContent = '── 직접입력 ──';
    customOption.style.fontStyle = 'italic';
    selectElement.appendChild(customOption);
    
    console.log(`✅ ${type} 드롭다운 로드 완료 - 총 ${selectElement.options.length}개 옵션`);
}

// 색상 드롭다운 로드
function loadColorDropdown(selectElement, colors) {
    console.log('🎨 loadColorDropdown 호출됨, colors:', colors);
    
    if (!selectElement) {
        console.warn('❌ 색상 드롭다운 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 드롭다운 초기화
    selectElement.innerHTML = '<option value="">색상 선택</option>';
    
    // 색상들 추가
    if (colors && colors.length > 0) {
        console.log(`✅ 색상 - ${colors.length}개 아이템 추가 중`);
        colors.forEach((color, index) => {
            const option = document.createElement('option');
            option.value = color.key || color.name;
            option.textContent = color.name;
            if (color.value) {
                option.style.backgroundColor = color.value;
                option.style.color = getContrastColor(color.value);
            }
            selectElement.appendChild(option);
            console.log(`  - ${index + 1}: ${color.name} (${color.value})`);
        });
    } else {
        console.log('⚠️ 색상 - 추가할 아이템이 없습니다');
    }
    
    // 직접입력 옵션 추가
    const customOption = document.createElement('option');
    customOption.value = '__custom__';
    customOption.textContent = '── 직접입력 ──';
    customOption.style.fontStyle = 'italic';
    selectElement.appendChild(customOption);
    
    console.log(`✅ 색상 드롭다운 로드 완료 - 총 ${selectElement.options.length}개 옵션`);
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

// 전역에서 접근 가능하도록 설정
window.DropdownSettings = DropdownSettings;