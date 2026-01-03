// 업체 상세 페이지 JavaScript

let currentCompany = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('업체 상세 페이지 로드 시작');
    
    // 데이터베이스 초기화 대기
    await waitForDatabase();
    
    // 로그인 확인
    currentUser = AuthManager.getCurrentUser();
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        window.location.href = 'login.html';
        return;
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

// 업체 상세 정보 로드
async function loadCompanyDetails(companyId) {
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
        displayCompanyDetails(currentCompany);
        
        // 업무일지 목록 로드 및 방문횟수 동기화
        await loadWorkLogs(companyId);
        await syncVisitCount(companyId);
        
    } catch (error) {
        console.error('업체 정보 로드 오류:', error);
        alert('업체 정보를 불러오는데 실패했습니다: ' + error.message);
        window.location.href = 'worklog.html';
    }
}

// 업체 정보 표시
function displayCompanyDetails(company) {
    // 제목 설정
    document.getElementById('companyTitle').textContent = company.company_name + ' - 상세정보';
    
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
            <label>등록일:</label>
            <span>${new Date(company.created_at).toLocaleDateString() || '-'}</span>
        </div>
    `;
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
    document.getElementById('editCompanyBtn').addEventListener('click', function() {
        if (currentCompany) {
            populateEditForm(currentCompany);
            document.getElementById('editModal').style.display = 'block';
        }
    });
    
    // 업체 삭제 버튼
    document.getElementById('deleteCompanyBtn').addEventListener('click', function() {
        if (currentCompany) {
            deleteCompany(currentCompany.id);
        }
    });
    
    // 모달 닫기
    document.getElementById('closeModal').addEventListener('click', function() {
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

// 수정 폼에 현재 정보 채우기
function populateEditForm(company) {
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
    document.getElementById('editNotes').value = company.notes || '';
}

// 업체 정보 수정
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
            notes: formData.get('editNotes').trim()
        };
        
        if (!updateData.company_name) {
            alert('업체명을 입력해주세요.');
            return;
        }
        
        console.log('업체 정보 수정 시작:', updateData);
        
        const result = await window.db.updateClientCompany(currentCompany.id, updateData);
        
        if (result.success) {
            alert('업체 정보가 성공적으로 수정되었습니다.');
            document.getElementById('editModal').style.display = 'none';
            
            // 업체 정보 다시 로드
            await loadCompanyDetails(currentCompany.id);
        } else {
            throw new Error('업체 정보 수정에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('업체 정보 수정 오류:', error);
        alert('업체 정보 수정 중 오류가 발생했습니다: ' + error.message);
    }
}

// 업체 삭제
async function deleteCompany(companyId) {
    if (!confirm(`'${currentCompany.company_name}' 업체를 정말로 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }
    
    try {
        console.log('업체 삭제 시작:', companyId);
        
        const result = await window.db.deleteClientCompany(companyId);
        
        if (result.success) {
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

// 업무일지 목록 로드
async function loadWorkLogs(companyId) {
    try {
        console.log('업무일지 목록 로드 시작:', companyId);
        
        if (!window.db || !window.db.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        // 해당 업체의 업무일지 가져오기 (현재 사용자만)
        const workLogs = await window.db.getWorkLogsByCompany(companyId, currentUser.id);
        console.log('업무일지 목록:', workLogs);
        
        displayWorkLogs(workLogs);
        
    } catch (error) {
        console.error('업무일지 목록 로드 오류:', error);
        // 에러가 발생해도 페이지는 표시되도록 함
        const workLogList = document.getElementById('workLogList');
        if (workLogList) {
            workLogList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">업무일지를 불러올 수 없습니다.</p>';
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

// 업무일지 삭제
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

// 방문횟수 동기화 (업무일지 개수와 일치시키기)
async function syncVisitCount(companyId) {
    try {
        console.log('방문횟수 동기화 시작:', companyId);
        
        if (!window.db || !window.db.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        // 현재 업무일지 개수 가져오기
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
            
            const result = await window.db.updateClientCompany(companyId, updateData);
            
            if (result.success) {
                console.log('방문횟수 동기화 완료');
                // 현재 업체 정보 업데이트
                currentCompany.visit_count = actualVisitCount;
                currentCompany.last_visit_date = lastVisitDate;
                // 화면 갱신
                displayCompanyDetails(currentCompany);
            }
        }
        
    } catch (error) {
        console.error('방문횟수 동기화 오류:', error);
        // 에러가 발생해도 페이지는 정상 표시
    }
}