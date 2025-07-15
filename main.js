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

    let isDeleteMode = false;
    let selectedCompanies = new Set();
    let searchState = {
        region: '',
        companyName: '',
        isFiltered: false
    };

    // 초기 데이터 로드
    loadCompanies();
    
    // 검색 상태 복원
    restoreSearchState();

    // 이벤트 리스너 등록
    searchBtn.addEventListener('click', handleSearch);
    addCompanyBtn.addEventListener('click', () => {
        // 로그인 확인
        const currentUser = AuthManager.getCurrentUser();
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

    // 지역 선택 시 자동 검색
    searchRegionSelect.addEventListener('change', function() {
        handleSearch();
    });

    searchCompanyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // 검색 처리 함수
    async function handleSearch() {
        const region = searchRegionSelect.value.trim();
        const companyName = searchCompanyInput.value.trim();

        // 검색 상태 업데이트
        searchState.region = region;
        searchState.companyName = companyName;
        searchState.isFiltered = !!(region || companyName);

        try {
            // 로딩 표시
            if (companyList) {
                companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">검색 중...</td></tr>';
            }
            
            // 현재 로그인한 사용자 확인
            const currentUser = AuthManager.getCurrentUser();
            if (!currentUser) {
                if (companyList) {
                    companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #f00;">로그인이 필요합니다.</td></tr>';
                }
                return;
            }

            let companies = [];
            
            // 데이터베이스에서 로그인한 사용자의 개인 업체 검색
            if (window.db && window.db.client) {                
                if (region || companyName) {
                    companies = await window.db.searchClientCompanies(region, companyName, currentUser.id);
                } else {
                    companies = await window.db.getClientCompanies(currentUser.id);
                }
                console.log(`${currentUser.name}님의 개인 검색 결과:`, companies.length, '개');
            } else {
                console.warn('데이터베이스 연결 없음');
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
            // 로딩 표시
            if (companyList) {
                companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">데이터를 불러오는 중...</td></tr>';
            }

            // 현재 로그인한 사용자 확인
            const currentUser = AuthManager.getCurrentUser();
            if (!currentUser) {
                if (companyList) {
                    companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #f00;">로그인이 필요합니다.</td></tr>';
                }
                return;
            }

            let companies = [];
            
            // 데이터베이스에서 로그인한 사용자의 개인 업체 목록만 가져오기
            if (window.db && window.db.client) {
                companies = await window.db.getClientCompanies(currentUser.id);
                console.log(`${currentUser.name}님의 개인 업체 목록 로드됨:`, companies.length, '개');
            } else {
                console.warn('데이터베이스 연결 없음');
            }
            
            displayCompanies(companies);
        } catch (error) {
            console.error('데이터 로드 중 오류:', error);
            // 오류 메시지를 표시하지 않고 빈 리스트로 처리
            displayCompanies([]);
        }
    }

    // 회사 목록 표시
    async function displayCompanies(companies) {
        // 업체 개수 업데이트
        const companyCountElement = document.getElementById('companyCount');
        if (companyCountElement) {
            companyCountElement.textContent = `(${companies ? companies.length : 0}개)`;
        }

        if (!companies || companies.length === 0) {
            companyList.innerHTML = '<tr><td colspan="' + (isDeleteMode ? '8' : '7') + '" style="text-align: center; padding: 20px; color: #666;">등록된 업체가 없습니다. 새 업체를 등록해보세요.</td></tr>';
            return;
        }

        // 업체별 통계는 이미 데이터베이스에 저장되어 있으므로 그대로 사용
        const companiesWithStats = companies.map(company => {
            return {
                ...company,
                visitCount: company.visit_count || 0,
                lastVisitDate: company.last_visit_date || null
            };
        });

        const html = companiesWithStats.map(company => `
            <tr class="company-row ${company.company_color ? `color-${company.company_color}` : ''}" onclick="${isDeleteMode ? '' : `goToCompanyDetail('${company.id}')`}">
                ${isDeleteMode ? `
                    <td>
                        <input type="checkbox" class="company-checkbox" value="${company.id}" 
                               onchange="toggleCompanySelection('${company.id}', this.checked)"
                               onclick="event.stopPropagation()">
                    </td>
                ` : ''}
                <td>
                    ${company.company_color ? `<span class="color-indicator"></span>` : ''}
                    <span class="company-name">
                        ${company.company_name || '미입력'}
                    </span>
                </td>
                <td>${company.address || '미입력'}</td>
                <td>${company.contact_person || '미입력'}</td>
                <td>${company.phone || '미입력'}</td>
                <td>${company.business_type || '미입력'}</td>
                <td class="visit-count">${company.visitCount || 0}</td>
                <td class="last-visit">${company.company_color === 'gray' ? '-' : (company.lastVisitDate ? formatDate(company.lastVisitDate) + '일' : '방문기록 없음')}</td>
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
        sessionStorage.setItem('searchState', JSON.stringify(searchState));
    }
    
    // 검색 상태 복원
    function restoreSearchState() {
        const savedState = sessionStorage.getItem('searchState');
        if (savedState) {
            try {
                searchState = JSON.parse(savedState);
                
                // 입력 필드에 값 복원
                searchRegionInput.value = searchState.region || '';
                searchCompanyInput.value = searchState.companyName || '';
                
                // 필터가 있는 경우 검색 수행
                if (searchState.isFiltered) {
                    handleSearch();
                }
                
                // 세션 스토리지 정리
                sessionStorage.removeItem('searchState');
            } catch (error) {
                console.error('검색 상태 복원 실패:', error);
            }
        }
    }

    // 삭제 모드 토글
    function handleDeleteMode() {
        // 로그인 확인
        const currentUser = AuthManager.getCurrentUser();
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
            // 로그인 확인
            const currentUser = AuthManager.getCurrentUser();
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
            } else {
                alert('모든 업체 삭제에 실패했습니다.');
            }
            
            // 삭제 모드 종료
            exitDeleteMode();
            
            // 목록 새로고침
            loadCompanies();
            
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
    window.sortTable = function(columnIndex) {
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
                    // 회색 업체는 정렬에서 제외하고 맨 뒤로
                    if (a.company_color === 'gray' && b.company_color === 'gray') return 0;
                    if (a.company_color === 'gray') return sortDirection === 'asc' ? 1 : -1;
                    if (b.company_color === 'gray') return sortDirection === 'asc' ? -1 : 1;
                    
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
        renderSortedCompanies(sortedCompanies);
    };

    // 정렬된 업체 목록 렌더링
    function renderSortedCompanies(companies) {
        const html = companies.map(company => `
            <tr class="company-row ${company.company_color ? `color-${company.company_color}` : ''}" onclick="${isDeleteMode ? '' : `goToCompanyDetail('${company.id}')`}">
                ${isDeleteMode ? `
                    <td>
                        <input type="checkbox" class="company-checkbox" value="${company.id}" 
                               onchange="toggleCompanySelection('${company.id}', this.checked)"
                               onclick="event.stopPropagation()">
                    </td>
                ` : ''}
                <td>
                    ${company.company_color ? `<span class="color-indicator"></span>` : ''}
                    <span class="company-name">
                        ${company.company_name || '미입력'}
                    </span>
                </td>
                <td>${company.address || '미입력'}</td>
                <td>${company.contact_person || '미입력'}</td>
                <td>${company.phone || '미입력'}</td>
                <td>${company.business_type || '미입력'}</td>
                <td class="visit-count">${company.visitCount || 0}</td>
                <td class="last-visit">${company.company_color === 'gray' ? '-' : (company.lastVisitDate ? formatDate(company.lastVisitDate) + '일' : '방문기록 없음')}</td>
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
                // 로그인한 사용자 확인
                const currentUser = AuthManager.getCurrentUser();
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
                        company.company_color || ''
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
                            company_color: row[13] ? row[13].toString().trim() : '',
                            visit_count: 0,
                            last_visit_date: null
                        };

                        console.log('업체 데이터 생성 시도:', companyData.company_name);
                        
                        // 현재 로그인한 사용자 확인 후 데이터베이스에 저장
                        const currentUser = AuthManager.getCurrentUser();
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
                            
                            const result = await window.db.createClientCompany(companyData);
                            console.log('저장 결과:', result);
                            
                            if (!result.success) {
                                throw new Error('데이터베이스 저장 실패: ' + JSON.stringify(result));
                            }
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
                
                console.log('업체 목록 새로고침 시작...');
                // 목록 새로고침
                await loadCompanies();
                console.log('업체 목록 새로고침 완료');
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