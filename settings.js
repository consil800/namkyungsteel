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
    paymentTerms: ['현금', '어음', '카드', '계좌이체', '분할결제', '현금+어음', '기타'],
    businessTypes: ['제조업', '건설업', '도매업', '소매업', '운수업', '통신업', '금융업', '부동산업', '서비스업', '기타'],
    visitPurposes: ['영업상담', '계약체결', '납품', '수금', 'A/S', '클레임처리', '정기방문', '기타'],
    regions: ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'],
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

    // 설정 가져오기 (캐시 활용)
    get: async function() {
        try {
            const userId = await this.getCurrentUserId();
            console.log('🔍 DropdownSettings.get - userId:', userId);
            
            if (!userId) {
                console.warn('사용자 정보가 없습니다.');
                return { ...defaultSettings };
            }

            // cachedDataLoader를 통해 설정 가져오기
            const settings = await window.cachedDataLoader.loadUserSettings(userId);
            console.log('📊 DropdownSettings.get - 캐시에서 가져온 설정:', settings);
            
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
        
        // 데이터베이스 초기화 완료 대기
        await window.dataLoader.ensureDatabase();
        
        // 설정 페이지에서는 항상 캐시 무효화 (최신 데이터 보장)
        console.log('🔄 설정 페이지 캐시 강제 무효화');
        if (window.cachedDataLoader && window.cachedDataLoader.invalidateSettingsCache) {
            // 일단 현재 사용자 ID를 알아야 하므로 임시로 userId 3 사용
            window.cachedDataLoader.invalidateSettingsCache(3);
        }
        
        const currentUser = await window.dataLoader.getCurrentUser();
        if (!currentUser || !currentUser.id) {
            console.error('❌ 사용자 정보 없음 또는 ID 누락');
            throw new Error('사용자 정보 없음');
        }
        
        console.log('🔒 보안 확인 - 현재 사용자:', {
            id: currentUser.id,
            name: currentUser.name,
            role: currentUser.role
        });
        
        // 디버깅: 직접 데이터베이스에서 user_settings 확인
        try {
            console.log('🔍 디버깅: user_settings 테이블 직접 확인');
            const db = new DatabaseManager();
            await db.init();
            
            // 모든 user_settings 레코드 확인 (디버깅용)
            const { data: allCheck, error: allError } = await db.client
                .from('user_settings')
                .select('user_id, setting_type, setting_value, color_value, created_at')
                .limit(20);
            
            if (allError) {
                console.error('❌ 전체 확인 오류:', allError);
            } else {
                console.log('📊 전체 user_settings 확인:', allCheck);
                console.log(`📊 전체 설정 개수:`, allCheck?.length || 0);
            }
            
            // 현재 사용자의 설정 확인
            const { data: directCheck, error: checkError } = await db.client
                .from('user_settings')
                .select('*')
                .eq('user_id', currentUser.id)
                .limit(10);
                
            if (checkError) {
                console.error('❌ 직접 확인 오류:', checkError);
            } else {
                console.log('📊 직접 확인 결과:', directCheck);
                console.log(`📊 사용자 ${currentUser.id}의 설정 개수:`, directCheck?.length || 0);
            }
            
            // getUserSettings 함수 직접 호출
            console.log('🔄 getUserSettings 직접 호출');
            const directSettings = await db.getUserSettings(currentUser.id);
            console.log('📋 getUserSettings 결과:', directSettings);
            
        } catch (debugError) {
            console.error('❌ 디버깅 쿼리 오류:', debugError);
        }
        
        // 최대 3번 재시도로 설정 로드
        let settings = null;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries && (!settings || Object.keys(settings).every(key => !settings[key] || settings[key].length === 0))) {
            if (retryCount > 0) {
                console.log(`🔄 설정 로드 재시도 ${retryCount}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // 직접 데이터베이스에서 조회 (캐시 우회)
            console.log(`🔍 설정 로드 시도 ${retryCount + 1}/${maxRetries} - 사용자 ID: ${currentUser.id}`);
            
            if (retryCount === 0) {
                // 첫 번째 시도: 캐시 사용
                settings = await window.cachedDataLoader.loadUserSettings(currentUser.id);
            } else {
                // 재시도: 직접 데이터베이스에서 조회
                console.log('🔄 캐시 우회하여 직접 데이터베이스 조회');
                const db = new DatabaseManager();
                await db.init();
                settings = await db.getUserSettings(currentUser.id);
                console.log('📊 직접 DB 조회 결과:', settings);
            }
            
            // 추가 보안 검증: 로드된 설정이 현재 사용자 것인지 확인
            if (settings && settings.colors && settings.colors.length > 0) {
                console.log('📊 로드된 색상 설정:', settings.colors.map(c => ({
                    name: c.name,
                    key: c.key
                })));
            }
            
            retryCount++;
        }
        
        console.log('📊 캐시에서 가져온 설정:', settings);
        
        // 설정이 비어있으면 기본값 사용 (RLS 문제로 인해 저장 비활성화)
        if (!settings || Object.keys(settings).every(key => !settings[key] || settings[key].length === 0)) {
            console.log('📝 빈 설정 감지됨. RLS 문제로 인해 기본값 사용...');
            // RLS 정책 문제로 인해 기본 설정 저장을 임시 비활성화
            // await saveDefaultSettingsToDatabase(currentUser.id);
        }
        
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

// 기본 설정을 데이터베이스에 저장
async function saveDefaultSettingsToDatabase(userId) {
    console.log('🔧 기본 설정을 데이터베이스에 저장 시작');
    
    try {
        const db = new DatabaseManager();
        await db.init();
        
        // 기본 지역 저장
        for (const region of defaultSettings.regions) {
            try {
                const result = await db.addUserSetting(userId, 'region', region, region);
                if (result.error === 'rls_policy_violation') {
                    console.log(`지역 "${region}" RLS 정책으로 건너뜀`);
                    continue;
                }
            } catch (error) {
                if (!error.message?.includes('setting_already_exists') && error.code !== '42501') {
                    console.error(`지역 "${region}" 저장 오류:`, error);
                }
            }
        }
        
        // RLS 정책 문제로 인해 기본 설정 저장을 건너뜀
        console.log('⚠️ RLS 정책 문제로 인해 기본 설정 저장을 건너뜀');
        return;
        
        // 기본 업종 저장 (비활성화)
        // 기본 결제조건 저장 (비활성화)  
        // 기본 방문목적 저장 (비활성화)
        // 기본 색상 저장 (비활성화)
        
        // 캐시 무효화
        if (window.cachedDataLoader) {
            window.cachedDataLoader.invalidateSettingsCache(userId);
        }
        
        console.log('✅ 기본 설정 데이터베이스 저장 완료');
    } catch (error) {
        console.error('❌ 기본 설정 저장 오류:', error);
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
    colors.forEach((color, index) => {
        // database.js에서 이미 파싱된 색상 값과 설정 사용
        const colorValue = color.value; // 이미 파싱된 HEX 색상값
        let hideVisitDate = color.hideVisitDate || false;
        
        // 회색은 항상 방문일 숨김
        if (color.name === '회색' || color.name === 'gray') {
            hideVisitDate = true;
        }
        
        const li = document.createElement('li');
        li.className = 'color-meaning-item';
        li.innerHTML = `
            <div style="display: flex; align-items: center; min-width: 120px;">
                <span class="color-preview" style="background-color: ${colorValue}; display: inline-block; width: 24px; height: 24px; border-radius: 50%; margin-right: 10px; border: 2px solid #ddd; vertical-align: middle;"></span>
                <span style="font-weight: 600; color: #2c3e50;">${color.name}</span>
                ${hideVisitDate ? '<span style="margin-left: 8px; color: #666; font-size: 11px; background: #e9ecef; padding: 2px 6px; border-radius: 10px;">[방문일숨김]</span>' : ''}
            </div>
            <input type="text" class="color-meaning-input" id="meaning-${index}" value="${color.meaning || ''}" placeholder="색상의 의미를 입력하세요 (예: 거래중, 재무상태불량, 철판 안씀)" style="flex: 1;">
            <button class="btn-save-meaning" onclick="saveColorMeaningFromInput('${color.name.replace(/'/g, "\\'")}', 'meaning-${index}')">저장</button>
            <button class="btn btn-danger btn-small" onclick="deleteColor('${color.name.replace(/'/g, "\\'")}')">삭제</button>
        `;
        listElement.appendChild(li);
    });
    
    console.log(`✅ 색상 리스트 표시 완료 - ${colors.length}개 항목`);
    
    // 색상 의미 가이드 업데이트
    updateColorMeaningsDisplay(colors);
}

// 색상 의미 가이드 표시 함수
function updateColorMeaningsDisplay(colors) {
    const meaningsList = document.getElementById('colorMeaningsList');
    if (!meaningsList) return;
    
    if (!colors || colors.length === 0) {
        meaningsList.innerHTML = '<p style="color: #999; font-style: italic;">색상을 추가하면 여기에 의미가 표시됩니다.</p>';
        return;
    }
    
    const meaningsWithColor = colors.filter(color => color.meaning && color.meaning.trim());
    
    if (meaningsWithColor.length === 0) {
        meaningsList.innerHTML = '<p style="color: #999; font-style: italic;">색상 의미가 설정된 색상이 없습니다.</p>';
        return;
    }
    
    const meaningsHTML = meaningsWithColor.map(color => {
        let colorValue = color.value;
        try {
            if (typeof color.value === 'string' && color.value.startsWith('{')) {
                const metadata = JSON.parse(color.value);
                colorValue = metadata.color;
            }
        } catch (e) {
            // 파싱 실패 시 기본값 사용
        }
        
        return `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="display: inline-block; width: 16px; height: 16px; background-color: ${colorValue}; border-radius: 50%; margin-right: 8px; border: 1px solid #ddd;"></span>
                <span style="font-weight: 600; margin-right: 8px;">${color.name}:</span>
                <span style="color: #666;">${color.meaning}</span>
            </div>
        `;
    }).join('');
    
    meaningsList.innerHTML = meaningsHTML;
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
        
        // 캐시 무효화
        window.cachedDataLoader.invalidateSettingsCache(userId);
        
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
    const meaningInput = document.getElementById('newColorMeaning');
    const hideVisitDateInput = document.getElementById('newColorHideVisitDate');
    
    if (!nameInput || !valueInput) {
        alert('색상 입력 요소를 찾을 수 없습니다.');
        return;
    }
    
    const colorName = nameInput.value.trim();
    const colorValue = valueInput.value;
    const colorMeaning = meaningInput ? meaningInput.value.trim() : '';
    const hideVisitDate = hideVisitDateInput ? hideVisitDateInput.checked : false;
    
    if (!colorName) {
        alert('색상 이름을 입력해주세요.');
        nameInput.focus();
        return;
    }
    
    try {
        // 색상을 데이터베이스에 저장 (hideVisitDate와 의미 포함)
        await saveColorToDatabase(colorName, colorValue, hideVisitDate, colorMeaning);
        
        // 입력창 초기화
        nameInput.value = '';
        valueInput.value = '#ff69b4';
        if (meaningInput) meaningInput.value = '';
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
async function saveColorToDatabase(colorName, colorValue, hideVisitDate = false, colorMeaning = '') {
    const userId = await DropdownSettings.getCurrentUserId();
    if (!userId) {
        throw new Error('사용자 정보가 없습니다.');
    }
    
    // user_settings 테이블에 색상 저장 (hideVisitDate 정보와 의미 포함)
    const db = new DatabaseManager();
    await db.init();
    const metadata = {
        color: colorValue,
        hideVisitDate: hideVisitDate
    };
    await db.addUserSetting(userId, 'color', colorName, colorName, JSON.stringify(metadata), colorMeaning);
    
    console.log(`✅ 색상 "${colorName}" (${colorValue}) 의미: "${colorMeaning}" user_settings에 저장 완료`);
    
    // 캐시 무효화
    window.cachedDataLoader.invalidateSettingsCache(userId);
    
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
        
        // 캐시 무효화
        window.cachedDataLoader.invalidateSettingsCache(userId);
        
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
        
        // 먼저 현재 사용자의 설정을 확인
        console.log('🔍 색상 삭제 전 사용자 설정 확인');
        const currentSettings = await window.cachedDataLoader.loadUserSettings(userId);
        console.log('📊 현재 사용자 색상 설정:', currentSettings.colors);
        
        // 삭제할 색상 찾기 (name 또는 key로)
        const colorToDelete = currentSettings.colors?.find(c => c.name === colorName || c.key === colorName);
        console.log('🎯 삭제할 색상 정보:', colorToDelete);
        
        if (colorToDelete) {
            // key 값으로 삭제 시도
            await db.deleteUserSetting(userId, 'color', colorToDelete.key);
            console.log(`✅ 색상 삭제 완료: key=${colorToDelete.key}, name=${colorToDelete.name}`);
        } else {
            // fallback: 직접 name으로 삭제 시도  
            await db.deleteUserSetting(userId, 'color', colorName);
            console.log(`⚠️ fallback 삭제 시도: ${colorName}`);
        }
        
        // 캐시 무효화
        window.cachedDataLoader.invalidateSettingsCache(userId);
        
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


// 입력창에서 색상 의미 저장 함수
async function saveColorMeaningFromInput(colorName, inputId) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) {
        alert('입력창을 찾을 수 없습니다.');
        return;
    }
    
    const newMeaning = inputElement.value.trim();
    
    try {
        await saveColorMeaning(colorName, newMeaning);
        
        // 성공 메시지와 함께 입력창 스타일 변경
        const originalStyle = inputElement.style.border;
        inputElement.style.border = '2px solid #27ae60';
        inputElement.style.backgroundColor = '#d4edda';
        
        // 성공 표시 후 원래 스타일로 되돌리기
        setTimeout(() => {
            inputElement.style.border = originalStyle;
            inputElement.style.backgroundColor = '';
        }, 1500);
        
        // 색상 의미 가이드만 업데이트 (전체 새로고침 없이)
        const currentUser = await window.dataLoader.getCurrentUser();
        if (currentUser) {
            // 캐시에서 설정 가져오기
            const settings = await window.cachedDataLoader.loadUserSettings(currentUser.id);
            if (settings && settings.colors) {
                updateColorMeaningsDisplay(settings.colors);
            }
        }
        
        console.log(`✅ 색상 "${colorName}" 의미 저장 완료: "${newMeaning || '(의미 없음)'}"`);
        
    } catch (error) {
        console.error('색상 의미 저장 오류:', error);
        alert('색상 의미 저장 중 오류가 발생했습니다.');
        
        // 오류 표시
        const originalStyle = inputElement.style.border;
        inputElement.style.border = '2px solid #dc3545';
        inputElement.style.backgroundColor = '#f8d7da';
        
        setTimeout(() => {
            inputElement.style.border = originalStyle;
            inputElement.style.backgroundColor = '';
        }, 2000);
    }
}

// 색상 의미 수정 함수 (기존 방식, 호환성 유지)
async function editColorMeaning(colorName, currentMeaning) {
    const newMeaning = prompt(`"${colorName}" 색상의 의미를 입력하세요:`, currentMeaning || '');
    
    if (newMeaning === null) {
        return; // 사용자가 취소함
    }
    
    try {
        await saveColorMeaning(colorName, newMeaning.trim());
        alert(`색상 "${colorName}"의 의미가 "${newMeaning.trim() || '(의미 없음)'}"로 수정되었습니다.`);
        
        // 설정 다시 로드
        setTimeout(async () => {
            await loadSettings();
        }, 500);
        
    } catch (error) {
        console.error('색상 의미 수정 오류:', error);
        alert('색상 의미 수정 중 오류가 발생했습니다.');
    }
}

// 색상 의미 저장 함수
async function saveColorMeaning(colorName, meaning) {
    const userId = await DropdownSettings.getCurrentUserId();
    if (!userId) {
        throw new Error('사용자 정보가 없습니다.');
    }
    
    const db = new DatabaseManager();
    await db.init();
    
    // 캐시에서 기존 색상 정보 가져오기
    const settings = await window.cachedDataLoader.loadUserSettings(userId);
    const existingColor = settings.colors?.find(c => c.name === colorName);
    
    if (!existingColor) {
        throw new Error('색상을 찾을 수 없습니다.');
    }
    
    // 색상 값과 방문일 숨김 설정 파싱
    let colorValue = existingColor.value;
    let hideVisitDate = false;
    
    try {
        if (typeof existingColor.value === 'string' && existingColor.value.startsWith('{')) {
            const metadata = JSON.parse(existingColor.value);
            colorValue = metadata.color;
            hideVisitDate = metadata.hideVisitDate || false;
        }
    } catch (e) {
        // 파싱 실패 시 기본값 사용
    }
    
    // 기존 색상 삭제 후 새 의미로 재추가
    await db.deleteUserSetting(userId, 'color', colorName);
    
    const metadata = {
        color: colorValue,
        hideVisitDate: hideVisitDate
    };
    await db.addUserSetting(userId, 'color', colorName, colorName, JSON.stringify(metadata), meaning);
    
    console.log(`✅ 색상 "${colorName}" 의미를 "${meaning}"로 수정 완료`);
    
    // 캐시 무효화
    window.cachedDataLoader.invalidateSettingsCache(userId);
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
window.editColorMeaning = editColorMeaning;
window.saveColorMeaning = saveColorMeaning;
window.saveColorMeaningFromInput = saveColorMeaningFromInput;