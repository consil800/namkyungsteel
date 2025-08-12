// 업무일지 작성 페이지 JavaScript

let currentUser = null;
let currentCompany = null;
let companyId = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('업무일지 작성 페이지 로드 시작');
    
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
    
    console.log('🔍 work-log-entry.js - 사용자 정보:', {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role
    });

    // URL에서 업체 ID 추출
    const urlParams = new URLSearchParams(window.location.search);
    companyId = urlParams.get('companyId');
    
    if (!companyId) {
        alert('업체 정보가 없습니다.');
        window.location.href = 'worklog.html';
        return;
    }

    console.log('업체 ID:', companyId, '사용자:', currentUser.name);

    // 업체 정보 로드
    await loadCompanyInfo();
    
    // 방문목적 드롭다운 로드
    await loadVisitPurposes();
    
    // 오늘 날짜를 기본값으로 설정
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('visitDate').value = today;

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

// 업체 정보 로드
async function loadCompanyInfo() {
    try {
        console.log('업체 정보 로드 시작, ID:', companyId);
        
        if (!window.db || !window.db.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        // 업체 정보 가져오기
        const companies = await window.db.getClientCompanies(currentUser.id);
        currentCompany = companies.find(c => c.id == companyId);
        
        if (!currentCompany) {
            throw new Error('업체를 찾을 수 없습니다.');
        }
        
        console.log('업체 정보 로드됨:', currentCompany);
        
        // 업체 정보 표시
        displayCompanyInfo(currentCompany);
        
        // 페이지 제목 업데이트
        document.getElementById('workLogTitle').textContent = `${currentCompany.company_name} - 업무일지 작성`;
        
    } catch (error) {
        console.error('업체 정보 로드 오류:', error);
        alert('업체 정보를 불러오는데 실패했습니다: ' + error.message);
        window.location.href = 'worklog.html';
    }
}

// 업체 정보 표시
function displayCompanyInfo(company) {
    const companyInfoSection = document.getElementById('companyInfo');
    companyInfoSection.innerHTML = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #007bff;">
            <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${company.company_name}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.9em; color: #666;">
                <div><strong>지역:</strong> ${company.region || '-'}</div>
                <div><strong>담당자:</strong> ${company.contact_person || '-'}</div>
                <div><strong>전화번호:</strong> ${company.phone || '-'}</div>
                <div><strong>업종:</strong> ${company.business_type || '-'}</div>
            </div>
        </div>
    `;
}

// 방문목적 드롭다운 로드
async function loadVisitPurposes() {
    console.log('방문목적 옵션 로드 시작');
    
    try {
        // 데이터베이스 기반 로드를 위해 DropdownLoader 사용
        if (!window.DropdownLoader) {
            console.error('DropdownLoader가 로드되지 않았습니다.');
            loadBasicVisitPurposes();
            return;
        }

        const visitPurposeSelect = document.getElementById('visitPurpose');
        if (visitPurposeSelect) {
            await DropdownLoader.loadVisitPurposesOnly(visitPurposeSelect);
        }

        console.log('방문목적 옵션 로드 완료');

    } catch (error) {
        console.error('방문목적 옵션 로드 오류:', error);
        loadBasicVisitPurposes();
    }
}

// 빈 방문목적 로드 (오류 시 백업)
function loadBasicVisitPurposes() {
    console.log('빈 방문목적 로드 - 사용자가 설정 페이지에서 항목을 추가해야 합니다.');
    const visitPurposeSelect = document.getElementById('visitPurpose');
    if (visitPurposeSelect) {
        const customOption = document.createElement('option');
        customOption.value = '__custom__';
        customOption.textContent = '── 직접입력 ──';
        customOption.style.fontStyle = 'italic';
        visitPurposeSelect.appendChild(customOption);
    }
}

// 이벤트 리스너 초기화
function initEventListeners() {
    const form = document.getElementById('workLogForm');
    const backToCompanyBtn = document.getElementById('backToCompanyBtn');
    const cancelBtn = document.getElementById('cancelWorkLogBtn');

    // 폼 제출 이벤트
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('업무일지 폼 제출 시작');
        
        const formData = new FormData(form);
        const workLogData = {
            company_id: parseInt(companyId),
            user_id: currentUser.id,
            visit_date: formData.get('visitDate').trim(),
            visit_purpose: formData.get('visitPurpose').trim(),
            meeting_person: formData.get('meetingPerson').trim(),
            discussion_content: formData.get('discussionContent').trim(),
            next_action: formData.get('nextAction').trim(),
            follow_up_date: formData.get('followUpDate').trim() || null,
            additional_notes: formData.get('additionalNotes').trim(),
            company_domain: currentUser.company_domain || 'namkyungsteel.com'
        };

        console.log('업무일지 데이터:', workLogData);

        // 필수 필드 검증
        if (!workLogData.visit_date) {
            alert('방문일자를 입력해주세요.');
            document.getElementById('visitDate').focus();
            return;
        }

        if (!workLogData.visit_purpose) {
            alert('방문목적을 선택해주세요.');
            document.getElementById('visitPurpose').focus();
            return;
        }

        if (!workLogData.discussion_content) {
            alert('상담내용을 입력해주세요.');
            document.getElementById('discussionContent').focus();
            return;
        }

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = '저장 중...';

            console.log('데이터베이스 저장 시작');
            
            // 데이터베이스에 저장
            if (window.db && window.db.client) {
                const result = await window.db.createWorkLog(workLogData);
                console.log('저장 결과:', result);
                
                if (result.success) {
                    // 트리거가 자동으로 업체 방문 통계를 업데이트함
                    alert('업무일지가 성공적으로 저장되었습니다.');
                    // 업체 상세 페이지로 돌아가기
                    window.location.href = `company-detail.html?id=${companyId}`;
                } else {
                    throw new Error('업무일지 저장에 실패했습니다.');
                }
            } else {
                throw new Error('데이터베이스 연결이 필요합니다.');
            }

        } catch (error) {
            console.error('업무일지 저장 오류:', error);
            alert('업무일지 저장 중 오류가 발생했습니다: ' + error.message);
        } finally {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = '저장';
        }
    });

    // 업체로 돌아가기 버튼
    if (backToCompanyBtn) {
        backToCompanyBtn.addEventListener('click', function() {
            window.location.href = `company-detail.html?id=${companyId}`;
        });
    }

    // 취소 버튼
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (confirm('작성 중인 내용이 사라집니다. 정말로 취소하시겠습니까?')) {
                window.location.href = `company-detail.html?id=${companyId}`;
            }
        });
    }
}

// 업체 방문 정보 업데이트 (더 이상 필요 없음 - 트리거가 자동 처리)
// async function updateCompanyVisitInfo(companyId, visitDate) {
//     // 트리거가 자동으로 처리하므로 이 함수는 더 이상 필요하지 않음
// }