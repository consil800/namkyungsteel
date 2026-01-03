// 설정 페이지 JavaScript
console.log('settings.js 로드됨');

document.addEventListener('DOMContentLoaded', async function() {
    console.log('설정 페이지 DOM 로드 완료');
    
    // 페이지 로드 시 로컬 스토리지 정리
    DropdownSettings.cleanupLocalStorage();
    
    // 데이터베이스 초기화 대기
    let retryCount = 0;
    while ((!window.db || !window.db.client) && retryCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
    }
    
    loadSettings();
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
        if (currentUser.id) {
            return currentUser.id;
        }
        
        // AuthManager 사용
        const user = AuthManager.getCurrentUser();
        if (user && user.id) {
            return user.id;
        }
        
        // userInfo로도 시도 (레거시 지원)
        const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
        return userInfo.id || null;
    },

    // 설정 가져오기
    get: async function() {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                console.warn('사용자 정보가 없습니다.');
                return { ...defaultSettings };
            }

            const db = new DatabaseManager();
            await db.init();
            const settings = await db.getUserSettings(userId);
            
            // 로컬 스토리지 데이터가 있다면 삭제
            this.cleanupLocalStorage();
            
            return settings;
        } catch (error) {
            console.error('설정 조회 오류:', error);
            return { ...defaultSettings };
        }
    },

    // 설정 저장하기
    save: async function(settings) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                throw new Error('사용자 정보가 없습니다.');
            }

            const db = new DatabaseManager();
            await db.init();
            await db.updateUserSettings(userId, settings);
            
            console.log('설정이 Supabase에 저장되었습니다.');
            return true;
        } catch (error) {
            console.error('설정 저장 오류:', error);
            throw error;
        }
    },

    // 초기화 (모든 설정 삭제)
    reset: async function() {
        const emptySettings = {
            paymentTerms: [],
            businessTypes: [],
            visitPurposes: [],
            regions: [],
            colors: []
        };
        await this.save(emptySettings);
        return emptySettings;
    },

    // 로컬 스토리지 정리
    cleanupLocalStorage: function() {
        const keysToRemove = [
            'dropdownSettings',
            'company_regions',
            'companies_data',
            'worklogs_data',
            'settingsChangeEvent'
        ];
        
        keysToRemove.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`로컬 스토리지 키 '${key}' 삭제됨`);
            }
        });
    }
};

// 설정 로드 및 화면 업데이트
async function loadSettings() {
    try {
        console.log('🔄 settings.js loadSettings 시작');
        const settings = await DropdownSettings.get();
        console.log('📊 가져온 설정 데이터:', settings);
        
        displayPaymentTerms(settings.paymentTerms || []);
        displayBusinessTypes(settings.businessTypes || []);
        displayRegions(settings.regions || []);
        displayVisitPurposes(settings.visitPurposes || []);
        displayColors(settings.colors || []);
        
        // 드롭다운 로드
        console.log('🔄 드롭다운 옵션 로드 시작');
        await loadDropdownOptions(settings);
        console.log('✅ 드롭다운 옵션 로드 완료');
    } catch (error) {
        console.error('설정 로드 오류:', error);
        // 오류 발생 시 빈 배열로 표시
        displayPaymentTerms([]);
        displayBusinessTypes([]);
        displayRegions([]);
        displayVisitPurposes([]);
        displayColors([]);
        
        const emptySettings = { ...defaultSettings };
        await loadDropdownOptions(emptySettings);
    }
}

// 드롭다운 옵션 로드
async function loadDropdownOptions(settings) {
    console.log('🔄 loadDropdownOptions 호출됨, settings:', settings);
    
    // 결제조건 드롭다운
    const paymentTermsDropdown = document.getElementById('paymentTermsDropdown');
    console.log('📋 결제조건 드롭다운 요소:', paymentTermsDropdown);
    loadDropdown(paymentTermsDropdown, settings.paymentTerms || [], '결제조건');
    
    // 업종 드롭다운
    const businessTypesDropdown = document.getElementById('businessTypesDropdown');
    console.log('📋 업종 드롭다운 요소:', businessTypesDropdown);
    loadDropdown(businessTypesDropdown, settings.businessTypes || [], '업종');
    
    // 지역 드롭다운
    const regionsDropdown = document.getElementById('regionsDropdown');
    console.log('📋 지역 드롭다운 요소:', regionsDropdown);
    loadDropdown(regionsDropdown, settings.regions || [], '지역');
    
    // 방문목적 드롭다운
    const visitPurposesDropdown = document.getElementById('visitPurposesDropdown');
    console.log('📋 방문목적 드롭다운 요소:', visitPurposesDropdown);
    loadDropdown(visitPurposesDropdown, settings.visitPurposes || [], '방문목적');
    
    // 색상 드롭다운
    const colorsDropdown = document.getElementById('colorsDropdown');
    if (colorsDropdown) {
        console.log('📋 색상 드롭다운 요소:', colorsDropdown);
        console.log('📊 색상 데이터:', settings.colors);
        
        colorsDropdown.innerHTML = '<option value="">색상 선택</option>';
        if (settings.colors && settings.colors.length > 0) {
            settings.colors.forEach(color => {
                const option = document.createElement('option');
                option.value = color.key;
                option.textContent = color.name;
                option.style.backgroundColor = color.value;
                option.style.color = getContrastColor(color.value);
                colorsDropdown.appendChild(option);
            });
        }
        const customOption = document.createElement('option');
        customOption.value = '__custom__';
        customOption.textContent = '── 직접입력 ──';
        customOption.style.fontStyle = 'italic';
        colorsDropdown.appendChild(customOption);
        
        colorsDropdown.addEventListener('change', function() {
            handleDropdownChange(this, 'color');
        });
    }
}

// 드롭다운 로드 헬퍼 함수
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
    
    // 변경 이벤트 리스너 추가
    selectElement.removeEventListener('change', selectElement._customHandler);
    selectElement._customHandler = function() {
        console.log(`🔄 ${type} 드롭다운 변경됨:`, this.value);
        handleDropdownChange(this, type.toLowerCase());
    };
    selectElement.addEventListener('change', selectElement._customHandler);
    
    console.log(`✅ ${type} 드롭다운 로드 완료 - 총 ${selectElement.options.length}개 옵션`);
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

// 드롭다운 변경 처리
async function handleDropdownChange(selectElement, type) {
    const value = selectElement.value;
    
    if (value === '__custom__') {
        let inputType;
        switch(type) {
            case '결제조건': inputType = '결제조건'; break;
            case '업종': inputType = '업종'; break;
            case '지역': inputType = '지역'; break;
            case '방문목적': inputType = '방문목적'; break;
            case 'color': 
                handleCustomColor(selectElement);
                return;
            default: inputType = type;
        }
        
        await handleCustomInput(selectElement, inputType);
    }
}

// 커스텀 입력 처리
async function handleCustomInput(selectElement, inputType) {
    const value = selectElement.value;
    
    if (value === '__custom__') {
        const customValue = prompt(`새로운 ${inputType}을(를) 입력하세요:`);
        
        if (customValue && customValue.trim()) {
            try {
                const userId = await DropdownSettings.getCurrentUserId();
                if (!userId) {
                    alert('로그인이 필요합니다.');
                    return;
                }

                // 간단히 새 옵션을 드롭다운에 추가
                const db = new DatabaseManager();
                await db.init();
                const settings = await db.getUserSettings(userId);
                
                // 중복 체크
                let exists = false;
                switch(inputType) {
                    case '지역':
                        exists = settings.regions.includes(customValue);
                        break;
                    case '결제조건':
                        exists = settings.paymentTerms.includes(customValue);
                        break;
                    case '업종':
                        exists = settings.businessTypes.includes(customValue);
                        break;
                    case '방문목적':
                        exists = settings.visitPurposes.includes(customValue);
                        break;
                }
                
                if (!exists) {
                    // 새 옵션을 드롭다운에 추가
                    const newOption = document.createElement('option');
                    newOption.value = customValue;
                    newOption.textContent = customValue;
                    
                    // 직접입력 옵션 바로 앞에 삽입
                    const customOption = selectElement.querySelector('option[value="__custom__"]');
                    selectElement.insertBefore(newOption, customOption);
                    
                    // 새로 추가한 값 선택
                    selectElement.value = customValue;
                    
                    alert(`${inputType}이(가) 추가되었습니다. 실제 데이터는 업체 등록이나 업무일지 작성 시 저장됩니다.`);
                } else {
                    alert('이미 존재하는 값입니다.');
                    selectElement.value = customValue;
                }
            } catch (error) {
                console.error('커스텀 값 추가 오류:', error);
                alert('값 추가 중 오류가 발생했습니다.');
                selectElement.value = '';
            }
        } else {
            // 취소한 경우 기본값으로
            selectElement.value = '';
        }
    }
}

// 색상 커스텀 입력 처리
async function handleCustomColor(selectElement) {
    const value = selectElement.value;
    
    if (value === '__custom__') {
        const colorName = prompt('새로운 색상 이름을 입력하세요:');
        
        if (colorName && colorName.trim()) {
            const colorValue = prompt('색상 코드를 입력하세요 (예: #ff0000):') || '#808080';
            
            try {
                const userId = await DropdownSettings.getCurrentUserId();
                if (!userId) {
                    alert('로그인이 필요합니다.');
                    return;
                }

                const db = new DatabaseManager();
                await db.init();
                const settings = await db.getUserSettings(userId);
                
                // 이름 중복 체크
                if (settings.colors.some(color => color.name === colorName)) {
                    alert('이미 존재하는 색상 이름입니다.');
                    return;
                }
                
                // 새 색상을 드롭다운에 추가
                const newKey = 'custom_' + Date.now();
                const newOption = document.createElement('option');
                newOption.value = newKey;
                newOption.textContent = colorName;
                newOption.style.backgroundColor = colorValue;
                newOption.style.color = getContrastColor(colorValue);
                
                // 직접입력 옵션 바로 앞에 삽입
                const customOption = selectElement.querySelector('option[value="__custom__"]');
                selectElement.insertBefore(newOption, customOption);
                
                // 새로 추가한 색상 선택
                selectElement.value = newKey;
                
                alert('색상이 추가되었습니다. 실제 데이터는 업체 등록 시 저장됩니다.');
            } catch (error) {
                console.error('색상 추가 오류:', error);
                alert('색상 추가 중 오류가 발생했습니다.');
                selectElement.value = '';
            }
        } else {
            selectElement.value = '';
        }
    }
}

// 결제조건 표시
function displayPaymentTerms(paymentTerms) {
    const list = document.getElementById('paymentTermsList');
    if (!list) return;
    
    list.innerHTML = paymentTerms.map((term, index) => `
        <li class="option-item">
            <span class="option-text">${term}</span>
            <div class="option-actions">
                <button class="btn btn-small btn-warning" onclick="editPaymentTerm(${index}, '${term}')">수정</button>
                <button class="btn btn-small btn-danger" onclick="deletePaymentTerm(${index})">삭제</button>
            </div>
        </li>
        <li class="edit-form" id="editPaymentTerm${index}">
            <input type="text" value="${term}" id="editPaymentTermInput${index}">
            <button class="btn btn-small btn-success" onclick="savePaymentTerm(${index})">저장</button>
            <button class="btn btn-small btn-secondary" onclick="cancelEdit('editPaymentTerm${index}')">취소</button>
        </li>
    `).join('');
}

// 업종 표시
function displayBusinessTypes(businessTypes) {
    const list = document.getElementById('businessTypesList');
    if (!list) return;
    
    list.innerHTML = businessTypes.map((type, index) => `
        <li class="option-item">
            <span class="option-text">${type}</span>
            <div class="option-actions">
                <button class="btn btn-small btn-warning" onclick="editBusinessType(${index}, '${type}')">수정</button>
                <button class="btn btn-small btn-danger" onclick="deleteBusinessType(${index})">삭제</button>
            </div>
        </li>
        <li class="edit-form" id="editBusinessType${index}">
            <input type="text" value="${type}" id="editBusinessTypeInput${index}">
            <button class="btn btn-small btn-success" onclick="saveBusinessType(${index})">저장</button>
            <button class="btn btn-small btn-secondary" onclick="cancelEdit('editBusinessType${index}')">취소</button>
        </li>
    `).join('');
}

// 지역 표시
function displayRegions(regions) {
    const list = document.getElementById('regionsList');
    if (!list) return;
    
    list.innerHTML = regions.map((region, index) => `
        <li class="option-item">
            <span class="option-text">${region}</span>
            <div class="option-actions">
                <button class="btn btn-small btn-warning" onclick="editRegion(${index}, '${region}')">수정</button>
                <button class="btn btn-small btn-danger" onclick="deleteRegion(${index})">삭제</button>
            </div>
        </li>
        <li class="edit-form" id="editRegion${index}">
            <input type="text" value="${region}" id="editRegionInput${index}">
            <button class="btn btn-small btn-success" onclick="saveRegion(${index})">저장</button>
            <button class="btn btn-small btn-secondary" onclick="cancelEdit('editRegion${index}')">취소</button>
        </li>
    `).join('');
}

// 방문목적 표시
function displayVisitPurposes(visitPurposes) {
    const list = document.getElementById('visitPurposesList');
    if (!list) return;
    
    list.innerHTML = visitPurposes.map((purpose, index) => `
        <li class="option-item">
            <span class="option-text">${purpose}</span>
            <div class="option-actions">
                <button class="btn btn-small btn-warning" onclick="editVisitPurpose(${index}, '${purpose}')">수정</button>
                <button class="btn btn-small btn-danger" onclick="deleteVisitPurpose(${index})">삭제</button>
            </div>
        </li>
        <li class="edit-form" id="editVisitPurpose${index}">
            <input type="text" value="${purpose}" id="editVisitPurposeInput${index}">
            <button class="btn btn-small btn-success" onclick="saveVisitPurpose(${index})">저장</button>
            <button class="btn btn-small btn-secondary" onclick="cancelEdit('editVisitPurpose${index}')">취소</button>
        </li>
    `).join('');
}

// 색상 표시
function displayColors(colors) {
    const list = document.getElementById('colorsList');
    if (!list) return;
    
    list.innerHTML = colors.map((color, index) => `
        <li class="option-item">
            <span class="option-text">
                <span class="color-preview" style="background-color: ${color.value}"></span>
                ${color.name}
            </span>
            <div class="option-actions">
                <button class="btn btn-small btn-warning" onclick="editColor(${index})">수정</button>
                <button class="btn btn-small btn-danger" onclick="deleteColor(${index})">삭제</button>
            </div>
        </li>
        <li class="edit-form" id="editColor${index}">
            <input type="text" value="${color.name}" id="editColorNameInput${index}" placeholder="색상 이름">
            <input type="color" value="${color.value}" id="editColorValueInput${index}">
            <button class="btn btn-small btn-success" onclick="saveColor(${index})">저장</button>
            <button class="btn btn-small btn-secondary" onclick="cancelEdit('editColor${index}')">취소</button>
        </li>
    `).join('');
}

// 결제조건 추가
function addPaymentTerm() {
    const input = document.getElementById('newPaymentTerm');
    const newTerm = input.value.trim();
    
    if (!newTerm) {
        alert('결제조건을 입력해주세요.');
        return;
    }
    
    const settings = DropdownSettings.get();
    
    if (settings.paymentTerms.includes(newTerm)) {
        alert('이미 존재하는 결제조건입니다.');
        return;
    }
    
    settings.paymentTerms.push(newTerm);
    DropdownSettings.save(settings);
    displayPaymentTerms(settings.paymentTerms);
    input.value = '';
    alert('결제조건이 추가되었습니다.');
}

// 업종 추가
function addBusinessType() {
    const input = document.getElementById('newBusinessType');
    const newType = input.value.trim();
    
    if (!newType) {
        alert('업종을 입력해주세요.');
        return;
    }
    
    const settings = DropdownSettings.get();
    
    if (settings.businessTypes.includes(newType)) {
        alert('이미 존재하는 업종입니다.');
        return;
    }
    
    settings.businessTypes.push(newType);
    DropdownSettings.save(settings);
    displayBusinessTypes(settings.businessTypes);
    input.value = '';
    alert('업종이 추가되었습니다.');
}

// 지역 표시
function displayRegions(regions) {
    const list = document.getElementById('regionsList');
    list.innerHTML = regions.map((region, index) => `
        <li class="option-item">
            <span class="option-text">${region}</span>
            <div class="option-actions">
                <button class="btn btn-small btn-warning" onclick="editRegion(${index}, '${region}')">수정</button>
                <button class="btn btn-small btn-danger" onclick="deleteRegion(${index})">삭제</button>
            </div>
        </li>
        <li class="edit-form" id="editRegion${index}">
            <input type="text" value="${region}" id="editRegionInput${index}">
            <button class="btn btn-small btn-success" onclick="saveRegion(${index})">저장</button>
            <button class="btn btn-small btn-secondary" onclick="cancelEdit('editRegion${index}')">취소</button>
        </li>
    `).join('');
}

// 지역 추가
function addRegion() {
    const input = document.getElementById('newRegion');
    const newRegion = input.value.trim();
    
    if (!newRegion) {
        alert('지역을 입력해주세요.');
        return;
    }
    
    const settings = DropdownSettings.get();
    
    if (!settings.regions) {
        settings.regions = [...defaultSettings.regions];
    }
    
    if (settings.regions.includes(newRegion)) {
        alert('이미 존재하는 지역입니다.');
        return;
    }
    
    settings.regions.push(newRegion);
    settings.regions.sort((a, b) => a.localeCompare(b)); // 오름차순 정렬
    DropdownSettings.save(settings);
    localStorage.setItem('company_regions', JSON.stringify(settings.regions));
    displayRegions(settings.regions);
    input.value = '';
    alert('지역이 추가되었습니다.');
}

// 방문목적 추가
function addVisitPurpose() {
    const input = document.getElementById('newVisitPurpose');
    const newPurpose = input.value.trim();
    
    if (!newPurpose) {
        alert('방문목적을 입력해주세요.');
        return;
    }
    
    const settings = DropdownSettings.get();
    
    if (settings.visitPurposes.includes(newPurpose)) {
        alert('이미 존재하는 방문목적입니다.');
        return;
    }
    
    settings.visitPurposes.push(newPurpose);
    DropdownSettings.save(settings);
    displayVisitPurposes(settings.visitPurposes);
    input.value = '';
    alert('방문목적이 추가되었습니다.');
}

// 색상 추가
function addColor() {
    const nameInput = document.getElementById('newColorName');
    const valueInput = document.getElementById('newColorValue');
    const newName = nameInput.value.trim();
    const newValue = valueInput.value;
    
    if (!newName) {
        alert('색상 이름을 입력해주세요.');
        return;
    }
    
    const settings = DropdownSettings.get();
    
    // 이름 중복 체크
    if (settings.colors.some(color => color.name === newName)) {
        alert('이미 존재하는 색상 이름입니다.');
        return;
    }
    
    // 새 키 생성 (이름을 영어로 변환하거나 고유 ID 생성)
    const newKey = 'custom_' + Date.now();
    
    settings.colors.push({
        key: newKey,
        name: newName,
        value: newValue
    });
    
    DropdownSettings.save(settings);
    displayColors(settings.colors);
    nameInput.value = '';
    valueInput.value = '#ff69b4';
    alert('색상이 추가되었습니다.');
}

// 결제조건 수정
function editPaymentTerm(index, currentValue) {
    const editForm = document.getElementById(`editPaymentTerm${index}`);
    editForm.classList.add('active');
}

function savePaymentTerm(index) {
    const input = document.getElementById(`editPaymentTermInput${index}`);
    const newValue = input.value.trim();
    
    if (!newValue) {
        alert('결제조건을 입력해주세요.');
        return;
    }
    
    const settings = DropdownSettings.get();
    
    // 중복 체크 (자기 자신 제외)
    if (settings.paymentTerms.some((term, i) => i !== index && term === newValue)) {
        alert('이미 존재하는 결제조건입니다.');
        return;
    }
    
    settings.paymentTerms[index] = newValue;
    DropdownSettings.save(settings);
    displayPaymentTerms(settings.paymentTerms);
    alert('결제조건이 수정되었습니다.');
}

// 업종 수정
function editBusinessType(index, currentValue) {
    const editForm = document.getElementById(`editBusinessType${index}`);
    editForm.classList.add('active');
}

function saveBusinessType(index) {
    const input = document.getElementById(`editBusinessTypeInput${index}`);
    const newValue = input.value.trim();
    
    if (!newValue) {
        alert('업종을 입력해주세요.');
        return;
    }
    
    const settings = DropdownSettings.get();
    
    // 중복 체크 (자기 자신 제외)
    if (settings.businessTypes.some((type, i) => i !== index && type === newValue)) {
        alert('이미 존재하는 업종입니다.');
        return;
    }
    
    settings.businessTypes[index] = newValue;
    DropdownSettings.save(settings);
    displayBusinessTypes(settings.businessTypes);
    alert('업종이 수정되었습니다.');
}

// 방문목적 수정
function editVisitPurpose(index, currentValue) {
    const editForm = document.getElementById(`editVisitPurpose${index}`);
    editForm.classList.add('active');
}

function saveVisitPurpose(index) {
    const input = document.getElementById(`editVisitPurposeInput${index}`);
    const newValue = input.value.trim();
    
    if (!newValue) {
        alert('방문목적을 입력해주세요.');
        return;
    }
    
    const settings = DropdownSettings.get();
    
    // 중복 체크 (자기 자신 제외)
    if (settings.visitPurposes.some((purpose, i) => i !== index && purpose === newValue)) {
        alert('이미 존재하는 방문목적입니다.');
        return;
    }
    
    settings.visitPurposes[index] = newValue;
    DropdownSettings.save(settings);
    displayVisitPurposes(settings.visitPurposes);
    alert('방문목적이 수정되었습니다.');
}

// 색상 수정
function editColor(index) {
    const editForm = document.getElementById(`editColor${index}`);
    editForm.classList.add('active');
}

function saveColor(index) {
    const nameInput = document.getElementById(`editColorNameInput${index}`);
    const valueInput = document.getElementById(`editColorValueInput${index}`);
    const newName = nameInput.value.trim();
    const newValue = valueInput.value;
    
    if (!newName) {
        alert('색상 이름을 입력해주세요.');
        return;
    }
    
    const settings = DropdownSettings.get();
    
    // 중복 체크 (자기 자신 제외)
    if (settings.colors.some((color, i) => i !== index && color.name === newName)) {
        alert('이미 존재하는 색상 이름입니다.');
        return;
    }
    
    settings.colors[index].name = newName;
    settings.colors[index].value = newValue;
    DropdownSettings.save(settings);
    displayColors(settings.colors);
    alert('색상이 수정되었습니다.');
}

// 결제조건 삭제
function deletePaymentTerm(index) {
    if (!confirm('이 결제조건을 삭제하시겠습니까?')) {
        return;
    }
    
    const settings = DropdownSettings.get();
    settings.paymentTerms.splice(index, 1);
    DropdownSettings.save(settings);
    displayPaymentTerms(settings.paymentTerms);
    alert('결제조건이 삭제되었습니다.');
}

// 업종 삭제
function deleteBusinessType(index) {
    if (!confirm('이 업종을 삭제하시겠습니까?')) {
        return;
    }
    
    const settings = DropdownSettings.get();
    settings.businessTypes.splice(index, 1);
    DropdownSettings.save(settings);
    displayBusinessTypes(settings.businessTypes);
    alert('업종이 삭제되었습니다.');
}

// 지역 수정
function editRegion(index, currentValue) {
    const editForm = document.getElementById(`editRegion${index}`);
    editForm.classList.add('active');
    editForm.style.display = 'block';
}

// 지역 저장
function saveRegion(index) {
    const input = document.getElementById(`editRegionInput${index}`);
    const newValue = input.value.trim();
    
    if (!newValue) {
        alert('지역을 입력해주세요.');
        return;
    }
    
    const settings = DropdownSettings.get();
    
    if (!settings.regions) {
        settings.regions = [...defaultSettings.regions];
    }
    
    // 중복 체크 (자기 자신 제외)
    if (settings.regions.some((region, i) => i !== index && region === newValue)) {
        alert('이미 존재하는 지역입니다.');
        return;
    }
    
    settings.regions[index] = newValue;
    settings.regions.sort((a, b) => a.localeCompare(b)); // 오름차순 정렬
    DropdownSettings.save(settings);
    localStorage.setItem('company_regions', JSON.stringify(settings.regions));
    displayRegions(settings.regions);
    alert('지역이 수정되었습니다.');
}

// 지역 삭제
function deleteRegion(index) {
    if (!confirm('이 지역을 삭제하시겠습니까?')) {
        return;
    }
    
    const settings = DropdownSettings.get();
    
    if (!settings.regions) {
        settings.regions = [...defaultSettings.regions];
    }
    
    settings.regions.splice(index, 1);
    DropdownSettings.save(settings);
    localStorage.setItem('company_regions', JSON.stringify(settings.regions));
    displayRegions(settings.regions);
    alert('지역이 삭제되었습니다.');
}

// 방문목적 삭제
function deleteVisitPurpose(index) {
    if (!confirm('이 방문목적을 삭제하시겠습니까?')) {
        return;
    }
    
    const settings = DropdownSettings.get();
    settings.visitPurposes.splice(index, 1);
    DropdownSettings.save(settings);
    displayVisitPurposes(settings.visitPurposes);
    alert('방문목적이 삭제되었습니다.');
}

// 색상 삭제
function deleteColor(index) {
    if (!confirm('이 색상을 삭제하시겠습니까?')) {
        return;
    }
    
    const settings = DropdownSettings.get();
    settings.colors.splice(index, 1);
    DropdownSettings.save(settings);
    displayColors(settings.colors);
    alert('색상이 삭제되었습니다.');
}

// 수정 취소
function cancelEdit(editFormId) {
    const editForm = document.getElementById(editFormId);
    editForm.classList.remove('active');
}

// 모든 설정 삭제 (초기화)
async function resetToDefaults() {
    if (!confirm('모든 드롭다운 설정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
        return;
    }
    
    try {
        const emptySettings = await DropdownSettings.reset();
        await loadSettings();
        alert('모든 설정이 삭제되었습니다.');
    } catch (error) {
        console.error('설정 초기화 오류:', error);
        alert('설정 초기화 중 오류가 발생했습니다.');
    }
}

// 전역에서 접근 가능하도록 설정
window.DropdownSettings = DropdownSettings;