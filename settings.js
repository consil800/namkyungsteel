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
        
        // 목록 표시는 드롭다운으로만 하고, 별도 리스트는 숨김
        hideAllLists();
        
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
            option.dataset.deletable = 'true'; // 삭제 가능 표시
            selectElement.appendChild(option);
            console.log(`  - ${index + 1}: ${item}`);
        });
    } else {
        console.log(`⚠️ ${type} - 추가할 아이템이 없습니다`);
    }
    
    // 삭제 옵션 추가
    if (items && items.length > 0) {
        const deleteOption = document.createElement('option');
        deleteOption.value = '__delete__';
        deleteOption.textContent = '── 기존 항목 삭제 ──';
        deleteOption.style.fontStyle = 'italic';
        deleteOption.style.color = '#dc3545';
        selectElement.appendChild(deleteOption);
    }
    
    // 직접입력 옵션 추가
    const customOption = document.createElement('option');
    customOption.value = '__custom__';
    customOption.textContent = '── 직접입력 ──';
    customOption.style.fontStyle = 'italic';
    selectElement.appendChild(customOption);
    
    // 드롭다운 변경 이벤트 리스너 추가
    selectElement.addEventListener('change', function() {
        handleDropdownChange(this, type);
    });
    
    console.log(`✅ ${type} 드롭다운 로드 완료 - 총 ${selectElement.options.length}개 옵션`);
}

// 드롭다운 변경 처리
function handleDropdownChange(selectElement, type) {
    const inputMap = {
        '결제조건': 'newPaymentTerm',
        '업종': 'newBusinessType',
        '지역': 'newRegion',
        '방문목적': 'newVisitPurpose'
    };
    
    const inputId = inputMap[type];
    const inputElement = document.getElementById(inputId);
    
    console.log(`🔄 드롭다운 변경: ${type}, 선택값: ${selectElement.value}`);
    
    if (selectElement.value === '__custom__') {
        // 직접입력 선택 시 입력창 보이기
        if (inputElement) {
            inputElement.style.display = 'block';
            inputElement.focus();
            console.log(`✅ ${type} 입력창 표시됨`);
        }
        // 드롭다운은 초기값으로 되돌리기
        selectElement.value = '';
    } else if (selectElement.value === '__delete__') {
        // 삭제 옵션 선택 시 삭제 프로세스 시작
        handleDeleteOption(selectElement, type);
        // 드롭다운은 초기값으로 되돌리기
        selectElement.value = '';
    } else {
        // 다른 값 선택 시 입력창 숨기기
        if (inputElement) {
            inputElement.style.display = 'none';
            inputElement.value = '';
        }
    }
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
            option.dataset.deletable = 'true'; // 삭제 가능 표시
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
    
    // 삭제 옵션 추가
    if (colors && colors.length > 0) {
        const deleteOption = document.createElement('option');
        deleteOption.value = '__delete__';
        deleteOption.textContent = '── 기존 색상 삭제 ──';
        deleteOption.style.fontStyle = 'italic';
        deleteOption.style.color = '#dc3545';
        selectElement.appendChild(deleteOption);
    }
    
    // 직접입력 옵션 추가
    const customOption = document.createElement('option');
    customOption.value = '__custom__';
    customOption.textContent = '── 직접입력 ──';
    customOption.style.fontStyle = 'italic';
    selectElement.appendChild(customOption);
    
    // 색상 드롭다운 변경 이벤트 리스너
    selectElement.addEventListener('change', function() {
        handleColorDropdownChange(this);
    });
    
    console.log(`✅ 색상 드롭다운 로드 완료 - 총 ${selectElement.options.length}개 옵션`);
}

// 색상 드롭다운 변경 처리
function handleColorDropdownChange(selectElement) {
    const colorInputArea = document.getElementById('colorInputArea');
    
    console.log(`🎨 색상 드롭다운 변경: ${selectElement.value}`);
    
    if (selectElement.value === '__custom__') {
        // 직접입력 선택 시 색상 입력 영역 보이기
        if (colorInputArea) {
            colorInputArea.style.display = 'block';
            // 색상 이름 입력창에 포커스
            const nameInput = document.getElementById('newColorName');
            if (nameInput) {
                setTimeout(() => nameInput.focus(), 100);
            }
            // 색상 미리보기 업데이트
            updateColorPreview();
        }
        console.log('✅ 색상 입력 영역 표시됨');
        
        // 드롭다운은 초기값으로 되돌리기
        selectElement.value = '';
    } else if (selectElement.value === '__delete__') {
        // 삭제 옵션 선택 시 색상 삭제 프로세스 시작
        handleDeleteColor(selectElement);
        // 드롭다운은 초기값으로 되돌리기
        selectElement.value = '';
    } else {
        // 다른 값 선택 시 색상 입력 영역 숨기기
        if (colorInputArea) {
            colorInputArea.style.display = 'none';
        }
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

// 리스트 숨기기 함수
function hideAllLists() {
    const listIds = [
        'paymentTermsList',
        'businessTypesList', 
        'regionsList',
        'visitPurposesList',
        'colorsList'
    ];
    
    listIds.forEach(listId => {
        const listElement = document.getElementById(listId);
        if (listElement) {
            listElement.innerHTML = '<li style="color: #666; font-style: italic;">드롭다운에서 선택하여 추가하세요</li>';
        }
    });
}

// 직접입력 데이터 저장 함수
async function saveToDatabase(type, value) {
    try {
        console.log(`💾 ${type} 값 "${value}" 저장 시작`);
        
        const userId = await DropdownSettings.getCurrentUserId();
        if (!userId) {
            throw new Error('사용자 정보가 없습니다.');
        }
        
        // 현재 업체 등록이나 업무일지 작성 시 저장되므로, 
        // 여기서는 임시 데이터로 client_companies에 저장
        const testCompany = {
            user_id: userId,
            company_name: `임시_${type}_${Date.now()}`,
            address: '임시 주소',
            contact_person: '임시 담당자',
            phone: '000-0000-0000',
            email: 'temp@temp.com',
            business_type: type === '업종' ? value : '기타',
            region: type === '지역' ? value : '기타',
            payment_terms: type === '결제조건' ? value : '기타',
            color_code: 'gray',
            notes: `${type} 값 "${value}" 저장을 위한 임시 데이터`,
            visit_count: 0,
            last_visit_date: null,
            created_at: new Date().toISOString()
        };
        
        const { data, error } = await window.db.client
            .from('client_companies')
            .insert([testCompany])
            .select();
        
        if (error) {
            console.error(`❌ ${type} 저장 오류:`, error);
            throw error;
        }
        
        console.log(`✅ ${type} 값 "${value}" 저장 완료:`, data);
        return true;
        
    } catch (error) {
        console.error(`❌ ${type} 저장 중 오류:`, error);
        throw error;
    }
}

// 추가 버튼 클릭 시 호출되는 함수들
async function addPaymentTerm() {
    await addItem('결제조건', 'newPaymentTerm');
}

async function addBusinessType() {
    await addItem('업종', 'newBusinessType');
}

async function addRegion() {
    await addItem('지역', 'newRegion');
}

async function addVisitPurpose() {
    await addItem('방문목적', 'newVisitPurpose');
}

// 색상 추가 버튼 클릭 (드롭다운에서 "직접입력" 선택하게 함)
async function addColor() {
    const colorsDropdown = document.getElementById('colorsDropdown');
    if (colorsDropdown) {
        // "직접입력" 옵션 선택
        colorsDropdown.value = '__custom__';
        handleColorDropdownChange(colorsDropdown);
    }
}

// 색상 추가 확인
async function confirmAddColor() {
    const nameInput = document.getElementById('newColorName');
    const valueInput = document.getElementById('newColorValue');
    
    if (!nameInput || !valueInput) {
        alert('색상 입력 요소를 찾을 수 없습니다.');
        return;
    }
    
    const colorName = nameInput.value.trim();
    const colorValue = valueInput.value;
    
    if (!colorName) {
        alert('색상 이름을 입력해주세요.');
        nameInput.focus();
        return;
    }
    
    try {
        // 색상을 데이터베이스에 저장
        await saveColorToDatabase(colorName, colorValue);
        
        // 입력 영역 숨기기 및 초기화
        cancelColorInput();
        
        alert(`색상 "${colorName}"이(가) 추가되었습니다! 새로고침 후 확인하세요.`);
        
        // 설정 다시 로드하여 드롭다운 업데이트
        setTimeout(async () => {
            await loadSettings();
        }, 1000);
        
    } catch (error) {
        console.error('색상 추가 오류:', error);
        alert('색상 추가 중 오류가 발생했습니다.');
    }
}

// 색상 입력 취소
function cancelColorInput() {
    const colorInputArea = document.getElementById('colorInputArea');
    const nameInput = document.getElementById('newColorName');
    const valueInput = document.getElementById('newColorValue');
    
    // 입력 영역 숨기기
    if (colorInputArea) {
        colorInputArea.style.display = 'none';
    }
    
    // 입력값 초기화
    if (nameInput) {
        nameInput.value = '';
    }
    if (valueInput) {
        valueInput.value = '#ff69b4';
    }
    
    // 미리보기 업데이트
    updateColorPreview();
}

// 색상 미리보기 업데이트
function updateColorPreview() {
    const valueInput = document.getElementById('newColorValue');
    const colorPreview = document.getElementById('colorPreview');
    
    if (valueInput && colorPreview) {
        const color = valueInput.value;
        colorPreview.style.backgroundColor = color;
        colorPreview.style.color = getContrastColor(color);
        colorPreview.textContent = `${color.toUpperCase()}`;
        
        // 색상 변경 이벤트 리스너 추가 (없으면)
        valueInput.removeEventListener('input', updateColorPreview);
        valueInput.addEventListener('input', updateColorPreview);
    }
}

// 일반 아이템 추가 공통 함수
async function addItem(type, inputId) {
    const inputElement = document.getElementById(inputId);
    
    if (!inputElement) {
        alert(`${type} 입력 요소를 찾을 수 없습니다.`);
        return;
    }
    
    const value = inputElement.value.trim();
    
    if (!value) {
        alert(`${type}을(를) 입력해주세요.`);
        return;
    }
    
    try {
        await saveToDatabase(type, value);
        
        // 입력창 초기화 및 숨기기
        inputElement.value = '';
        inputElement.style.display = 'none';
        
        alert(`${type} "${value}"이(가) 추가되었습니다! 새로고침 후 드롭다운에서 확인하세요.`);
        
        // 설정 다시 로드하여 드롭다운 업데이트
        setTimeout(async () => {
            await loadSettings();
        }, 1000);
        
    } catch (error) {
        console.error(`${type} 추가 오류:`, error);
        alert(`${type} 추가 중 오류가 발생했습니다.`);
    }
}

// 색상 저장 함수
async function saveColorToDatabase(colorName, colorValue) {
    const userId = await DropdownSettings.getCurrentUserId();
    if (!userId) {
        throw new Error('사용자 정보가 없습니다.');
    }
    
    const testCompany = {
        user_id: userId,
        company_name: `임시_색상_${Date.now()}`,
        address: '임시 주소',
        contact_person: '임시 담당자',
        phone: '000-0000-0000',
        email: 'temp@temp.com',
        business_type: '기타',
        region: '기타',
        payment_terms: '기타',
        color_code: colorValue.replace('#', ''), // # 제거
        notes: `색상 "${colorName}" (${colorValue}) 저장을 위한 임시 데이터`,
        visit_count: 0,
        last_visit_date: null,
        created_at: new Date().toISOString()
    };
    
    const { data, error } = await window.db.client
        .from('client_companies')
        .insert([testCompany])
        .select();
    
    if (error) {
        throw error;
    }
    
    return data;
}

// 삭제 옵션 처리 함수
async function handleDeleteOption(selectElement, type) {
    try {
        const userId = await DropdownSettings.getCurrentUserId();
        if (!userId) {
            alert('로그인이 필요합니다.');
            return;
        }

        const db = new DatabaseManager();
        await db.init();
        const settings = await db.getUserSettings(userId);
        
        let items = [];
        switch(type) {
            case '결제조건':
                items = settings.paymentTerms || [];
                break;
            case '업종':
                items = settings.businessTypes || [];
                break;
            case '지역':
                items = settings.regions || [];
                break;
            case '방문목적':
                items = settings.visitPurposes || [];
                break;
        }
        
        if (items.length === 0) {
            alert(`삭제할 ${type} 항목이 없습니다.`);
            return;
        }
        
        // 삭제할 항목 선택
        const itemToDelete = prompt(`삭제할 ${type}을(를) 입력하세요:\n\n사용 가능한 항목:\n${items.join(', ')}`);
        
        if (!itemToDelete || !itemToDelete.trim()) {
            return; // 취소됨
        }
        
        const trimmedItem = itemToDelete.trim();
        if (!items.includes(trimmedItem)) {
            alert('존재하지 않는 항목입니다.');
            return;
        }
        
        if (confirm(`"${trimmedItem}"을(를) 정말 삭제하시겠습니까?\n\n주의: 이 항목을 사용하는 모든 업체 데이터에서 해당 값이 제거됩니다.`)) {
            await deleteItemFromDatabase(type, trimmedItem, userId);
            alert(`${type} "${trimmedItem}"이(가) 삭제되었습니다.`);
            
            // 설정 다시 로드
            setTimeout(async () => {
                await loadSettings();
            }, 500);
        }
        
    } catch (error) {
        console.error(`${type} 삭제 오류:`, error);
        alert(`${type} 삭제 중 오류가 발생했습니다.`);
    }
}

// 색상 삭제 처리 함수
async function handleDeleteColor(selectElement) {
    try {
        const userId = await DropdownSettings.getCurrentUserId();
        if (!userId) {
            alert('로그인이 필요합니다.');
            return;
        }

        const db = new DatabaseManager();
        await db.init();
        const settings = await db.getUserSettings(userId);
        
        const colors = settings.colors || [];
        
        if (colors.length === 0) {
            alert('삭제할 색상이 없습니다.');
            return;
        }
        
        // 삭제할 색상 선택
        const colorNames = colors.map(c => c.name).join(', ');
        const colorToDelete = prompt(`삭제할 색상 이름을 입력하세요:\n\n사용 가능한 색상:\n${colorNames}`);
        
        if (!colorToDelete || !colorToDelete.trim()) {
            return; // 취소됨
        }
        
        const trimmedColor = colorToDelete.trim();
        const colorExists = colors.some(c => c.name === trimmedColor);
        
        if (!colorExists) {
            alert('존재하지 않는 색상입니다.');
            return;
        }
        
        if (confirm(`색상 "${trimmedColor}"을(를) 정말 삭제하시겠습니까?\n\n주의: 이 색상을 사용하는 모든 업체의 색상이 기본값으로 변경됩니다.`)) {
            await deleteColorFromDatabase(trimmedColor, userId);
            alert(`색상 "${trimmedColor}"이(가) 삭제되었습니다.`);
            
            // 설정 다시 로드
            setTimeout(async () => {
                await loadSettings();
            }, 500);
        }
        
    } catch (error) {
        console.error('색상 삭제 오류:', error);
        alert('색상 삭제 중 오류가 발생했습니다.');
    }
}

// 데이터베이스에서 항목 삭제
async function deleteItemFromDatabase(type, item, userId) {
    try {
        let updateField = '';
        let defaultValue = '';
        
        switch(type) {
            case '결제조건':
                updateField = 'payment_terms';
                defaultValue = '현금';
                break;
            case '업종':
                updateField = 'business_type';
                defaultValue = '기타';
                break;
            case '지역':
                updateField = 'region';
                defaultValue = '기타';
                break;
            case '방문목적':
                // 방문목적은 업무일지에서 사용되므로 별도 처리 필요
                console.log(`방문목적 "${item}" 삭제 - 업무일지 데이터는 유지됨`);
                return;
                break;
        }
        
        if (updateField) {
            // 해당 항목을 사용하는 모든 업체 데이터를 기본값으로 변경
            const { error } = await window.db.client
                .from('client_companies')
                .update({ [updateField]: defaultValue })
                .eq('user_id', userId)
                .eq(updateField, item);
            
            if (error) {
                throw error;
            }
            
            console.log(`✅ ${type} "${item}" 삭제 완료 - 관련 데이터를 "${defaultValue}"로 변경`);
        }
        
    } catch (error) {
        console.error(`❌ ${type} 데이터베이스 삭제 오류:`, error);
        throw error;
    }
}

// 데이터베이스에서 색상 삭제
async function deleteColorFromDatabase(colorName, userId) {
    try {
        // 해당 색상을 사용하는 모든 업체의 색상을 'gray'로 변경
        const { error } = await window.db.client
            .from('client_companies')
            .update({ color_code: 'gray' })
            .eq('user_id', userId)
            .or(`notes.ilike.%색상 "${colorName}"%`); // 임시 색상 데이터도 포함
        
        if (error) {
            throw error;
        }
        
        console.log(`✅ 색상 "${colorName}" 삭제 완료 - 관련 데이터를 "gray"로 변경`);
        
    } catch (error) {
        console.error(`❌ 색상 데이터베이스 삭제 오류:`, error);
        throw error;
    }
}

// 전역에서 접근 가능하도록 설정
window.DropdownSettings = DropdownSettings;
window.saveToDatabase = saveToDatabase;
window.addPaymentTerm = addPaymentTerm;
window.addBusinessType = addBusinessType;
window.addRegion = addRegion;
window.addVisitPurpose = addVisitPurpose;
window.addColor = addColor;
window.confirmAddColor = confirmAddColor;
window.cancelColorInput = cancelColorInput;
window.updateColorPreview = updateColorPreview;
window.handleDeleteOption = handleDeleteOption;
window.handleDeleteColor = handleDeleteColor;