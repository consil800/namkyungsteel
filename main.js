// 메인 페이지 JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const searchRegionSelect = document.getElementById('searchRegion');
    const searchCompanyInput = document.getElementById('searchCompany');
    const searchBtn = document.getElementById('searchBtn');
    const addCompanyBtn = document.getElementById('addCompanyBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const xlsxFileInput = document.getElementById('xlsxFileInput');
    const companyList = document.getElementById('companyList');
    const excludeNoVisitColorsCheckbox = document.getElementById('excludeNoVisitColors');

    let isDeleteMode = false;
    let selectedCompanies = new Set();
    let searchState = {
        region: '',
        companyName: '',
        isFiltered: false,
        excludeNoVisitColors: true  // 기본값 true
    };

    // 색상 변환 함수 - 모든 색상을 데이터베이스 기반으로 동적 생성
    const convertColorCode = (colorCode) => {
        if (!colorCode) return 'gray';
        
        // 한글을 영어로 변환하는 매핑 (CSS 클래스명용)
        const colorMapping = {
            '빨강': 'red',
            '주황': 'orange', 
            '노랑': 'yellow',
            '초록': 'green',
            '하늘': 'sky',
            '파랑': 'blue',
            '보라': 'purple',
            '회색': 'gray'
        };
        
        // 기본 색상은 영어로 변환
        if (colorMapping[colorCode]) {
            return colorMapping[colorCode];
        }
        
        // 커스텀 색상은 공백 제거 후 소문자화
        return colorCode.replace(/\s+/g, '').toLowerCase();
    };

    // 모든 색상을 위한 동적 CSS 생성 (데이터베이스 기반)
    let dynamicColorStyles = new Set();
    async function ensureDynamicColorStyles(colorCode, colorValue) {
        const className = `color-${convertColorCode(colorCode)}`;
        
        // 이미 생성된 스타일인지 확인
        if (dynamicColorStyles.has(className)) {
            return;
        }
        
        // colorValue가 이미 database.js에서 파싱된 HEX 색상값이므로 바로 사용
        const actualColorValue = colorValue;
        
        if (actualColorValue && actualColorValue.startsWith && actualColorValue.startsWith('#')) {
            // 동적 CSS 스타일 생성 (데이터베이스 색상의 70% 밝기 적용)
            const style = document.createElement('style');
            const lightColor = lightenColor(actualColorValue, 0.7); // 70% 밝게
            style.textContent = `
                tr.company-row.${className} {
                    background-color: ${lightColor} !important;
                    border-left: 4px solid ${actualColorValue} !important;
                }
                .company-card.${className} {
                    border-left: 5px solid ${actualColorValue} !important;
                    background-color: ${lightColor} !important;
                }
            `;
            document.head.appendChild(style);
            console.log(`🎨 데이터베이스 기반 동적 CSS 생성: ${className} = ${actualColorValue} (70% 밝기)`);
            dynamicColorStyles.add(className);
        } else {
            console.log(`🎨 색상 값 확인: ${className} = ${actualColorValue} (타입: ${typeof actualColorValue})`);
        }
    }
    
    // 색상을 밝게 만드는 함수
    function lightenColor(color, percent) {
        if (!color) return '#f8f9fa';
        
        // HEX 색상 정규화
        let hex = color.toString();
        if (!hex.startsWith('#')) {
            hex = '#' + hex;
        }
        hex = hex.replace('#', '');
        
        // 3자리 HEX를 6자리로 변환
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        
        // 유효하지 않은 HEX인 경우 기본 색상 반환
        if (hex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(hex)) {
            console.warn('유효하지 않은 색상 값:', color);
            return '#f8f9fa';
        }
        
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // 밝게 조정
        const newR = Math.min(255, Math.round(r + (255 - r) * percent));
        const newG = Math.min(255, Math.round(g + (255 - g) * percent));
        const newB = Math.min(255, Math.round(b + (255 - b) * percent));
        
        // 다시 HEX로 변환
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }

    // 색상별 hideVisitDate 설정을 저장할 객체
    let colorHideVisitDateMap = {};

    // 색상 설정 로드 함수
    async function loadColorSettings() {
        try {
            const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            if (!currentUser.id) return;

            // 사용자 설정 캐시 무효화 (최신 색상 설정 보장)
            if (window.cachedDataLoader && window.cachedDataLoader.invalidateSettingsCache) {
                window.cachedDataLoader.invalidateSettingsCache(currentUser.id);
                console.log('🔄 사용자 설정 캐시 무효화 완료');
            }

            // 최신 설정 로드
            let settings = await window.cachedDataLoader.loadUserSettings(currentUser.id);
            
            // 색상 설정은 항상 직접 데이터베이스에서 가져오기 (캐시 문제 해결을 위해)
            console.log('🔄 색상 설정을 위해 직접 데이터베이스 조회 시작');
            //if (!settings.colors || settings.colors.length === 0) {
                console.log('⚠️ 캐시된 색상 설정이 비어있음, 직접 데이터베이스 조회');
                try {
                    const db = new DatabaseManager();
                    await db.init();
                    
                    const { data: colorData, error } = await db.client
                        .from('user_settings')
                        .select('*')
                        .eq('user_id', currentUser.id)
                        .eq('setting_type', 'color');
                    
                    if (error) {
                        console.error('❌ 직접 색상 조회 오류:', error);
                    } else {
                        console.log('📊 직접 조회한 색상 데이터:', colorData);
                        
                        // 직접 조회한 데이터를 파싱하여 사용
                        if (colorData && colorData.length > 0) {
                            settings.colors = [];
                            colorData.forEach(item => {
                                try {
                                    let parsedColorData = null;
                                    if (item.color_value && typeof item.color_value === 'string' && item.color_value.startsWith('{')) {
                                        parsedColorData = JSON.parse(item.color_value);
                                    }
                                    settings.colors.push({
                                        key: item.setting_value,
                                        name: item.display_name || item.setting_value,
                                        value: parsedColorData?.color || '#cccccc',
                                        hideVisitDate: parsedColorData?.hideVisitDate || false,
                                        meaning: item.color_meaning || ''
                                    });
                                } catch (e) {
                                    console.error('색상 파싱 오류:', e, item);
                                }
                            });
                            console.log('📊 파싱된 색상 설정:', settings.colors);
                        }
                    }
                } catch (dbError) {
                    console.error('❌ 데이터베이스 직접 조회 오류:', dbError);
                }
            //}
            
            // 색상 설정 파싱 (database.js에서 이미 파싱된 데이터 사용)
            if (settings.colors) {
                colorHideVisitDateMap = {};
                settings.colors.forEach(colorData => {
                    // database.js에서 이미 파싱된 hideVisitDate 속성 사용
                    colorHideVisitDateMap[colorData.name] = colorData.hideVisitDate || false;
                    // key(영문명)로도 매핑 추가
                    if (colorData.key && colorData.key !== colorData.name) {
                        colorHideVisitDateMap[colorData.key] = colorData.hideVisitDate || false;
                    }
                    console.log(`🔍 색상 방문일 설정: ${colorData.name} → hideVisitDate: ${colorData.hideVisitDate}`);
                });
            }
            console.log('색상별 방문일 숨김 설정:', colorHideVisitDateMap);
        } catch (error) {
            console.error('색상 설정 로드 오류:', error);
        }
    }

    // 방문일을 숨겨야 하는지 확인하는 함수
    function shouldHideVisitDate(colorCode) {
        if (!colorCode) return false;
        
        // 회색, 보라색, 빨강색은 항상 숨김
        if (colorCode === 'gray' || colorCode === '회색' || colorCode === 'purple' || colorCode === '보라' || colorCode === 'red' || colorCode === '빨강') return true;
        
        // 색상별 hideVisitDate 설정 확인
        return colorHideVisitDateMap[colorCode] === true;
    }

    // 초기 데이터 로드 (사용자 정보가 업데이트될 때까지 대기)
    // worklog.html에서 getCurrentUserFromDB() 실행 후 loadCompanies()를 호출하므로 여기서는 주석 처리
    
    // 검색 상태 저장 함수
    function saveSearchState() {
        const searchState = {
            region: searchRegionSelect.value,
            companyName: searchCompanyInput.value,
            isFiltered: !!(searchRegionSelect.value || searchCompanyInput.value),
            excludeNoVisitColors: excludeNoVisitColorsCheckbox ? excludeNoVisitColorsCheckbox.checked : true
        };
        sessionStorage.setItem('worklogSearchState', JSON.stringify(searchState));
        console.log('🔵 검색 상태 저장:', searchState);
    }

    // 검색 상태 복원 함수 (개선된 버전)
    function restoreSearchState() {
        const savedState = sessionStorage.getItem('worklogSearchState');
        console.log('🔵 restoreSearchState 호출, 저장된 상태:', savedState);
        
        if (savedState) {
            try {
                const searchState = JSON.parse(savedState);
                console.log('🔵 파싱된 검색 상태:', searchState);
                
                // DOM 요소들이 준비될 때까지 대기
                const maxAttempts = 10;
                let attempts = 0;
                
                const restoreLoop = () => {
                    attempts++;
                    console.log(`🔵 복원 시도 ${attempts}/${maxAttempts}`);
                    
                    const searchRegion = document.getElementById('searchRegion');
                    const searchCompany = document.getElementById('searchCompany');
                    
                    if (searchRegion && searchCompany) {
                        console.log('🔵 DOM 요소 확인됨, 상태 복원 진행');
                        
                        // 지역 선택 복원
                        if (searchState.region) {
                            // 옵션이 존재하는지 확인
                            let optionExists = false;
                            for (let i = 0; i < searchRegion.options.length; i++) {
                                if (searchRegion.options[i].value === searchState.region) {
                                    optionExists = true;
                                    break;
                                }
                            }
                            
                            if (optionExists) {
                                searchRegion.value = searchState.region;
                                console.log('🔵 지역 선택 설정 성공:', searchState.region);
                            } else {
                                console.warn('🔵 지역 옵션이 아직 로드되지 않음:', searchState.region);
                                // 지역 옵션이 로드될 때까지 대기
                                const waitForOption = setInterval(() => {
                                    for (let i = 0; i < searchRegion.options.length; i++) {
                                        if (searchRegion.options[i].value === searchState.region) {
                                            searchRegion.value = searchState.region;
                                            console.log('🔵 지역 선택 설정 성공 (재시도):', searchState.region);
                                            clearInterval(waitForOption);
                                            break;
                                        }
                                    }
                                }, 100);
                                
                                // 3초 후 타이머 정리
                                setTimeout(() => clearInterval(waitForOption), 3000);
                            }
                        }
                        
                        // 업체명 입력 복원
                        if (searchState.companyName) {
                            searchCompany.value = searchState.companyName;
                            console.log('🔵 업체명 입력 설정:', searchState.companyName);
                        }
                        
                        // 체크박스 상태 복원
                        const excludeCheckbox = document.getElementById('excludeNoVisitColors');
                        if (excludeCheckbox && searchState.hasOwnProperty('excludeNoVisitColors')) {
                            excludeCheckbox.checked = searchState.excludeNoVisitColors;
                            console.log('🔵 체크박스 상태 설정:', searchState.excludeNoVisitColors);
                        }
                        
                        // 검색 실행 (직접 실행)
                        if (searchState.isFiltered) {
                            console.log('🔍 필터링된 상태 - 검색 실행');
                            console.log('🔍 검색 상태:', {
                                region: searchState.region,
                                companyName: searchState.companyName,
                                isFiltered: searchState.isFiltered
                            });
                            
                            // handleSearch 대신 직접 검색 실행
                            setTimeout(async () => {
                                try {
                                    const currentUser = await window.dataLoader.getCurrentUser();
                                    if (currentUser) {
                                        const companies = await window.cachedDataLoader.searchCompanies(
                                            searchState.region || '', 
                                            searchState.companyName || '', 
                                            currentUser.id
                                        );
                                        console.log(`🔍 상태 복원 검색 결과: ${companies.length}개`);
                                        displayCompanies(companies);
                                    }
                                } catch (error) {
                                    console.error('상태 복원 검색 오류:', error);
                                }
                            }, 200);
                        } else {
                            console.log('🔵 필터링되지 않은 상태');
                        }
                        
                        return; // 성공적으로 복원됨
                    }
                    
                    // DOM 요소가 없으면 재시도
                    if (attempts < maxAttempts) {
                        setTimeout(restoreLoop, 100);
                    } else {
                        console.error('🔵 DOM 요소를 찾을 수 없어 검색 상태 복원 실패');
                    }
                };
                
                restoreLoop();
                
            } catch (error) {
                console.error('검색 상태 복원 오류:', error);
            }
        } else {
            console.log('🔵 저장된 검색 상태 없음');
        }
    }

    // 페이지 로드 시 검색 상태 복원 (여러 타이밍에서 시도)
    // 1. 즉시 실행
    const immediateState = sessionStorage.getItem('worklogSearchState');
    if (immediateState) {
        console.log('🔵 즉시 검색 상태 복원 시도');
        console.log('🔵 저장된 상태:', immediateState);
        restoreSearchState();
    }
    
    // 2. DOM 완전 로드 후
    setTimeout(() => {
        console.log('🔵 100ms 후 검색 상태 복원 시도');
        restoreSearchState();
    }, 100);
    
    // 3. 페이지 완전 로드 후
    window.addEventListener('load', () => {
        console.log('🔵 페이지 완전 로드 후 검색 상태 복원 시도');
        // 지역 목록이 로드될 시간을 충분히 주기 위해 대기 시간 증가
        setTimeout(() => {
            restoreSearchState();
        }, 500);
    });

    // 이벤트 리스너 등록
    searchBtn.addEventListener('click', handleSearch);
    addCompanyBtn.addEventListener('click', () => {
        // 로그인 확인 (최신 sessionStorage에서 직접 읽기)
        let currentUser;
        try {
            const userJson = sessionStorage.getItem('currentUser');
            currentUser = userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            console.error('사용자 정보 파싱 오류:', error);
            currentUser = null;
        }
        
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }
        
        saveSearchState();
        window.location.href = 'company-register.html';
    });
    exportBtn.addEventListener('click', exportCompanies);
    importBtn.addEventListener('click', () => xlsxFileInput.click());
    deleteBtn.addEventListener('click', handleDeleteMode);
    xlsxFileInput.addEventListener('change', importCompanies);

    // 지역 선택 시 상태만 저장 (자동 검색 제거)
    searchRegionSelect.addEventListener('change', function() {
        saveSearchState(); // 지역 변경 시 상태 저장
    });

    searchCompanyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveSearchState(); // 엔터 입력 시 상태 저장
            handleSearch();
        }
    });

    // 업체명 입력 시에도 상태 저장 (입력 완료 시)
    searchCompanyInput.addEventListener('input', function() {
        // 디바운싱을 위해 타이머 사용
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            saveSearchState();
        }, 500); // 500ms 후 저장
    });

    // 검색 처리 함수
    async function handleSearch() {
        const region = searchRegionSelect.value.trim();
        const companyName = searchCompanyInput.value.trim();
        const excludeNoVisitColors = excludeNoVisitColorsCheckbox ? excludeNoVisitColorsCheckbox.checked : false;

        // 검색 상태 업데이트
        searchState.region = region;
        searchState.companyName = companyName;
        searchState.isFiltered = !!(region || companyName);
        searchState.excludeNoVisitColors = excludeNoVisitColors;
        
        // 검색 상태를 sessionStorage에 저장 (뒤로가기 시 복원용)
        sessionStorage.setItem('worklogSearchState', JSON.stringify(searchState));

        try {
            // 로딩 표시
            if (companyList) {
                companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">검색 중...</td></tr>';
            }
            
            // 간단한 사용자 확인
            const currentUser = await window.dataLoader.getCurrentUser();
            if (!currentUser) {
                if (companyList) {
                    companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #f00;">로그인이 필요합니다.</td></tr>';
                }
                return;
            }

            let companies = [];
            
            // 캐시된 업체 검색만 수행 (전체 목록 로드 제거)
            if (region || companyName) {
                companies = await window.cachedDataLoader.searchCompanies(region, companyName, currentUser.id);
                console.log(`🔍 검색 결과: ${companies.length}개`);
            } else {
                // 검색어가 없으면 빈 배열 반환 (전체 목록 로드하지 않음)
                companies = [];
                console.log('🔍 검색어가 없어 빈 결과 반환');
            }
            
            // 색상 필터링 적용
            if (excludeNoVisitColors) {
                const excludeColors = ['빨강', '보라', '회색', 'red', 'purple', 'gray'];
                companies = companies.filter(company => {
                    return !excludeColors.includes(company.color_code);
                });
                console.log(`🎨 색상 필터링 후: ${companies.length}개`);
            }

            displayCompanies(companies);
        } catch (error) {
            console.error('검색 중 오류:', error);
            alert('검색 중 오류가 발생했습니다: ' + error.message);
            if (companyList) {
                companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #f00;">검색 실패</td></tr>';
            }
        }
    }

    // 현재 로그인한 사용자의 업체 목록 로드
    async function loadCompanies() {
        try {
            console.log('🔄 업체 목록 로드 시작');
            console.log('📊 loadCompanies 함수 호출됨');
            
            // 색상 설정 먼저 로드
            await loadColorSettings();
            
            // 로딩 표시
            if (companyList) {
                companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">데이터를 불러오는 중...</td></tr>';
            }

            // 간단한 사용자 확인
            const currentUser = await window.dataLoader.getCurrentUser();
            if (!currentUser) {
                if (companyList) {
                    companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #f00;">로그인이 필요합니다.</td></tr>';
                }
                return;
            }

            // 필요시 캐시 무효화 (강제 새로고침 또는 데이터 불일치 감지 시)
            const forceRefresh = window.forceDataRefresh || false;
            if (forceRefresh) {
                console.log('🔄 강제 새로고침으로 인한 업체 목록 캐시 무효화');
                if (window.cachedDataLoader && window.cachedDataLoader.invalidateCompaniesCache) {
                    window.cachedDataLoader.invalidateCompaniesCache(currentUser.id);
                }
                window.forceDataRefresh = false; // 플래그 초기화
            }

            // 검색 상태 확인 - 필터링된 상태라면 검색 실행
            const savedState = sessionStorage.getItem('worklogSearchState');
            if (savedState) {
                try {
                    const searchState = JSON.parse(savedState);
                    if (searchState.isFiltered && (searchState.region || searchState.companyName)) {
                        console.log('🔍 검색 상태 감지됨, 필터링된 결과 로드:', searchState);
                        
                        // 검색된 업체 목록 로드
                        const companies = await window.cachedDataLoader.searchCompanies(
                            searchState.region, 
                            searchState.companyName, 
                            currentUser.id
                        );
                        console.log(`🔍 검색 결과: ${companies.length}개 업체`);
                        displayCompanies(companies);
                        return; // 검색 결과를 표시했으므로 전체 목록 로드 생략
                    }
                } catch (error) {
                    console.warn('검색 상태 확인 오류:', error);
                }
            }

            // 검색 상태가 없는 경우 빈 목록 표시
            console.log('📋 검색 상태가 없어 업체 목록을 표시하지 않습니다.');
            if (companyList) {
                companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #666;">업체를 검색하여 주세요.</td></tr>';
                
                // 업체 개수도 0개로 업데이트
                const companyCountElement = document.getElementById('companyCount');
                if (companyCountElement) {
                    companyCountElement.textContent = '(0개)';
                }
            }
        } catch (error) {
            console.error('❌ 업체 목록 로드 오류:', error);
            displayCompanies([]);
        }
    }

    // loadCompanies 함수를 전역으로 노출하여 worklog.html에서 호출 가능하게 함
    window.loadCompanies = loadCompanies;
    
    // restoreSearchState 함수도 전역으로 노출
    window.restoreSearchState = restoreSearchState;

    // 회사 목록 표시
    async function displayCompanies(companies) {
        console.log('🏢 displayCompanies 호출됨 - 업체 개수:', companies ? companies.length : 'null');
        
        // 업체 개수 업데이트
        const companyCountElement = document.getElementById('companyCount');
        if (companyCountElement) {
            const count = companies ? companies.length : 0;
            companyCountElement.textContent = `(${count}개)`;
            console.log(`📊 화면 업체 개수 업데이트: ${count}개`);
        }

        if (!companies || companies.length === 0) {
            // 검색 상태 확인
            const savedState = sessionStorage.getItem('worklogSearchState');
            let isSearching = false;
            
            if (savedState) {
                try {
                    const searchState = JSON.parse(savedState);
                    isSearching = searchState.isFiltered && (searchState.region || searchState.companyName);
                } catch (error) {
                    console.error('검색 상태 확인 오류:', error);
                }
            }
            
            const message = isSearching 
                ? '검색 결과가 없습니다.' 
                : '업체를 검색하여 주세요.';
            
            companyList.innerHTML = '<tr><td colspan="' + (isDeleteMode ? '8' : '7') + '" style="text-align: center; padding: 20px; color: #666;">' + message + '</td></tr>';
            return;
        }

        // 업체 ID 배열 생성
        const companyIds = companies.map(c => c.id);
        
        // PDF 파일 존재 여부 일괄 확인
        let pdfStatusMap = {};
        try {
            pdfStatusMap = await window.db.checkCompaniesPdfExists(companyIds);
        } catch (error) {
            console.error('PDF 상태 확인 오류:', error);
        }

        // 업체별 통계는 이미 데이터베이스에 저장되어 있으므로 그대로 사용
        const companiesWithStats = companies.map(company => {
            return {
                ...company,
                visitCount: company.visit_count || 0,
                lastVisitDate: company.last_visit_date || null,
                hasPdf: pdfStatusMap[company.id] || false
            };
        });

        // 한글 색상을 영어로 변환 (전역 함수 사용)

        // 데이터베이스 기반 동적 색상 스타일 생성 (모든 사용자 색상)
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        if (currentUser.id && window.cachedDataLoader) {
            try {
                // 색상 설정 로드 함수 호출 (이미 직접 DB 조회 포함)
                await loadColorSettings();
                
                const settings = await window.cachedDataLoader.loadUserSettings(currentUser.id);
                if (settings.colors && settings.colors.length > 0) {
                    // 모든 사용자 색상에 대해 동적 CSS 미리 생성 (기본 색상 포함)
                    console.log('🎨 데이터베이스 색상 설정:', settings.colors);
                    for (const colorData of settings.colors) {
                        if (colorData.value && colorData.value.startsWith('#')) {
                            await ensureDynamicColorStyles(colorData.name, colorData.value);
                            console.log(`🎨 색상 스타일 생성: ${colorData.name} → ${colorData.value}`);
                        }
                    }
                    
                    // 각 업체의 색상 스타일 확인 (이미 생성된 것이므로 빠르게 처리)
                    for (const company of companiesWithStats) {
                        if (company.color_code) {
                            const colorData = settings.colors.find(c => c.key === company.color_code || c.name === company.color_code);
                            if (colorData) {
                                await ensureDynamicColorStyles(company.color_code, colorData.value);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('동적 색상 스타일 생성 오류:', error);
            }
        }

        // 색상 디버깅 로그
        console.log('🎨 색상 디버깅:', companiesWithStats.slice(0, 3).map(c => ({
            name: c.company_name,
            original_color: c.color_code,
            converted_color: convertColorCode(c.color_code),
            colorClass: c.color_code ? `color-${convertColorCode(c.color_code)}` : 'no-color'
        })));

        const html = companiesWithStats.map(company => `
            <tr class="company-row ${company.color_code ? `color-${convertColorCode(company.color_code)}` : ''}" onclick="${isDeleteMode ? '' : `goToCompanyDetail('${company.id}')`}">
                ${isDeleteMode ? `
                    <td>
                        <input type="checkbox" class="company-checkbox" value="${company.id}" 
                               onchange="toggleCompanySelection('${company.id}', this.checked)"
                               onclick="event.stopPropagation()">
                    </td>
                ` : ''}
                <td>
                    <span class="pdf-indicator" style="
                        display: inline-block;
                        width: 26px;
                        text-align: center;
                        font-size: 18px;
                        vertical-align: middle;
                        ${company.hasPdf ? 'color: #27ae60;' : 'color: transparent;'}
                    ">
                        <i class="fas fa-file-pdf"></i>
                    </span>
                    <span class="company-name">
                        ${company.company_name || '미입력'}
                    </span>
                </td>
                <td>${company.address || '미입력'}</td>
                <td>${company.contact_person || '미입력'}</td>
                <td>${company.phone ? `<a href="tel:${company.phone}" style="color: #007bff; text-decoration: none;" onclick="event.stopPropagation()">${company.phone}</a>` : '미입력'}</td>
                <td>${company.business_type || '미입력'}</td>
                <td class="visit-count">${company.visitCount || 0}</td>
                <td class="last-visit">${(() => {
                    const hide = shouldHideVisitDate(company.color_code);
                    if (company.color_code === '회색' || company.color_code === '보라') {
                        console.log(`🎯 업체: ${company.company_name}, 색상: ${company.color_code}, 숨김여부: ${hide}, colorHideVisitDateMap:`, colorHideVisitDateMap);
                    }
                    return hide ? '-' : (company.lastVisitDate ? formatDate(company.lastVisitDate) + '일' : '방문기록 없음');
                })()}</td>
            </tr>
        `).join('');

        companyList.innerHTML = html;
        
        // 정렬용 데이터 저장
        companiesData = companiesWithStats;
    }

    // 날짜 차이 계산 (경과 일수)
    function formatDate(dateString) {
        if (!dateString) return null;
        
        const visitDate = new Date(dateString);
        const today = new Date();
        
        // 시간 정보를 제거하고 날짜만 비교
        const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        const diffTime = todayOnly - visitDateOnly;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    // WorkLogService는 local-storage.js에서 정의됨

    // 회사 상세 페이지로 이동
    window.goToCompanyDetail = function(companyId) {
        if (!isDeleteMode) {
            saveSearchState();
            window.location.href = `company-detail.html?id=${companyId}`;
        }
    };
    
    // 검색 상태 저장
    function saveSearchState() {
        sessionStorage.setItem('worklogSearchState', JSON.stringify(searchState));
    }
    
    // 검색 상태 복원 (강화된 버전)
    function restoreSearchState() {
        // 두 가지 키 모두 확인 (이전 버전 호환성)
        const savedState = sessionStorage.getItem('worklogSearchState') || sessionStorage.getItem('searchState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                searchState = state;
                
                console.log('🔄 검색 상태 복원:', state);
                
                // 입력 필드에 값 복원 (요소가 존재하는 경우에만)
                if (searchRegionSelect) {
                    searchRegionSelect.value = state.region || '';
                    console.log('지역 복원:', state.region);
                }
                if (searchCompanyInput) {
                    searchCompanyInput.value = state.companyName || '';
                    console.log('업체명 복원:', state.companyName);
                }
                
                // 필터가 있는 경우 자동 검색 수행
                if (state.isFiltered && (state.region || state.companyName)) {
                    console.log('필터된 상태 - 자동 검색 수행');
                    setTimeout(() => {
                        handleSearch();
                    }, 200);
                }
                
                // 세션 스토리지 정리하지 않음 (뒤로가기 시 계속 사용)
            } catch (error) {
                console.error('검색 상태 복원 실패:', error);
            }
        }
    }

    // 삭제 모드 토글
    function handleDeleteMode() {
        // 로그인 확인 (최신 sessionStorage에서 직접 읽기)
        let currentUser;
        try {
            const userJson = sessionStorage.getItem('currentUser');
            currentUser = userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            console.error('사용자 정보 파싱 오류:', error);
            currentUser = null;
        }
        
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }

        if (!isDeleteMode) {
            // 삭제 모드 진입
            isDeleteMode = true;
            deleteBtn.textContent = '삭제 실행';
            deleteBtn.className = 'btn btn-danger';
            
            // 테이블에 삭제 모드 클래스 추가
            const table = document.getElementById('companyTable');
            table.classList.add('delete-mode');
            
            // 헤더에 체크박스 컬럼 추가
            const headerRow = table.querySelector('thead tr');
            const checkboxHeader = document.createElement('th');
            checkboxHeader.innerHTML = '<input type="checkbox" id="selectAll" onchange="toggleSelectAll(this.checked)">';
            headerRow.insertBefore(checkboxHeader, headerRow.firstChild);
            
            // 회사 목록 다시 표시
            loadCompanies();
            
            alert('삭제할 업체를 선택하세요. 다시 삭제 버튼을 누르면 선택된 업체들이 삭제됩니다.');
        } else {
            // 삭제 실행
            if (selectedCompanies.size === 0) {
                alert('삭제할 업체를 선택해주세요.');
                return;
            }
            
            const selectedIds = Array.from(selectedCompanies);
            const confirmMessage = `선택된 ${selectedCompanies.size}개 업체를 정말로 삭제하시겠습니까?\n\n삭제될 업체:\n${selectedIds.map(id => {
                const row = document.querySelector(`input[value="${id}"]`);
                if (row) {
                    const companyName = row.closest('tr').querySelector('.company-name').textContent;
                    return `- ${companyName}`;
                }
                return `- ID: ${id}`;
            }).join('\n')}\n\n⚠️ 삭제된 업체의 업무일지도 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.`;
            
            if (confirm(confirmMessage)) {
                deleteSelectedCompanies();
            }
        }
    }

    // 업체 선택/해제
    window.toggleCompanySelection = function(companyId, isSelected) {
        if (isSelected) {
            selectedCompanies.add(companyId);
        } else {
            selectedCompanies.delete(companyId);
        }
        
        // 전체 선택 체크박스 상태 업데이트
        const selectAllCheckbox = document.getElementById('selectAll');
        const allCheckboxes = document.querySelectorAll('.company-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.company-checkbox:checked');
        
        if (checkedCheckboxes.length === allCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    };

    // 전체 선택/해제
    window.toggleSelectAll = function(isSelected) {
        const checkboxes = document.querySelectorAll('.company-checkbox');
        selectedCompanies.clear();
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = isSelected;
            if (isSelected) {
                selectedCompanies.add(checkbox.value);
            }
        });
    };

    // 선택된 업체들 삭제
    async function deleteSelectedCompanies() {
        try {
            // 로그인 확인 (최신 sessionStorage에서 직접 읽기)
            let currentUser;
            try {
                const userJson = sessionStorage.getItem('currentUser');
                currentUser = userJson ? JSON.parse(userJson) : null;
            } catch (error) {
                console.error('사용자 정보 파싱 오류:', error);
                currentUser = null;
            }
            
            if (!currentUser) {
                alert('로그인이 필요합니다.');
                return;
            }

            deleteBtn.disabled = true;
            deleteBtn.textContent = '삭제 중...';
            
            const companyIds = Array.from(selectedCompanies);
            let successCount = 0;
            let errorCount = 0;
            
            // 각 업체를 개별적으로 삭제
            for (const companyId of companyIds) {
                try {
                    // 데이터베이스에서 삭제 (본인의 업체만)
                    if (window.db && window.db.client) {
                        await window.db.deleteClientCompany(companyId);
                        successCount++;
                        console.log(`업체 ${companyId} 삭제 성공`);
                        
                        // 캐시 무효화 (개별 삭제에서도 적용)
                        if (window.cachedDataLoader && currentUser.id) {
                            window.cachedDataLoader.invalidateCompanyCache(currentUser.id);
                            console.log('🗑️ 개별 업체 등록/수정 후 캐시 무효화 완료');
                        }
                    } else {
                        console.warn('데이터베이스 연결 없음');
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`업체 ${companyId} 삭제 실패:`, error);
                }
            }
            
            if (successCount > 0) {
                alert(`${successCount}개 업체가 성공적으로 삭제되었습니다.`);
                if (errorCount > 0) {
                    alert(`${errorCount}개 업체 삭제에 실패했습니다.`);
                }
                
                // 데이터 변경 알림 (자동 캐시 무효화 및 새로고침 포함)
                if (currentUser && currentUser.id && window.dataChangeManager) {
                    window.dataChangeManager.notifyChange(currentUser.id, 'delete');
                }
            } else {
                alert('모든 업체 삭제에 실패했습니다.');
            }
            
            // 삭제 모드 종료
            exitDeleteMode();
            
        } catch (error) {
            alert('업체 삭제 중 오류가 발생했습니다: ' + error.message);
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '삭제';
        }
    }

    // 삭제 모드 종료
    function exitDeleteMode() {
        isDeleteMode = false;
        selectedCompanies.clear();
        
        deleteBtn.textContent = '삭제';
        deleteBtn.className = 'btn btn-warning';
        deleteBtn.disabled = false;
        
        // 테이블에서 삭제 모드 클래스 제거
        const table = document.getElementById('companyTable');
        table.classList.remove('delete-mode');
        
        // 헤더에서 체크박스 컬럼 제거
        const headerRow = table.querySelector('thead tr');
        const checkboxHeader = headerRow.querySelector('th:first-child');
        if (checkboxHeader && checkboxHeader.querySelector('#selectAll')) {
            headerRow.removeChild(checkboxHeader);
        }
    }

    // 정렬 상태 저장
    let currentSortColumn = -1;
    let sortDirection = 'asc';
    let companiesData = [];

    // 테이블 정렬 함수
    window.sortTable = async function(columnIndex) {
        // 삭제 모드에서는 정렬 비활성화
        if (isDeleteMode) return;
        
        const table = document.getElementById('companyTable');
        const headers = table.querySelectorAll('th.sortable');
        
        // 기존 정렬 클래스 제거
        headers.forEach(header => {
            header.classList.remove('asc', 'desc');
        });

        // 정렬 방향 결정
        if (currentSortColumn === columnIndex) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortDirection = 'asc';
        }
        
        currentSortColumn = columnIndex;
        
        // 헤더에 정렬 클래스 추가
        headers[columnIndex].classList.add(sortDirection);

        // 데이터 정렬
        const sortedCompanies = [...companiesData].sort((a, b) => {
            let aValue, bValue;
            
            switch(columnIndex) {
                case 0: // 업체명
                    aValue = (a.company_name || '').toLowerCase();
                    bValue = (b.company_name || '').toLowerCase();
                    break;
                case 1: // 주소
                    aValue = (a.address || '').toLowerCase();
                    bValue = (b.address || '').toLowerCase();
                    break;
                case 2: // 담당자
                    aValue = (a.contact_person || '').toLowerCase();
                    bValue = (b.contact_person || '').toLowerCase();
                    break;
                case 3: // 전화번호
                    aValue = (a.phone || '').toLowerCase();
                    bValue = (b.phone || '').toLowerCase();
                    break;
                case 4: // 업종
                    aValue = (a.business_type || '').toLowerCase();
                    bValue = (b.business_type || '').toLowerCase();
                    break;
                case 5: // 방문횟수
                    aValue = a.visitCount || 0;
                    bValue = b.visitCount || 0;
                    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                case 6: // 최근방문일
                    // 방문일이 숨겨진 업체는 정렬에서 제외하고 맨 뒤로
                    const aHidden = shouldHideVisitDate(a.color_code);
                    const bHidden = shouldHideVisitDate(b.color_code);
                    
                    if (aHidden && bHidden) return 0;
                    if (aHidden) return sortDirection === 'asc' ? 1 : -1;
                    if (bHidden) return sortDirection === 'asc' ? -1 : 1;
                    
                    aValue = a.lastVisitDate ? new Date(a.lastVisitDate) : new Date(0);
                    bValue = b.lastVisitDate ? new Date(b.lastVisitDate) : new Date(0);
                    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                default:
                    return 0;
            }
            
            // 문자열 비교
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        // 정렬된 데이터로 테이블 다시 렌더링
        await renderSortedCompanies(sortedCompanies);
    };

    // 정렬된 업체 목록 렌더링
    async function renderSortedCompanies(companies) {
        // 커스텀 색상 스타일 생성 (사용자 설정에서 색상 정보 가져오기)
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        if (currentUser.id && window.cachedDataLoader) {
            try {
                const settings = await window.cachedDataLoader.loadUserSettings(currentUser.id);
                if (settings.colors) {
                    // 각 업체의 커스텀 색상 스타일 생성
                    for (const company of companies) {
                        if (company.color_code) {
                            const colorData = settings.colors.find(c => c.key === company.color_code || c.name === company.color_code);
                            if (colorData) {
                                await ensureDynamicColorStyles(company.color_code, colorData.value);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('정렬 렌더링 중 커스텀 색상 스타일 생성 오류:', error);
            }
        }

        const html = companies.map(company => `
            <tr class="company-row ${company.color_code ? `color-${convertColorCode(company.color_code)}` : ''}" onclick="${isDeleteMode ? '' : `goToCompanyDetail('${company.id}')`}">
                ${isDeleteMode ? `
                    <td>
                        <input type="checkbox" class="company-checkbox" value="${company.id}" 
                               onchange="toggleCompanySelection('${company.id}', this.checked)"
                               onclick="event.stopPropagation()">
                    </td>
                ` : ''}
                <td>
                    <span class="pdf-indicator" style="
                        display: inline-block;
                        width: 26px;
                        text-align: center;
                        font-size: 18px;
                        vertical-align: middle;
                        ${company.hasPdf ? 'color: #27ae60;' : 'color: transparent;'}
                    ">
                        <i class="fas fa-file-pdf"></i>
                    </span>
                    <span class="company-name">
                        ${company.company_name || '미입력'}
                    </span>
                </td>
                <td>${company.address || '미입력'}</td>
                <td>${company.contact_person || '미입력'}</td>
                <td>${company.phone ? `<a href="tel:${company.phone}" style="color: #007bff; text-decoration: none;" onclick="event.stopPropagation()">${company.phone}</a>` : '미입력'}</td>
                <td>${company.business_type || '미입력'}</td>
                <td class="visit-count">${company.visitCount || 0}</td>
                <td class="last-visit">${(() => {
                    const hide = shouldHideVisitDate(company.color_code);
                    if (company.color_code === '회색' || company.color_code === '보라') {
                        console.log(`🎯 업체: ${company.company_name}, 색상: ${company.color_code}, 숨김여부: ${hide}, colorHideVisitDateMap:`, colorHideVisitDateMap);
                    }
                    return hide ? '-' : (company.lastVisitDate ? formatDate(company.lastVisitDate) + '일' : '방문기록 없음');
                })()}</td>
            </tr>
        `).join('');

        companyList.innerHTML = html;
    }

    // 업체 목록 XLSX 내보내기 함수
    async function exportCompanies() {
        try {
            console.log('내보내기 시작...');
            
            // SheetJS 라이브러리가 로드되었는지 확인
            if (typeof XLSX === 'undefined') {
                console.log('XLSX 라이브러리 로드 중...');
                await loadXLSXLibrary();
            }

            // 현재 로그인한 사용자의 업체 데이터 가져오기
            let companies = [];
            try {
                // 로그인한 사용자 확인 (최신 sessionStorage에서 직접 읽기)
                let currentUser;
                try {
                    const userJson = sessionStorage.getItem('currentUser');
                    currentUser = userJson ? JSON.parse(userJson) : null;
                } catch (error) {
                    console.error('사용자 정보 파싱 오류:', error);
                    currentUser = null;
                }
                
                if (!currentUser) {
                    alert('로그인이 필요합니다.');
                    return;
                }

                // 데이터베이스에서 해당 사용자의 개인 업체만 가져오기
                if (window.db && window.db.client) {
                    companies = await window.db.getClientCompanies(currentUser.id);
                    console.log(`${currentUser.name}님의 개인 업체 데이터 로드됨:`, companies.length, '개');
                } else {
                    console.log('데이터베이스 연결 없음, 빈 템플릿 생성');
                    companies = [];
                }
            } catch (error) {
                console.log('업체 데이터 로드 실패, 빈 템플릿 생성:', error.message);
                companies = [];
            }

            // XLSX 데이터 준비 - 헤더 행 (첫 번째 행)
            const worksheet_data = [
                ['업체명', '지역', '주소', '전화번호', '담당자', '휴대폰', '이메일', '결제조건', '채권금액', '업종', '제조품', '사용품목', '메모', '색상']
            ];

            // 업체 데이터가 있는 경우에만 추가
            if (companies && companies.length > 0) {
                companies.forEach(company => {
                    worksheet_data.push([
                        company.company_name || '',
                        company.region || '',
                        company.address || '',
                        company.phone || '',
                        company.contact_person || '',
                        company.mobile || '',
                        company.email || '',
                        company.payment_terms || '',
                        company.debt_amount || '',
                        company.business_type || '',
                        company.products || '',
                        company.usage_items || '',
                        company.notes || '',
                        company.color_code || ''
                    ]);
                });
            }

            // 워크시트 생성
            const ws = XLSX.utils.aoa_to_sheet(worksheet_data);
            
            // 컬럼 너비 설정
            const wscols = [
                {wch: 20}, // 업체명
                {wch: 15}, // 지역  
                {wch: 30}, // 주소
                {wch: 15}, // 전화번호
                {wch: 15}, // 담당자
                {wch: 15}, // 휴대폰
                {wch: 20}, // 이메일
                {wch: 15}, // 결제조건
                {wch: 15}, // 채권금액
                {wch: 15}, // 업종
                {wch: 20}, // 제조품
                {wch: 20}, // 사용품목
                {wch: 30}, // 메모
                {wch: 10}  // 색상
            ];
            ws['!cols'] = wscols;

            // 워크북 생성
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "업체목록");

            // 파일 다운로드
            const filename = `업체목록.xlsx`;
            XLSX.writeFile(wb, filename);

            console.log('파일 다운로드 완료:', filename);

            // 성공 메시지 표시 (업체가 있을 때만)
            if (companies && companies.length > 0) {
                alert(`업체 목록을 성공적으로 내보냈습니다. (${companies.length}개 업체)`);
            }
            // 데이터가 없을 때는 조용히 템플릿만 다운로드
            
        } catch (error) {
            console.error('내보내기 오류:', error);
            alert('내보내기 중 오류가 발생했습니다: ' + error.message);
        }
    }

    // XLSX 라이브러리 동적 로드
    function loadXLSXLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 업체 목록 XLSX 불러오기 함수
    async function importCompanies(event) {
        const file = event.target.files[0];
        if (!file) return;

        console.log('=== XLSX 불러오기 시작 ===');
        console.log('파일:', file.name);
        console.log('데이터베이스 객체 존재:', !!window.db);
        console.log('Supabase 클라이언트 존재:', !!window.db?.client);

        const fileExtension = file.name.toLowerCase().split('.').pop();
        if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
            alert('XLSX 또는 XLS 파일만 업로드 가능합니다.');
            return;
        }

        try {
            // SheetJS 라이브러리가 로드되었는지 확인
            if (typeof XLSX === 'undefined') {
                console.log('XLSX 라이브러리 로드 중...');
                await loadXLSXLibrary();
            }

            const data = await readFileAsArrayBuffer(file);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // 첫 번째 시트 사용
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            console.log('XLSX 데이터 파싱 완료:', jsonData.length, '행');
            console.log('첫 번째 행 (헤더):', jsonData[0]);
            console.log('두 번째 행 (샘플 데이터):', jsonData[1]);
            
            if (jsonData.length < 2) {
                alert('유효한 데이터가 없습니다. 최소 헤더와 1개 이상의 데이터 행이 필요합니다.');
                return;
            }

            // 헤더 제거
            const dataRows = jsonData.slice(1);
            let successCount = 0;
            let errorCount = 0;
            
            console.log('처리할 데이터 행 수:', dataRows.length);

            for (const row of dataRows) {
                try {
                    // 업체명이 있는 행만 처리
                    if (row[0] && row[0].toString().trim()) {
                        const companyData = {
                            company_name: row[0] ? row[0].toString().trim() : '',
                            region: row[1] ? row[1].toString().trim() : '',
                            address: row[2] ? row[2].toString().trim() : '',
                            phone: row[3] ? row[3].toString().trim() : '',
                            contact_person: row[4] ? row[4].toString().trim() : '',
                            mobile: row[5] ? row[5].toString().trim() : '',
                            email: row[6] ? row[6].toString().trim() : '',
                            payment_terms: row[7] ? row[7].toString().trim() : '',
                            debt_amount: row[8] ? row[8].toString().trim() : '',
                            business_type: row[9] ? row[9].toString().trim() : '',
                            products: row[10] ? row[10].toString().trim() : '',
                            usage_items: row[11] ? row[11].toString().trim() : '',
                            notes: row[12] ? row[12].toString().trim() : '',
                            color_code: row[13] ? row[13].toString().trim() : '',
                            visit_count: 0,
                            last_visit_date: null
                        };

                        console.log('업체 데이터 생성 시도:', companyData.company_name);
                        
                        // 현재 로그인한 사용자 확인 후 데이터베이스에 저장 (최신 sessionStorage에서 직접 읽기)
                        let currentUser;
                        try {
                            const userJson = sessionStorage.getItem('currentUser');
                            currentUser = userJson ? JSON.parse(userJson) : null;
                        } catch (error) {
                            console.error('사용자 정보 파싱 오류:', error);
                            currentUser = null;
                        }
                        
                        if (!currentUser) {
                            throw new Error('로그인이 필요합니다.');
                        }

                        console.log('현재 사용자:', currentUser);
                        console.log('데이터베이스 연결 상태:', !!window.db, !!window.db?.client);

                        if (window.db && window.db.client) {
                            // 업체 데이터에 사용자 ID와 회사 도메인 추가
                            companyData.user_id = currentUser.id;
                            companyData.company_domain = currentUser.company_domain || 'namkyungsteel.com';
                            
                            console.log('저장할 업체 데이터:', companyData);
                            console.log('currentUser.id 타입:', typeof currentUser.id, '값:', currentUser.id);
                            
                            const result = await window.db.createClientCompany(companyData);
                            console.log('저장 결과:', result);
                            
                            if (!result.success) {
                                throw new Error('데이터베이스 저장 실패: ' + JSON.stringify(result));
                            }
                            
                            // 캐시 무효화
                            window.cachedDataLoader.invalidateCompanyCache(currentUser.id);
                        } else {
                            console.error('데이터베이스 연결 없음');
                            throw new Error('데이터베이스 연결이 필요합니다.');
                        }
                        
                        successCount++;
                    }
                } catch (error) {
                    errorCount++;
                    console.error('업체 추가 실패:', error);
                }
            }

            // 결과 메시지
            console.log('불러오기 완료 - 성공:', successCount, '실패:', errorCount);
            
            if (successCount > 0) {
                alert(`${successCount}개 업체를 성공적으로 불러왔습니다.`);
                if (errorCount > 0) {
                    alert(`${errorCount}개 업체 불러오기에 실패했습니다.`);
                }
                
                // 데이터 변경 알림 (자동 캐시 무효화 및 새로고침 포함)
                let importUser;
                try {
                    const userJson = sessionStorage.getItem('currentUser');
                    importUser = userJson ? JSON.parse(userJson) : null;
                } catch (error) {
                    console.error('사용자 정보 파싱 오류:', error);
                    importUser = null;
                }
                
                if (importUser && importUser.id && window.dataChangeManager) {
                    window.dataChangeManager.notifyChange(importUser.id, 'import');
                }
            } else {
                console.error('모든 업체 불러오기 실패');
                alert('업체를 불러오는데 실패했습니다.');
            }

        } catch (error) {
            console.error('XLSX 불러오기 전체 오류:', error);
            alert('파일 읽기 중 오류가 발생했습니다: ' + error.message);
        }

        // 파일 입력 초기화
        xlsxFileInput.value = '';
    }

    // 파일을 ArrayBuffer로 읽기
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    // 테스트용 샘플 데이터 생성 함수 (디버그용)
    window.createTestData = async function() {
        try {
            const testCompany = {
                company_name: '테스트업체',
                region: '서울',
                address: '서울시 강남구',
                phone: '02-1234-5678',
                contact_person: '김철수',
                email: 'test@test.com',
                business_type: '제조업',
                notes: '테스트 업체입니다'
            };
            
            await CompanyService.create(testCompany);
            Utils.showSuccess('테스트 업체가 생성되었습니다.');
            loadCompanies();
        } catch (error) {
            console.error('테스트 데이터 생성 오류:', error);
            Utils.showError('테스트 데이터 생성 실패: ' + error.message);
        }
    };
});