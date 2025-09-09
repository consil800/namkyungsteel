// 업체 상세 페이지 JavaScript

let currentCompany = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('업체 상세 페이지 로드 시작');
    
    // 데이터베이스 초기화 대기
    await waitForDatabase();
    
    // 로그인 확인 (최신 sessionStorage에서 직접 읽기)
    try {
        const userJson = sessionStorage.getItem('currentUser');
        currentUser = userJson ? JSON.parse(userJson) : null;
    } catch (error) {
        console.error('사용자 정보 파싱 오류:', error);
        currentUser = null;
    }
    
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        window.location.href = 'login.html';
        return;
    }
    
    console.log('🔍 company-detail.js - 사용자 정보:', {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role
    });
    
    // 프로필 이미지 및 사용자 정보 표시
    console.log('📸 프로필 이미지 로딩 시작');
    console.log('- window.dataLoader 존재:', !!window.dataLoader);
    console.log('- currentUser 정보:', currentUser);
    
    if (window.dataLoader) {
        // 사용자 이름 표시
        window.dataLoader.safeUpdateElement('#userName', currentUser.name || currentUser.email);
        console.log('✅ 사용자 이름 설정 완료');
        
        // 프로필 이미지 표시
        const profileContainer = document.getElementById('profileImageContainer');
        console.log('- profileContainer 찾음:', !!profileContainer);
        
        if (profileContainer) {
            const profileHTML = window.dataLoader.createProfileImage(currentUser, 40);
            console.log('- 생성된 프로필 HTML:', profileHTML);
            profileContainer.innerHTML = profileHTML;
            console.log('✅ 프로필 이미지 설정 완료');
        } else {
            console.error('❌ profileImageContainer를 찾을 수 없음');
        }
        
        // 역할 표시
        const roleMap = { 
            master: '마스터', 
            company_admin: '업체 관리자', 
            company_manager: '매니저', 
            employee: '직원' 
        };
        window.dataLoader.safeUpdateElement('#userRole', roleMap[currentUser.role] || '직원');
        console.log('✅ 사용자 역할 설정 완료');
    } else {
        console.error('❌ window.dataLoader가 로드되지 않음');
    }
    
    // URL에서 업체 ID 추출
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('id');
    
    if (!companyId) {
        alert('업체 ID가 없습니다.');
        window.location.href = 'worklog.html';
        return;
    }
    
    console.log('업체 ID:', companyId);
    
    // 업체 정보 로드
    await loadCompanyDetails(companyId);
    
    // 이벤트 리스너 등록
    initEventListeners();
});

// 데이터베이스 초기화 대기
async function waitForDatabase() {
    let retryCount = 0;
    while ((!window.db || !window.db.client) && retryCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
    }
    console.log('데이터베이스 초기화 상태:', !!window.db, !!window.db?.client);
}

// 업체 메모 필드 처리 (업무일지 JSON 제외)
function getCompanyNotes(notes) {
    if (!notes) return '';
    
    try {
        // JSON 파싱 시도
        const parsed = JSON.parse(notes);
        if (parsed.workLogs) {
            // 업무일지가 있는 경우 메모 필드만 반환
            return parsed.memo || '';
        }
        // JSON이지만 업무일지가 아닌 경우 그대로 반환
        return notes;
    } catch (e) {
        // JSON이 아닌 일반 텍스트인 경우 그대로 반환
        return notes;
    }
}

// 업체 상세 정보 로드 (캐시 시스템 활용)
async function loadCompanyDetails(companyId) {
    try {
        console.log('📊 업체 정보 캐시 로드 시작, ID:', companyId);
        
        // cachedDataLoader 사용하여 캐시된 데이터 로딩
        const companies = await window.cachedDataLoader.loadCompanies(currentUser.id);
        
        currentCompany = companies.find(c => c.id == companyId);
        console.log('🔍 company-detail.js - 찾은 업체:', currentCompany);
        
        if (!currentCompany) {
            // 캐시 클리어 후 한 번 더 시도
            console.warn('⚠️ 업체를 찾을 수 없어 캐시 클리어 후 재시도');
            window.cachedDataLoader.invalidateCompanyCache(currentUser.id);
            
            const companiesRetry = await window.cachedDataLoader.loadCompanies(currentUser.id, true); // forceRefresh = true
            currentCompany = companiesRetry.find(c => c.id == companyId);
            
            if (!currentCompany) {
                throw new Error('업체를 찾을 수 없습니다.');
            }
        }
        
        console.log('✅ 업체 정보 로드됨:', currentCompany);
        console.log('🎨 업체 색상 정보 확인:', {
            color_code: currentCompany.color_code,
            company_color: currentCompany.company_color,
            전체_데이터: currentCompany
        });
        
        // 업체 정보 표시
        displayCompanyDetails(currentCompany);
        
        // 업무일지 목록 로드 및 방문횟수 동기화 (캐시 활용)
        await loadWorkLogs(companyId);
        await syncVisitCount(companyId);
        
    } catch (error) {
        console.error('❌ 업체 정보 로드 오류:', error);
        
        // 사용자 친화적 에러 처리
        const errorContainer = document.getElementById('companyDetails');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; color: #856404;">
                    <h3>⚠️ 업체 정보를 불러올 수 없습니다</h3>
                    <p>네트워크 연결을 확인하고 다시 시도해주세요.</p>
                    <button onclick="window.location.reload()" class="btn btn-primary">새로고침</button>
                    <button onclick="window.location.href='worklog.html'" class="btn btn-secondary">목록으로 돌아가기</button>
                </div>
            `;
        }
    }
}

// 색상 코드로 색상 값 가져오기
function getColorValue(colorCode) {
    // 한글 색상을 영어로 변환
    const colorMapping = {
        '빨강': 'red',
        '주황': 'orange', 
        '노랑': 'yellow',
        '초록': 'green',
        '파랑': 'blue',
        '보라': 'purple',
        '회색': 'gray'
    };
    
    // 한글 색상인 경우 영어로 변환
    const englishColorCode = colorMapping[colorCode] || colorCode;
    
    const colorMap = {
        'red': '#e74c3c',
        'orange': '#f39c12',
        'yellow': '#f1c40f',
        'green': '#27ae60',
        'blue': '#3498db',
        'purple': '#9b59b6',
        'gray': '#95a5a6'
    };
    
    console.log('🎨 getColorValue 호출:', {
        입력_색상: colorCode,
        변환된_색상: englishColorCode,
        최종_색상값: colorMap[englishColorCode]
    });
    
    return colorMap[englishColorCode] || '#95a5a6'; // 기본값은 회색
}

// 색상 코드로 색상 이름 가져오기
function getColorName(colorCode) {
    // 이미 한글인 경우 그대로 반환
    const koreanColors = ['빨강', '주황', '노랑', '초록', '파랑', '보라', '회색'];
    if (koreanColors.includes(colorCode)) {
        return colorCode;
    }
    
    // 영어 색상을 한글로 변환
    const colorNameMap = {
        'red': '빨강',
        'orange': '주황',
        'yellow': '노랑',
        'green': '초록',
        'blue': '파랑',
        'purple': '보라',
        'gray': '회색'
    };
    return colorNameMap[colorCode] || '회색';
}

// 업체 정보 표시
function displayCompanyDetails(company) {
    // 제목 설정
    document.getElementById('companyTitle').textContent = company.company_name;
    
    // 업체 정보 HTML 생성
    const companyDetails = document.getElementById('companyDetails');
    companyDetails.innerHTML = `
        <div class="info-item">
            <label>업체명:</label>
            <span>${company.company_name || '-'}</span>
        </div>
        <div class="info-item">
            <label>지역:</label>
            <span>${company.region || '-'}</span>
        </div>
        <div class="info-item">
            <label>주소:</label>
            <span>${company.address || '-'}</span>
        </div>
        <div class="info-item">
            <label>전화번호:</label>
            <span>${company.phone || '-'}</span>
        </div>
        <div class="info-item">
            <label>담당자:</label>
            <span>${company.contact_person || '-'}</span>
        </div>
        <div class="info-item">
            <label>휴대폰:</label>
            <span>${company.mobile || '-'}</span>
        </div>
        <div class="info-item">
            <label>이메일:</label>
            <span>${company.email || '-'}</span>
        </div>
        <div class="info-item">
            <label>결제조건:</label>
            <span>${company.payment_terms || '-'}</span>
        </div>
        <div class="info-item">
            <label>채권금액:</label>
            <span>${company.debt_amount || '-'}</span>
        </div>
        <div class="info-item">
            <label>업종:</label>
            <span>${company.business_type || '-'}</span>
        </div>
        <div class="info-item">
            <label>제조품:</label>
            <span>${company.products || '-'}</span>
        </div>
        <div class="info-item">
            <label>사용품목:</label>
            <span>${company.usage_items || '-'}</span>
        </div>
        <div class="info-item">
            <label>방문횟수:</label>
            <span>${company.visit_count || 0}회</span>
        </div>
        <div class="info-item">
            <label>최근방문일:</label>
            <span>${company.last_visit_date || '-'}</span>
        </div>
        <div class="info-item">
            <label>메모:</label>
            <span>${getCompanyNotes(company.notes) || '-'}</span>
        </div>
        <div class="info-item">
            <label>업체 색상:</label>
            <span style="display: inline-block; width: 20px; height: 20px; background-color: ${getColorValue(company.color_code)}; border: 1px solid #ddd; border-radius: 3px; vertical-align: middle;"></span>
            <span style="margin-left: 10px;">${getColorName(company.color_code) || '기본'}</span>
        </div>
        <div class="info-item">
            <label>PDF 파일:</label>
            <span id="pdfFilesDisplay">
                ${displayPdfFiles(company.pdf_files)}
            </span>
        </div>
        <div class="info-item">
            <label>등록일:</label>
            <span>${new Date(company.created_at).toLocaleDateString() || '-'}</span>
        </div>
    `;
}

// PDF 파일 표시 함수
function displayPdfFiles(pdfFiles) {
    if (!pdfFiles || pdfFiles.length === 0) {
        return '<span style="color: #999;">등록된 PDF 파일이 없습니다.</span>';
    }
    
    const filesHTML = pdfFiles.map(file => `
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
            <span style="margin-right: 10px;">📄 ${file.filename}</span>
            <button onclick="viewPdfFile('${file.url}')" class="btn btn-primary" style="padding: 3px 8px; font-size: 12px;">보기</button>
        </div>
    `).join('');
    
    return filesHTML;
}

// PDF 파일 보기 함수
function viewPdfFile(url) {
    window.open(url, '_blank');
}

// 현재 PDF 파일 목록 표시 (수정 모달용)
function displayCurrentPdfFiles(pdfFiles) {
    const container = document.getElementById('currentPdfFiles');
    if (!container) return;
    
    if (!pdfFiles || pdfFiles.length === 0) {
        container.innerHTML = '<p style="color: #999;">현재 등록된 PDF 파일이 없습니다.</p>';
        return;
    }
    
    const filesHTML = pdfFiles.map(file => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px; background: #f8f9fa; border-radius: 3px; margin-bottom: 5px;">
            <span>📄 ${file.filename}</span>
            <div>
                <button onclick="viewPdfFile('${file.url}')" class="btn btn-primary" style="padding: 2px 6px; font-size: 11px; margin-right: 5px;">보기</button>
                <button onclick="removePdfFile('${file.filename}')" class="btn btn-danger" style="padding: 2px 6px; font-size: 11px;">삭제</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = filesHTML;
}

// PDF 파일 업로드 함수
async function uploadPdfFiles(files) {
    const uploadedFiles = [];
    let hasErrors = false;
    
    // Storage 버킷 확인 (간단한 방식)
    console.log('📁 company-pdfs 버킷 사용 준비');
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.type !== 'application/pdf') {
            alert(`${file.name}은 PDF 파일이 아닙니다.`);
            continue;
        }
        
        try {
            // 파일명 정리 (영문/숫자만 허용)
            const originalName = file.name;
            const extension = originalName.split('.').pop();
            const nameWithoutExt = originalName.replace('.' + extension, '');
            
            // 한글과 특수문자를 안전한 문자로 변환
            const safeName = nameWithoutExt
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_')  // 연속된 언더스코어를 하나로
                .replace(/^_|_$/g, ''); // 앞뒤 언더스코어 제거
            
            const fileName = `${Date.now()}_${safeName || 'document'}.${extension}`;
            
            console.log('📤 파일 업로드 시작:', fileName);
            console.log('📝 원본 파일명:', originalName);
            
            // Supabase Storage에 파일 업로드
            const { data, error } = await window.db.client.storage
                .from('company-pdfs')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (error) {
                console.error('파일 업로드 상세 오류:', error);
                throw error;
            }
            
            console.log('✅ 파일 업로드 성공:', data);
            
            // 공개 URL 생성
            const { data: urlData } = window.db.client.storage
                .from('company-pdfs')
                .getPublicUrl(fileName);
            
            if (!urlData || !urlData.publicUrl) {
                throw new Error('파일 URL 생성 실패');
            }
            
            uploadedFiles.push({
                filename: file.name,
                url: urlData.publicUrl,
                uploadedAt: new Date().toISOString()
            });
            
            console.log('✅ 파일 정보 저장 완료:', file.name);
            
        } catch (error) {
            console.error('PDF 파일 업로드 오류:', error);
            console.error('오류 상세 정보:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type
            });
            alert(`${file.name} 업로드 중 오류가 발생했습니다: ${error.message}`);
            hasErrors = true;
        }
    }
    
    // 기존 PDF 파일과 새 파일 병합
    const existingFiles = currentCompany.pdf_files || [];
    const mergedFiles = [...existingFiles, ...uploadedFiles];
    
    if (hasErrors && uploadedFiles.length === 0) {
        throw new Error('모든 파일 업로드가 실패했습니다.');
    }
    
    return mergedFiles;
}

// PDF 파일 삭제 함수
async function removePdfFile(filename) {
    if (!confirm(`${filename}을 삭제하시겠습니까?`)) {
        return;
    }
    
    try {
        const updatedFiles = (currentCompany.pdf_files || []).filter(file => file.filename !== filename);
        
        const updateResult = await window.db.updateClientCompany(currentCompany.id, {
            pdf_files: updatedFiles
        });
        
        if (updateResult.success) {
            currentCompany.pdf_files = updatedFiles;
            displayCurrentPdfFiles(updatedFiles);
            alert('PDF 파일이 삭제되었습니다.');
        } else {
            throw new Error('삭제 실패');
        }
        
    } catch (error) {
        console.error('PDF 파일 삭제 오류:', error);
        alert('PDF 파일 삭제 중 오류가 발생했습니다.');
    }
}

// 이벤트 리스너 초기화
function initEventListeners() {
    // 뒤로가기 버튼
    document.getElementById('backBtn').addEventListener('click', function() {
        window.location.href = 'worklog.html';
    });
    
    // 메인으로 버튼
    document.getElementById('backToMainBtn').addEventListener('click', function() {
        window.location.href = 'employee-dashboard.html';
    });
    
    // 업체 정보 수정 버튼
    document.getElementById('editCompanyBtn').addEventListener('click', async function() {
        if (currentCompany) {
            // 먼저 모달을 표시
            document.getElementById('editModal').style.display = 'block';
            
            // 잠시 대기 후 폼 채우기 (DOM이 렌더링될 시간을 줌)
            setTimeout(async () => {
                await populateEditForm(currentCompany);
            }, 100);
        }
    });
    
    // 업체 삭제 버튼
    document.getElementById('deleteCompanyBtn').addEventListener('click', function() {
        if (currentCompany) {
            deleteCompany(currentCompany.id);
        }
    });
    
    // 업체 관계도 버튼
    document.getElementById('companyNetworkBtn').addEventListener('click', function() {
        if (currentCompany) {
            window.location.href = `company-network.html?id=${currentCompany.id}&name=${encodeURIComponent(currentCompany.company_name)}`;
        }
    });
    
    // 모달 닫기
    document.getElementById('closeModal').addEventListener('click', function() {
        document.getElementById('editModal').style.display = 'none';
    });
    
    // 취소 버튼
    document.getElementById('cancelEditBtn').addEventListener('click', function() {
        document.getElementById('editModal').style.display = 'none';
    });
    
    // 수정 폼 제출
    document.getElementById('editCompanyForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateCompany();
    });
    
    // 새 일지 작성 버튼
    document.getElementById('newWorkLogBtn').addEventListener('click', function() {
        // 업무일지 작성 페이지로 이동
        window.location.href = `work-log-entry.html?companyId=${currentCompany.id}`;
    });
}

// 색상 옵션 로드 (캐시 활용)
async function loadColorOptions() {
    try {
        // cachedDataLoader를 통해 사용자 설정 가져오기
        const settings = await window.cachedDataLoader.loadUserSettings(currentUser.id);
        
        const colorSelect = document.getElementById('editCompanyColor');
        if (!colorSelect) return;
        
        // 기본 옵션 제외하고 기존 옵션들 제거
        colorSelect.innerHTML = '<option value="">색상을 선택하세요</option>';
        
        // 색상 옵션들 추가
        const colors = settings.colors || [];
        if (colors.length === 0) {
            // 색상이 없으면 기본 색상 사용
            loadDefaultColors();
            return;
        }
        
        colors.forEach(color => {
            const option = document.createElement('option');
            option.value = color.key;
            option.textContent = color.name;
            colorSelect.appendChild(option);
        });
        
        console.log('🎨 색상 옵션 로드 완료:', colors.length, '개');
        
    } catch (error) {
        console.error('색상 옵션 로드 오류:', error);
        // 기본 색상들로 대체
        loadDefaultColors();
    }
}

// 기본 색상 로드
function loadDefaultColors() {
    const defaultColors = [
        { key: 'red', name: '빨강', value: '#e74c3c' },
        { key: 'orange', name: '주황', value: '#f39c12' },
        { key: 'yellow', name: '노랑', value: '#f1c40f' },
        { key: 'green', name: '초록', value: '#27ae60' },
        { key: 'blue', name: '파랑', value: '#3498db' },
        { key: 'purple', name: '보라', value: '#9b59b6' },
        { key: 'gray', name: '회색', value: '#95a5a6' }
    ];
    
    const colorSelect = document.getElementById('editCompanyColor');
    if (!colorSelect) return;
    
    colorSelect.innerHTML = '<option value="">색상을 선택하세요</option>';
    
    defaultColors.forEach(color => {
        const option = document.createElement('option');
        option.value = color.key;
        option.textContent = color.name;
        colorSelect.appendChild(option);
    });
    
    console.log('🎨 기본 색상 로드 완료:', defaultColors.length, '개');
}

// 대비 색상 계산 (텍스트 가독성을 위해)
function getContrastColor(hexColor) {
    // hex 색상을 RGB로 변환
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // 밝기 계산 (0-255)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // 밝기에 따라 흰색 또는 검은색 반환
    return brightness > 128 ? '#000000' : '#ffffff';
}

// 수정 폼에 현재 정보 채우기
async function populateEditForm(company) {
    // 디버깅을 위해 전체 company 객체 로그
    console.log('🔍 populateEditForm - 전체 업체 정보:', company);
    
    document.getElementById('editCompanyName').value = company.company_name || '';
    document.getElementById('editRegion').value = company.region || '';
    document.getElementById('editAddress').value = company.address || '';
    document.getElementById('editPhone').value = company.phone || '';
    document.getElementById('editContactPerson').value = company.contact_person || '';
    document.getElementById('editMobile').value = company.mobile || '';
    document.getElementById('editEmail').value = company.email || '';
    document.getElementById('editPaymentTerms').value = company.payment_terms || '';
    document.getElementById('editDebtAmount').value = company.debt_amount || '';
    document.getElementById('editBusinessType').value = company.business_type || '';
    document.getElementById('editProducts').value = company.products || '';
    document.getElementById('editUsageItems').value = company.usage_items || '';
    document.getElementById('editNotes').value = getCompanyNotes(company.notes) || '';
    
    // 현재 PDF 파일 표시
    displayCurrentPdfFiles(company.pdf_files);
    
    // 현재 색상 값 확인
    const currentColorCode = company.color_code || 'gray';
    
    console.log('🎨 색상 정보:', {
        color_code: currentColorCode
    });
    
    // 색상 요소 존재 확인
    const colorSelect = document.getElementById('editCompanyColor');
    if (!colorSelect) {
        console.error('❌ editCompanyColor 요소를 찾을 수 없습니다');
        return;
    }
    
    console.log('✅ 색상 드롭다운 요소 찾음:', colorSelect);
    
    // 색상 드롭다운 로드 및 현재 값 설정
    await loadColorOptions();
    
    // setTimeout을 사용해서 DOM이 완전히 업데이트된 후 색상 값 설정
    setTimeout(() => {
        const colorSelectDelay = document.getElementById('editCompanyColor');
        if (!colorSelectDelay) {
            console.error('❌ setTimeout 내에서도 editCompanyColor 요소를 찾을 수 없습니다');
            return;
        }
        
        if (colorSelectDelay && currentColorCode) {
            const availableOptions = Array.from(colorSelectDelay.options).map(o => ({value: o.value, text: o.textContent}));
            
            console.log('🎨 색상 설정 시도:');
            console.log('- 현재 색상 코드:', currentColorCode);
            console.log('- 현재 색상 코드 타입:', typeof currentColorCode);
            console.log('- 드롭다운 옵션 수:', colorSelectDelay.options.length);
            console.log('- 사용 가능한 옵션들:', availableOptions);
            
            colorSelectDelay.value = currentColorCode;
            console.log('- 설정 시도 후 선택된 값:', colorSelectDelay.value);
            
            // 설정 확인 및 대안 시도
            if (colorSelectDelay.value !== currentColorCode) {
                console.warn('⚠️ 직접 설정 실패, 옵션 순회 시도');
                console.log('- 찾고 있는 값:', currentColorCode);
                console.log('- 찾고 있는 값 (소문자):', currentColorCode.toLowerCase());
                
                let found = false;
                // 모든 옵션을 순회하여 일치하는 것 찾기
                for (let i = 0; i < colorSelectDelay.options.length; i++) {
                    const option = colorSelectDelay.options[i];
                    console.log(`- 옵션 ${i}: value="${option.value}", text="${option.textContent}"`);
                    
                    // 여러 방법으로 매칭 시도
                    const optionValue = option.value.toLowerCase().trim();
                    const targetValue = currentColorCode.toLowerCase().trim();
                    const optionText = option.textContent.toLowerCase().trim();
                    
                    if (optionValue === targetValue || 
                        optionText.includes(targetValue) || 
                        (targetValue === 'blue' && (optionText.includes('파랑') || optionValue === 'blue')) ||
                        (targetValue === 'red' && (optionText.includes('빨강') || optionValue === 'red')) ||
                        (targetValue === 'yellow' && (optionText.includes('노랑') || optionValue === 'yellow')) ||
                        (targetValue === 'green' && (optionText.includes('초록') || optionValue === 'green')) ||
                        (targetValue === 'purple' && (optionText.includes('보라') || optionValue === 'purple')) ||
                        (targetValue === 'orange' && (optionText.includes('주황') || optionValue === 'orange')) ||
                        (targetValue === 'gray' && (optionText.includes('회색') || optionValue === 'gray'))) {
                        
                        colorSelectDelay.selectedIndex = i;
                        console.log('✅ 옵션 순회로 색상 설정 성공:', option.value, '(', option.textContent, ')');
                        found = true;
                        break;
                    }
                }
                
                // 여전히 설정되지 않았다면 로그
                if (!found) {
                    console.error('❌ 색상 설정 최종 실패:');
                    console.log('- 원본값:', currentColorCode);
                    console.log('- 현재 선택값:', colorSelectDelay.value);
                    console.log('- 선택된 인덱스:', colorSelectDelay.selectedIndex);
                }
            } else {
                console.log('✅ 색상 값 설정 성공:', colorSelectDelay.value);
            }
        }
    }, 200);
}

// 업체 정보 수정 (캐시 무효화 포함)
async function updateCompany() {
    try {
        const formData = new FormData(document.getElementById('editCompanyForm'));
        const updateData = {
            company_name: formData.get('editCompanyName').trim(),
            region: formData.get('editRegion').trim(),
            address: formData.get('editAddress').trim(),
            phone: formData.get('editPhone').trim(),
            contact_person: formData.get('editContactPerson').trim(),
            mobile: formData.get('editMobile').trim(),
            email: formData.get('editEmail').trim(),
            payment_terms: formData.get('editPaymentTerms').trim(),
            debt_amount: formData.get('editDebtAmount').trim(),
            business_type: formData.get('editBusinessType').trim(),
            products: formData.get('editProducts').trim(),
            usage_items: formData.get('editUsageItems').trim(),
            notes: formData.get('editNotes').trim(),
            color_code: formData.get('editCompanyColor') || 'gray'
        };
        
        // PDF 파일 처리
        const pdfFiles = document.getElementById('editPdfFiles').files;
        if (pdfFiles && pdfFiles.length > 0) {
            try {
                updateData.pdf_files = await uploadPdfFiles(pdfFiles);
            } catch (error) {
                console.error('PDF 파일 업로드 실패:', error);
                alert('PDF 파일 업로드에 실패했습니다. 다른 정보만 저장됩니다.');
                // PDF 업로드 실패해도 다른 정보는 저장하도록 처리
            }
        }
        
        if (!updateData.company_name) {
            alert('업체명을 입력해주세요.');
            return;
        }
        
        console.log('💾 업체 정보 안전 수정 시작:', updateData);
        console.log('🔍 updateData 키 목록:', Object.keys(updateData));
        console.log('🎨 color_code 값:', updateData.color_code);
        
        // color 필드가 있으면 color_code로 변경
        if ('color' in updateData) {
            console.warn('⚠️ color 필드 발견! color_code로 변경합니다.');
            updateData.color_code = updateData.color;
            delete updateData.color;
        }

        // 한글 색상을 영어로 변환
        const colorMapping = {
            '빨강': 'red',
            '주황': 'orange', 
            '노랑': 'yellow',
            '초록': 'green',
            '파랑': 'blue',
            '보라': 'purple',
            '회색': 'gray'
        };

        if (updateData.color_code && colorMapping[updateData.color_code]) {
            console.log(`🔄 색상 변환: "${updateData.color_code}" → "${colorMapping[updateData.color_code]}"`);
            updateData.color_code = colorMapping[updateData.color_code];
        }
        
        // 직접 업데이트 실행
        const updateResult = await window.db.updateClientCompany(currentCompany.id, updateData);
        
        if (!updateResult.success) {
            throw new Error('업체 정보 수정에 실패했습니다.');
        }
        
        if (updateResult && updateResult.success) {
            alert('업체 정보가 성공적으로 수정되었습니다.');
            document.getElementById('editModal').style.display = 'none';
            
            console.log('✅ 수정 완료, 캐시 무효화 중...');
            
            // 캐시 무효화 후 업체 정보 다시 로드
            window.cachedDataLoader.invalidateCompanyCache(currentUser.id);
            await loadCompanyDetails(currentCompany.id);
            
            console.log('✅ 업체 정보 재로드 완료, 새로운 색상:', currentCompany?.color_code);
        } else {
            throw new Error('업체 정보 수정에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('❌ 업체 정보 수정 오류:', error);
        alert('업체 정보 수정 중 오류가 발생했습니다: ' + error.message);
    }
}

// 업체 삭제 (캐시 무효화 포함)
async function deleteCompany(companyId) {
    if (!confirm(`'${currentCompany.company_name}' 업체를 정말로 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }
    
    try {
        console.log('업체 삭제 시작:', companyId);
        
        const result = await window.db.deleteClientCompany(companyId);
        
        if (result.success) {
            // 캐시 무효화
            window.cachedDataLoader.invalidateCompanyCache(currentUser.id);
            
            alert('업체가 성공적으로 삭제되었습니다.');
            window.location.href = 'worklog.html';
        } else {
            throw new Error('업체 삭제에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('업체 삭제 오류:', error);
        alert('업체 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// 업무일지 목록 로드 (캐시 활용)
async function loadWorkLogs(companyId) {
    try {
        console.log('📋 업무일지 목록 캐시 로드 시작:', companyId);
        
        // 데이터베이스에서 업무일지 로드 (캐시 사용 안함)
        await window.db.init();
        const workLogs = await window.db.getWorkLogsByCompany(companyId, currentUser.id);
        
        displayWorkLogs(workLogs);
        
    } catch (error) {
        console.error('❌ 업무일지 목록 로드 오류:', error);
        
        // 업무일지가 없는 경우 빈 목록 표시
        displayWorkLogs([]);
        
        // 사용자 친화적 에러 처리
        const workLogList = document.getElementById('workLogList');
        if (workLogList) {
            workLogList.innerHTML = `
                <div style="text-align: center; padding: 2rem; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px;">
                    <h4>⚠️ 업무일지를 불러올 수 없습니다</h4>
                    <p style="color: #666; margin: 1rem 0;">네트워크 연결을 확인하고 다시 시도해주세요.</p>
                    <button onclick="loadWorkLogs(${companyId})" class="btn btn-primary">다시 시도</button>
                </div>
            `;
        }
    }
}

// 업무일지 목록 표시
function displayWorkLogs(workLogs) {
    const workLogList = document.getElementById('workLogList');
    
    if (!workLogs || workLogs.length === 0) {
        workLogList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">작성된 업무일지가 없습니다.</p>';
        return;
    }
    
    const workLogHtml = workLogs.map(log => {
        const visitDate = new Date(log.visit_date).toLocaleDateString('ko-KR');
        const createdDate = new Date(log.created_at).toLocaleDateString('ko-KR');
        
        return `
            <div class="work-log-item" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #f9f9f9;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <h4 style="margin: 0; color: #2c3e50;">${log.visit_purpose} - ${visitDate}</h4>
                        ${log.meeting_person ? `<p style="margin: 5px 0; color: #666; font-size: 0.9em;">면담자: ${log.meeting_person}</p>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 0.8em; color: #999;">작성일: ${createdDate}</span>
                        <button onclick="deleteWorkLog(${currentCompany.id}, ${log.id})" class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8em;">삭제</button>
                    </div>
                </div>
                
                <div style="margin-bottom: 10px;">
                    <strong>상담내용:</strong>
                    <p style="margin: 5px 0; line-height: 1.4; white-space: pre-wrap;">${log.discussion_content}</p>
                </div>
                
                ${log.next_action ? `
                    <div style="margin-bottom: 10px;">
                        <strong>향후계획:</strong>
                        <p style="margin: 5px 0; line-height: 1.4; white-space: pre-wrap;">${log.next_action}</p>
                    </div>
                ` : ''}
                
                ${log.follow_up_date ? `
                    <div style="margin-bottom: 10px;">
                        <strong>다음방문예정일:</strong> ${new Date(log.follow_up_date).toLocaleDateString('ko-KR')}
                    </div>
                ` : ''}
                
                ${log.additional_notes ? `
                    <div style="margin-bottom: 10px;">
                        <strong>특이사항:</strong>
                        <p style="margin: 5px 0; line-height: 1.4; white-space: pre-wrap;">${log.additional_notes}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    workLogList.innerHTML = workLogHtml;
}

// 업무일지 삭제 (캐시 무효화 포함)
async function deleteWorkLog(companyId, workLogId) {
    if (!confirm('이 업무일지를 정말로 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        console.log('업무일지 삭제 시작:', companyId, workLogId);
        
        if (!window.db || !window.db.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        const result = await window.db.deleteWorkLog(companyId, workLogId);
        
        if (result.success) {
            // 캐시 무효화
            // 업무일지 캐시 무효화 (미구현)
            console.log('업무일지 삭제 완료');
            
            alert('업무일지가 삭제되었습니다.');
            // 업무일지 목록 다시 로드
            await loadWorkLogs(companyId);
        } else {
            throw new Error('업무일지 삭제에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('업무일지 삭제 오류:', error);
        alert('업무일지 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// 전역 함수로 등록
window.deleteWorkLog = deleteWorkLog;

// 방문횟수 동기화 (캐시 활용)
async function syncVisitCount(companyId) {
    try {
        console.log('🔄 방문횟수 동기화 시작:', companyId);
        
        // 데이터베이스에서 업무일지 가져오기
        await window.db.init();
        const workLogs = await window.db.getWorkLogsByCompany(companyId, currentUser.id);
        
        const actualVisitCount = workLogs.length;
        
        // 최근 방문일 계산
        let lastVisitDate = null;
        if (workLogs.length > 0) {
            const sortedLogs = workLogs.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
            lastVisitDate = sortedLogs[0].visit_date;
        }
        
        // 현재 저장된 방문횟수와 다르면 업데이트
        if (currentCompany.visit_count !== actualVisitCount) {
            console.log(`방문횟수 불일치 발견. 저장값: ${currentCompany.visit_count}, 실제값: ${actualVisitCount}`);
            
            const updateData = {
                visit_count: actualVisitCount,
                last_visit_date: lastVisitDate
            };
            
            // 업데이트 실행
            const updateResult = await window.db.updateClientCompany(companyId, updateData);
            
            if (updateResult && updateResult.success) {
                console.log('✅ 방문횟수 동기화 완료');
                
                // 캐시 무효화
                window.cachedDataLoader.invalidateCompanyCache(currentUser.id);
                
                // 현재 업체 정보 업데이트
                currentCompany.visit_count = actualVisitCount;
                currentCompany.last_visit_date = lastVisitDate;
                // 화면 갱신
                displayCompanyDetails(currentCompany);
            }
        }
        
    } catch (error) {
        console.error('⚠️ 방문횟수 동기화 오류:', error);
        // 에러가 발생해도 페이지는 정상 표시
    }
}