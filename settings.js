// 설정 페이지 JavaScript
console.log('settings.js 로드됨');

document.addEventListener('DOMContentLoaded', function() {
    console.log('설정 페이지 DOM 로드 완료');
    loadSettings();
});

// 기본 설정값
const defaultSettings = {
    paymentTerms: ['현금', '월말결제', '30일', '45일', '60일', '90일', '어음', '기타'],
    businessTypes: ['제조업', '건설업', '유통업', '기타'],
    visitPurposes: ['신규영업', '기존고객관리', '견적제공', '계약협의', '수금협의', '클레임처리', '기타'],
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

// 설정 데이터 관리 (데이터베이스 사용)
const DropdownSettings = {
    // 설정 가져오기
    get: function() {
        // 로컬 스토리지에서 가져오기, 없으면 기본값 반환
        const stored = localStorage.getItem('dropdownSettings');
        if (stored) {
            return JSON.parse(stored);
        }
        return { ...defaultSettings };
    },

    // 설정 저장하기
    save: function(settings) {
        // 로컬 스토리지에 저장
        localStorage.setItem('dropdownSettings', JSON.stringify(settings));
    },

    // 기본값으로 초기화
    reset: function() {
        localStorage.removeItem('dropdownSettings');
        return { ...defaultSettings };
    }
};

// 설정 로드 및 화면 업데이트
function loadSettings() {
    const settings = DropdownSettings.get();
    displayPaymentTerms(settings.paymentTerms);
    displayBusinessTypes(settings.businessTypes);
    displayRegions(settings.regions || defaultSettings.regions);
    displayVisitPurposes(settings.visitPurposes);
    displayColors(settings.colors);
    
    // company_regions에도 저장 (index.html에서 사용)
    localStorage.setItem('company_regions', JSON.stringify(settings.regions || defaultSettings.regions));
}

// 결제조건 표시
function displayPaymentTerms(paymentTerms) {
    const list = document.getElementById('paymentTermsList');
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

// 방문목적 표시
function displayVisitPurposes(visitPurposes) {
    const list = document.getElementById('visitPurposesList');
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

// 기본값으로 초기화
function resetToDefaults() {
    if (!confirm('모든 드롭다운 설정을 기본값으로 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
        return;
    }
    
    const settings = DropdownSettings.reset();
    loadSettings();
    alert('모든 설정이 기본값으로 초기화되었습니다.');
}

// 전역에서 접근 가능하도록 설정
window.DropdownSettings = DropdownSettings;