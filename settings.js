// 설정 페이지 JavaScript (데이터베이스 기반)
console.log('settings.js 로드됨');

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 설정 페이지 로드 시작');
    
    // 간단한 사용자 인증
    const currentUser = await window.dataLoader.getCurrentUser();
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        window.location.href = 'login.html';
        return;
    }
    
    console.log('✅ 현재 사용자:', currentUser.name);
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

// 설정 로드 및 화면 업데이트 (단순화)
async function loadSettings() {
    try {
        console.log('🔄 설정 로드 시작');
        
        const currentUser = await window.dataLoader.getCurrentUser();
        if (!currentUser) {
            throw new Error('사용자 정보 없음');
        }
        
        const settings = await window.dataLoader.loadUserSettings(currentUser.id);
        console.log('📊 가져온 설정:', settings);
        
        // 설정이 없으면 기본값 사용
        const finalSettings = settings || { ...defaultSettings };
        
        // 화면에 표시
        displayItemLists(finalSettings);
        updateColorPreview();
        
        console.log('✅ 설정 로드 완료');
        
    } catch (error) {
        console.error('❌ 설정 로드 오류:', error);
        displayItemLists({ ...defaultSettings });
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

// 항목 리스트 표시 함수 (삭제 버튼 포함)
function displayItemLists(settings) {
    console.log('📋 displayItemLists 호출됨, settings:', settings);
    
    // 결제조건 리스트 표시
    displayItemList('paymentTermsList', settings.paymentTerms || [], '결제조건');
    
    // 업종 리스트 표시
    displayItemList('businessTypesList', settings.businessTypes || [], '업종');
    
    // 지역 리스트 표시
    displayItemList('regionsList', settings.regions || [], '지역');
    
    // 방문목적 리스트 표시
    displayItemList('visitPurposesList', settings.visitPurposes || [], '방문목적');
    
    // 색상 리스트 표시
    displayColorList('colorsList', settings.colors || []);
}

// 일반 항목 리스트 표시 함수
function displayItemList(listId, items, type) {
    const listElement = document.getElementById(listId);
    if (!listElement) return;
    
    console.log(`📝 ${type} 리스트 표시:`, items);
    
    if (items.length === 0) {
        listElement.innerHTML = `<li style="color: #666; font-style: italic;">저장된 ${type}이 없습니다. 위에서 추가하세요.</li>`;
        return;
    }
    
    listElement.innerHTML = '';
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'option-item';
        li.innerHTML = `
            <span class="option-text">${item}</span>
            <div class="option-actions">
                <button class="btn btn-danger btn-small" onclick="deleteItem('${type}', '${item.replace(/'/g, "\\'")}')">삭제</button>
            </div>
        `;
        listElement.appendChild(li);
    });
    
    console.log(`✅ ${type} 리스트 표시 완료 - ${items.length}개 항목`);
}

// 색상 리스트 표시 함수
function displayColorList(listId, colors) {
    const listElement = document.getElementById(listId);
    if (!listElement) return;
    
    console.log('🎨 색상 리스트 표시:', colors);
    
    if (colors.length === 0) {
        listElement.innerHTML = '<li style="color: #666; font-style: italic;">저장된 색상이 없습니다. 위에서 추가하세요.</li>';
        return;
    }
    
    listElement.innerHTML = '';
    colors.forEach(color => {
        // 색상 값과 방문일 숨김 설정 파싱
        let colorValue = color.value;
        let hideVisitDate = false;
        
        try {
            if (typeof color.value === 'string' && color.value.startsWith('{')) {
                const metadata = JSON.parse(color.value);
                colorValue = metadata.color;
                hideVisitDate = metadata.hideVisitDate || false;
            }
        } catch (e) {
            // 파싱 실패 시 기본값 사용
        }
        
        // 회색은 항상 방문일 숨김
        if (color.name === '회색' || color.name === 'gray') {
            hideVisitDate = true;
        }
        
        const li = document.createElement('li');
        li.className = 'option-item';
        li.innerHTML = `
            <span class="option-text">
                <span class="color-preview" style="background-color: ${colorValue}; display: inline-block; width: 20px; height: 20px; border-radius: 50%; margin-right: 10px; border: 1px solid #ddd; vertical-align: middle;"></span>
                ${color.name}
                ${hideVisitDate ? '<span style="margin-left: 10px; color: #666; font-size: 12px;">(방문일 숨김)</span>' : ''}
            </span>
            <div class="option-actions">
                <button class="btn btn-danger btn-small" onclick="deleteColor('${color.name.replace(/'/g, "\\'")}')">삭제</button>
            </div>
        `;
        listElement.appendChild(li);
    });
    
    console.log(`✅ 색상 리스트 표시 완료 - ${colors.length}개 항목`);
}

// 직접입력 데이터 저장 함수 (user_settings 테이블 사용)
async function saveToDatabase(type, value) {
    try {
        console.log(`💾 ${type} 값 "${value}" 저장 시작`);
        
        const userId = await DropdownSettings.getCurrentUserId();
        if (!userId) {
            throw new Error('사용자 정보가 없습니다.');
        }
        
        // 타입 매핑
        const typeMapping = {
            '결제조건': 'payment_terms',
            '업종': 'business_type',
            '지역': 'region',
            '방문목적': 'visit_purpose'
        };
        
        const settingType = typeMapping[type];
        if (!settingType) {
            throw new Error(`알 수 없는 설정 타입: ${type}`);
        }
        
        // user_settings 테이블에 저장
        const db = new DatabaseManager();
        await db.init();
        await db.addUserSetting(userId, settingType, value);
        
        console.log(`✅ ${type} 값 "${value}" user_settings에 저장 완료`);
        
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

// 색상 추가 함수 (이제 필요 없음 - confirmAddColor를 직접 사용)

// 색상 추가 확인
async function confirmAddColor() {
    const nameInput = document.getElementById('newColorName');
    const valueInput = document.getElementById('newColorValue');
    const hideVisitDateInput = document.getElementById('newColorHideVisitDate');
    
    if (!nameInput || !valueInput) {
        alert('색상 입력 요소를 찾을 수 없습니다.');
        return;
    }
    
    const colorName = nameInput.value.trim();
    const colorValue = valueInput.value;
    const hideVisitDate = hideVisitDateInput ? hideVisitDateInput.checked : false;
    
    if (!colorName) {
        alert('색상 이름을 입력해주세요.');
        nameInput.focus();
        return;
    }
    
    try {
        // 색상을 데이터베이스에 저장 (hideVisitDate 포함)
        await saveColorToDatabase(colorName, colorValue, hideVisitDate);
        
        // 입력창 초기화
        nameInput.value = '';
        valueInput.value = '#ff69b4';
        if (hideVisitDateInput) hideVisitDateInput.checked = false;
        updateColorPreview();
        
        alert(`색상 "${colorName}"이(가) 추가되었습니다! 새로고침 후 확인하세요.`);
        
        // 설정 다시 로드하여 드롭다운 및 리스트 업데이트
        setTimeout(async () => {
            await loadSettings();
        }, 1000);
        
    } catch (error) {
        console.error('색상 추가 오류:', error);
        alert('색상 추가 중 오류가 발생했습니다.');
    }
}


// 색상 미리보기 업데이트
function updateColorPreview() {
    const valueInput = document.getElementById('newColorValue');
    const colorPreview = document.getElementById('colorPreview');
    
    if (valueInput && colorPreview) {
        const color = valueInput.value;
        colorPreview.style.backgroundColor = color;
        colorPreview.style.color = getContrastColor(color);
        colorPreview.textContent = `미리보기`;
        
        // 색상 변경 이벤트 리스너 추가 (한번만)
        if (!valueInput.hasAttribute('data-listener-added')) {
            valueInput.addEventListener('input', updateColorPreview);
            valueInput.setAttribute('data-listener-added', 'true');
        }
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
        
        // 입력창 초기화
        inputElement.value = '';
        
        alert(`${type} "${value}"이(가) 추가되었습니다! 새로고침 후 드롭다운에서 확인하세요.`);
        
        // 설정 다시 로드하여 드롭다운 및 리스트 업데이트
        setTimeout(async () => {
            await loadSettings();
        }, 1000);
        
    } catch (error) {
        console.error(`${type} 추가 오류:`, error);
        alert(`${type} 추가 중 오류가 발생했습니다.`);
    }
}

// 색상 저장 함수 (user_settings 테이블 사용)
async function saveColorToDatabase(colorName, colorValue, hideVisitDate = false) {
    const userId = await DropdownSettings.getCurrentUserId();
    if (!userId) {
        throw new Error('사용자 정보가 없습니다.');
    }
    
    // user_settings 테이블에 색상 저장 (hideVisitDate 정보 포함)
    const db = new DatabaseManager();
    await db.init();
    const metadata = {
        color: colorValue,
        hideVisitDate: hideVisitDate
    };
    await db.addUserSetting(userId, 'color', colorName, colorName, JSON.stringify(metadata));
    
    console.log(`✅ 색상 "${colorName}" (${colorValue}) user_settings에 저장 완료`);
    
    return true;
}

// 항목 삭제 함수 (리스트에서 삭제 버튼 클릭 시)
async function deleteItem(type, item) {
    try {
        if (!confirm(`"${item}"을(를) 정말 삭제하시겠습니까?`)) {
            return;
        }
        
        const userId = await DropdownSettings.getCurrentUserId();
        if (!userId) {
            alert('로그인이 필요합니다.');
            return;
        }
        
        // 타입 매핑
        const typeMapping = {
            '결제조건': 'payment_terms',
            '업종': 'business_type',
            '지역': 'region',
            '방문목적': 'visit_purpose'
        };
        
        const settingType = typeMapping[type];
        if (!settingType) {
            alert(`알 수 없는 설정 타입: ${type}`);
            return;
        }
        
        // user_settings 테이블에서 삭제
        const db = new DatabaseManager();
        await db.init();
        await db.deleteUserSetting(userId, settingType, item);
        
        alert(`${type} "${item}"이(가) 삭제되었습니다.`);
        
        // 설정 다시 로드
        setTimeout(async () => {
            await loadSettings();
        }, 500);
        
    } catch (error) {
        console.error(`${type} 삭제 오류:`, error);
        alert(`${type} 삭제 중 오류가 발생했습니다.`);
    }
}

// 색상 삭제 함수 (리스트에서 삭제 버튼 클릭 시)
async function deleteColor(colorName) {
    try {
        console.log(`🗑️ 색상 삭제 시작: "${colorName}"`);
        
        if (!confirm(`색상 "${colorName}"을(를) 정말 삭제하시겠습니까?`)) {
            console.log('❌ 사용자가 삭제를 취소했습니다.');
            return;
        }
        
        const userId = await DropdownSettings.getCurrentUserId();
        console.log(`👤 사용자 ID: ${userId}`);
        
        if (!userId) {
            alert('로그인이 필요합니다.');
            return;
        }
        
        // user_settings 테이블에서 색상 삭제
        const db = new DatabaseManager();
        await db.init();
        await db.deleteUserSetting(userId, 'color', colorName);
        
        alert(`색상 "${colorName}"이(가) 삭제되었습니다.`);
        
        console.log(`✅ 색상 "${colorName}" 삭제 완료, 설정 다시 로드 중...`);
        
        // 설정 다시 로드
        setTimeout(async () => {
            await loadSettings();
        }, 500);
        
    } catch (error) {
        console.error('❌ 색상 삭제 오류:', error);
        alert('색상 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}


// 전역에서 접근 가능하도록 설정
window.DropdownSettings = DropdownSettings;
window.saveToDatabase = saveToDatabase;
window.addPaymentTerm = addPaymentTerm;
window.addBusinessType = addBusinessType;
window.addRegion = addRegion;
window.addVisitPurpose = addVisitPurpose;
window.confirmAddColor = confirmAddColor;
window.updateColorPreview = updateColorPreview;
window.deleteItem = deleteItem;
window.deleteColor = deleteColor;