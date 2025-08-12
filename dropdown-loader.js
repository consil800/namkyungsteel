// 드롭다운 로더 모듈
// 데이터베이스에서 설정을 가져와 드롭다운을 동적으로 생성

const DropdownLoader = {
    // 드롭다운에 직접입력 처리
    handleCustomInput: async function(selectElement, inputType) {
        const value = selectElement.value;
        
        if (value === '__custom__') {
            const customValue = prompt(`새로운 ${inputType}을(를) 입력하세요:`);
            
            if (customValue && customValue.trim()) {
                try {
                    // 현재 사용자 설정 가져오기
                    const userId = AuthManager.getCurrentUser()?.id;
                    if (!userId) {
                        alert('로그인이 필요합니다.');
                        return;
                    }

                    const db = new DatabaseManager();
                    await db.init();
                    const settings = await db.getUserSettings(userId);
                    
                    // 설정에 새 값 추가
                    let updated = false;
                    switch(inputType) {
                        case '지역':
                            if (!settings.regions.includes(customValue)) {
                                settings.regions.push(customValue);
                                settings.regions.sort((a, b) => a.localeCompare(b));
                                updated = true;
                            }
                            break;
                        case '결제조건':
                            if (!settings.paymentTerms.includes(customValue)) {
                                settings.paymentTerms.push(customValue);
                                updated = true;
                            }
                            break;
                        case '업종':
                            if (!settings.businessTypes.includes(customValue)) {
                                settings.businessTypes.push(customValue);
                                updated = true;
                            }
                            break;
                        case '방문목적':
                            if (!settings.visitPurposes.includes(customValue)) {
                                settings.visitPurposes.push(customValue);
                                updated = true;
                            }
                            break;
                    }
                    
                    if (updated) {
                        // 데이터베이스에 저장
                        await db.updateUserSettings(userId, settings);
                        
                        // 새 옵션을 드롭다운에 추가
                        const newOption = document.createElement('option');
                        newOption.value = customValue;
                        newOption.textContent = customValue;
                        
                        // 직접입력 옵션 바로 앞에 삽입
                        const customOption = selectElement.querySelector('option[value="__custom__"]');
                        selectElement.insertBefore(newOption, customOption);
                        
                        // 새로 추가한 값 선택
                        selectElement.value = customValue;
                        
                        alert(`${inputType}이(가) 추가되었습니다.`);
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
    },

    // 색상 직접입력 처리
    handleCustomColor: async function(selectElement) {
        const value = selectElement.value;
        
        if (value === '__custom__') {
            const colorName = prompt('새로운 색상 이름을 입력하세요:');
            
            if (colorName && colorName.trim()) {
                const colorValue = prompt('색상 코드를 입력하세요 (예: #ff0000):') || '#808080';
                
                try {
                    const userId = AuthManager.getCurrentUser()?.id;
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
                    
                    // 새 색상 추가
                    const newKey = 'custom_' + Date.now();
                    settings.colors.push({
                        key: newKey,
                        name: colorName,
                        value: colorValue
                    });
                    
                    // 데이터베이스에 저장
                    await db.updateUserSettings(userId, settings);
                    
                    // 새 옵션을 드롭다운에 추가
                    const newOption = document.createElement('option');
                    newOption.value = newKey;
                    newOption.textContent = colorName;
                    newOption.style.backgroundColor = colorValue;
                    newOption.style.color = DropdownLoader.getContrastColor(colorValue);
                    
                    // 직접입력 옵션 바로 앞에 삽입
                    const customOption = selectElement.querySelector('option[value="__custom__"]');
                    selectElement.insertBefore(newOption, customOption);
                    
                    // 새로 추가한 색상 선택
                    selectElement.value = newKey;
                    
                    alert('색상이 추가되었습니다.');
                } catch (error) {
                    console.error('색상 추가 오류:', error);
                    alert('색상 추가 중 오류가 발생했습니다.');
                    selectElement.value = '';
                }
            } else {
                selectElement.value = '';
            }
        }
    },

    // 지역 드롭다운 로드
    loadRegions: async function(selectElement) {
        try {
            const userId = AuthManager.getCurrentUser()?.id;
            if (!userId) return;

            const db = new DatabaseManager();
            await db.init();
            const settings = await db.getUserSettings(userId);
            
            // 기존 옵션 제거 (첫 번째 옵션 제외)
            while (selectElement.options.length > 1) {
                selectElement.remove(1);
            }
            
            // 데이터베이스의 지역 목록 추가
            if (settings.regions && settings.regions.length > 0) {
                settings.regions.forEach(region => {
                    const option = document.createElement('option');
                    option.value = region;
                    option.textContent = region;
                    selectElement.appendChild(option);
                });
            }
            
            // 직접입력 옵션 추가
            const customOption = document.createElement('option');
            customOption.value = '__custom__';
            customOption.textContent = '── 직접입력 ──';
            customOption.style.fontStyle = 'italic';
            selectElement.appendChild(customOption);
            
            // 변경 이벤트 리스너 추가
            selectElement.removeEventListener('change', selectElement._customHandler);
            selectElement._customHandler = () => DropdownLoader.handleCustomInput(selectElement, '지역');
            selectElement.addEventListener('change', selectElement._customHandler);
            
        } catch (error) {
            console.error('지역 로드 오류:', error);
        }
    },

    // 결제조건 드롭다운 로드
    loadPaymentTerms: async function(selectElement) {
        try {
            const userId = AuthManager.getCurrentUser()?.id;
            if (!userId) return;

            const db = new DatabaseManager();
            await db.init();
            const settings = await db.getUserSettings(userId);
            
            // 기존 옵션 제거 (첫 번째 옵션 제외)
            while (selectElement.options.length > 1) {
                selectElement.remove(1);
            }
            
            // 데이터베이스의 결제조건 목록 추가
            if (settings.paymentTerms && settings.paymentTerms.length > 0) {
                settings.paymentTerms.forEach(term => {
                    const option = document.createElement('option');
                    option.value = term;
                    option.textContent = term;
                    selectElement.appendChild(option);
                });
            }
            
            // 직접입력 옵션 추가
            const customOption = document.createElement('option');
            customOption.value = '__custom__';
            customOption.textContent = '── 직접입력 ──';
            customOption.style.fontStyle = 'italic';
            selectElement.appendChild(customOption);
            
            // 변경 이벤트 리스너 추가
            selectElement.removeEventListener('change', selectElement._customHandler);
            selectElement._customHandler = () => DropdownLoader.handleCustomInput(selectElement, '결제조건');
            selectElement.addEventListener('change', selectElement._customHandler);
            
        } catch (error) {
            console.error('결제조건 로드 오류:', error);
        }
    },

    // 업종 드롭다운 로드
    loadBusinessTypes: async function(selectElement) {
        try {
            const userId = AuthManager.getCurrentUser()?.id;
            if (!userId) return;

            const db = new DatabaseManager();
            await db.init();
            const settings = await db.getUserSettings(userId);
            
            // 기존 옵션 제거 (첫 번째 옵션 제외)
            while (selectElement.options.length > 1) {
                selectElement.remove(1);
            }
            
            // 데이터베이스의 업종 목록 추가
            if (settings.businessTypes && settings.businessTypes.length > 0) {
                settings.businessTypes.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    selectElement.appendChild(option);
                });
            }
            
            // 직접입력 옵션 추가
            const customOption = document.createElement('option');
            customOption.value = '__custom__';
            customOption.textContent = '── 직접입력 ──';
            customOption.style.fontStyle = 'italic';
            selectElement.appendChild(customOption);
            
            // 변경 이벤트 리스너 추가
            selectElement.removeEventListener('change', selectElement._customHandler);
            selectElement._customHandler = () => DropdownLoader.handleCustomInput(selectElement, '업종');
            selectElement.addEventListener('change', selectElement._customHandler);
            
        } catch (error) {
            console.error('업종 로드 오류:', error);
        }
    },

    // 색상 드롭다운 로드
    loadColors: async function(selectElement) {
        try {
            const userId = AuthManager.getCurrentUser()?.id;
            if (!userId) return;

            const db = new DatabaseManager();
            await db.init();
            const settings = await db.getUserSettings(userId);
            
            // 기존 옵션 제거 (첫 번째 옵션 제외)
            while (selectElement.options.length > 1) {
                selectElement.remove(1);
            }
            
            // 데이터베이스의 색상 목록 추가
            if (settings.colors && settings.colors.length > 0) {
                settings.colors.forEach(color => {
                    const option = document.createElement('option');
                    option.value = color.key;
                    option.textContent = color.name;
                    option.style.backgroundColor = color.value;
                    option.style.color = DropdownLoader.getContrastColor(color.value);
                    selectElement.appendChild(option);
                });
            }
            
            // 직접입력 옵션 추가
            const customOption = document.createElement('option');
            customOption.value = '__custom__';
            customOption.textContent = '── 직접입력 ──';
            customOption.style.fontStyle = 'italic';
            selectElement.appendChild(customOption);
            
            // 변경 이벤트 리스너 추가
            selectElement.removeEventListener('change', selectElement._customHandler);
            selectElement._customHandler = () => DropdownLoader.handleCustomColor(selectElement);
            selectElement.addEventListener('change', selectElement._customHandler);
            
        } catch (error) {
            console.error('색상 로드 오류:', error);
        }
    },

    // 방문목적 드롭다운 로드 (업무일지용)
    loadVisitPurposes: async function(selectElement) {
        try {
            const userId = AuthManager.getCurrentUser()?.id;
            if (!userId) return;

            const db = new DatabaseManager();
            await db.init();
            const settings = await db.getUserSettings(userId);
            
            // 기존 옵션 제거 (첫 번째 옵션 제외)
            while (selectElement.options.length > 1) {
                selectElement.remove(1);
            }
            
            // 데이터베이스의 방문목적 목록 추가
            if (settings.visitPurposes && settings.visitPurposes.length > 0) {
                settings.visitPurposes.forEach(purpose => {
                    const option = document.createElement('option');
                    option.value = purpose;
                    option.textContent = purpose;
                    selectElement.appendChild(option);
                });
            }
            
            // 직접입력 옵션 추가
            const customOption = document.createElement('option');
            customOption.value = '__custom__';
            customOption.textContent = '── 직접입력 ──';
            customOption.style.fontStyle = 'italic';
            selectElement.appendChild(customOption);
            
            // 변경 이벤트 리스너 추가
            selectElement.removeEventListener('change', selectElement._customHandler);
            selectElement._customHandler = () => DropdownLoader.handleCustomInput(selectElement, '방문목적');
            selectElement.addEventListener('change', selectElement._customHandler);
            
        } catch (error) {
            console.error('방문목적 로드 오류:', error);
        }
    },

    // 텍스트 대비 색상 계산
    getContrastColor: function(hexcolor) {
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
};

// 전역에서 사용 가능하도록
window.DropdownLoader = DropdownLoader;