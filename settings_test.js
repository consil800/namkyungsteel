// 간단한 테스트용 settings.js
console.log('settings_test.js 로드됨');

document.addEventListener('DOMContentLoaded', async function() {
    console.log('테스트: 설정 페이지 DOM 로드 완료');
    
    // 데이터베이스 초기화 대기
    let retryCount = 0;
    while ((!window.db || !window.db.client) && retryCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
    }
    
    await testLoadSettings();
});

// 현재 사용자 ID 가져오기
async function getCurrentUserId() {
    // currentUser에서 먼저 시도
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    if (currentUser.id) {
        console.log('👤 currentUser에서 사용자 ID 찾음:', currentUser.id);
        return currentUser.id;
    }
    
    // AuthManager 사용
    if (typeof AuthManager !== 'undefined') {
        const user = AuthManager.getCurrentUser();
        if (user && user.id) {
            console.log('👤 AuthManager에서 사용자 ID 찾음:', user.id);
            return user.id;
        }
    }
    
    // userInfo로도 시도 (레거시 지원)
    const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
    if (userInfo.id) {
        console.log('👤 userInfo에서 사용자 ID 찾음:', userInfo.id);
        return userInfo.id;
    }
    
    console.warn('❌ 사용자 ID를 찾을 수 없습니다');
    return null;
}

// 테스트: 설정 데이터 로드
async function testLoadSettings() {
    try {
        console.log('🔄 테스트: 설정 데이터 로드 시작');
        
        const userId = await getCurrentUserId();
        if (!userId) {
            console.error('❌ 사용자 정보가 없습니다.');
            return;
        }
        
        console.log('📋 사용자 ID:', userId);
        
        if (!window.db) {
            console.error('❌ 데이터베이스 연결이 없습니다.');
            return;
        }
        
        console.log('🔗 데이터베이스 연결 확인됨');
        
        const db = new DatabaseManager();
        await db.init();
        console.log('✅ DatabaseManager 초기화 완료');
        
        const settings = await db.getUserSettings(userId);
        console.log('📊 가져온 설정 데이터:', settings);
        
        // 드롭다운 테스트
        await testDropdownLoad(settings);
        
    } catch (error) {
        console.error('❌ 설정 로드 테스트 오류:', error);
    }
}

// 테스트: 드롭다운 로드
async function testDropdownLoad(settings) {
    console.log('🔄 드롭다운 로드 테스트 시작');
    
    // 각 드롭다운 요소 확인
    const dropdowns = [
        { id: 'paymentTermsDropdown', data: settings.paymentTerms, name: '결제조건' },
        { id: 'businessTypesDropdown', data: settings.businessTypes, name: '업종' },
        { id: 'regionsDropdown', data: settings.regions, name: '지역' },
        { id: 'visitPurposesDropdown', data: settings.visitPurposes, name: '방문목적' },
        { id: 'colorsDropdown', data: settings.colors, name: '색상' }
    ];
    
    dropdowns.forEach(dropdown => {
        const element = document.getElementById(dropdown.id);
        console.log(`📋 ${dropdown.name} 드롭다운:`, {
            element: element,
            exists: !!element,
            data: dropdown.data,
            dataCount: dropdown.data ? dropdown.data.length : 0
        });
        
        if (element && dropdown.data) {
            // 간단한 드롭다운 채우기 테스트
            element.innerHTML = `<option value="">${dropdown.name} 선택</option>`;
            
            if (dropdown.name === '색상') {
                dropdown.data.forEach(color => {
                    const option = document.createElement('option');
                    option.value = color.key;
                    option.textContent = color.name;
                    element.appendChild(option);
                });
            } else {
                dropdown.data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item;
                    option.textContent = item;
                    element.appendChild(option);
                });
            }
            
            console.log(`✅ ${dropdown.name} 드롭다운에 ${dropdown.data.length}개 옵션 추가됨`);
        } else {
            console.warn(`⚠️ ${dropdown.name} 드롭다운 요소를 찾을 수 없거나 데이터가 없습니다`);
        }
    });
}