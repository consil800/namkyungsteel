// 직원 대시보드 JavaScript - 안정화된 데이터 로딩

let currentUser = null;
let retryCount = 0;
const MAX_RETRY_COUNT = 3;

// 데이터베이스 연결 대기 및 재시도
async function waitForDatabase(maxRetries = 50) {
    let retries = 0;
    while (retries < maxRetries) {
        if (window.db && window.db.client) {
            console.log('✅ 데이터베이스 연결 확인됨');
            return true;
        }
        console.log(`⏳ 데이터베이스 대기 중... (${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 200));
        retries++;
    }
    console.error('❌ 데이터베이스 연결 실패');
    return false;
}

// 안전한 데이터 로딩 함수
async function safeLoadData(loadFunction, fallbackValue = null, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`🔄 데이터 로딩 시도 ${i + 1}/${retries}`);
            
            // 데이터베이스 연결 확인
            if (!window.db || !window.db.client) {
                await waitForDatabase(10);
                if (!window.db || !window.db.client) {
                    throw new Error('데이터베이스 연결 실패');
                }
            }

            const result = await loadFunction();
            console.log('✅ 데이터 로딩 성공');
            return result;
            
        } catch (error) {
            console.error(`❌ 데이터 로딩 실패 (${i + 1}/${retries}):`, error);
            
            if (i === retries - 1) {
                console.error('❌ 모든 재시도 실패, 기본값 반환');
                return fallbackValue;
            }
            
            // 재시도 전 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// 사용자 정보 안전 로딩
async function loadUserSafely() {
    return await safeLoadData(async () => {
        // 먼저 세션 스토리지에서 확인
        const sessionUser = sessionStorage.getItem('currentUser');
        if (sessionUser) {
            const user = JSON.parse(sessionUser);
            console.log('📦 세션에서 사용자 정보 로드:', user.name);
            return user;
        }

        // 데이터베이스에서 확인
        if (window.getCurrentUserFromDB) {
            const dbUser = await window.getCurrentUserFromDB();
            if (dbUser) {
                console.log('🗄️ 데이터베이스에서 사용자 정보 로드:', dbUser.name);
                // 세션에 저장
                sessionStorage.setItem('currentUser', JSON.stringify(dbUser));
                return dbUser;
            }
        }

        // AuthManager 확인
        if (window.AuthManager && window.AuthManager.getCurrentUser) {
            const authUser = window.AuthManager.getCurrentUser();
            if (authUser) {
                console.log('🔐 AuthManager에서 사용자 정보 로드:', authUser.name);
                return authUser;
            }
        }

        throw new Error('사용자 정보를 찾을 수 없습니다.');
    }, null);
}

// 사용자 통계 안전 로딩
async function loadUserStatisticsSafely(user) {
    const stats = {
        workLogCount: 0,
        documentCount: 0,
        cardUsageCount: 0,
        clientCount: 0
    };

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // 사용자 ID 정규화
    const getUserId = async () => {
        let actualUserId = user.id;
        if (typeof user.id === 'string' && user.id.includes('-')) {
            const userData = await safeLoadData(async () => {
                const { data, error } = await window.db.client
                    .from('users')
                    .select('id')
                    .eq('oauth_id', user.id)
                    .single();
                
                if (error) throw error;
                return data;
            }, null);
            
            if (userData) {
                actualUserId = userData.id;
            }
        }
        return actualUserId.toString();
    };

    const userId = await getUserId();
    console.log('📊 통계 로딩 시작 - 사용자 ID:', userId);

    // 1. 업무일지 카운트
    stats.workLogCount = await safeLoadData(async () => {
        const { data, error } = await window.db.client
            .from('work_logs')
            .select('id')
            .eq('user_id', userId)
            .gte('visit_date', startOfMonth.toISOString().split('T')[0])
            .lte('visit_date', endOfMonth.toISOString().split('T')[0]);
        
        if (error) throw error;
        return data ? data.length : 0;
    }, 0);

    // 2. 서류 카운트
    stats.documentCount = await safeLoadData(async () => {
        const { data, error } = await window.db.client
            .from('document_requests')
            .select('id')
            .eq('requester_id', userId)
            .gte('created_at', startOfMonth.toISOString())
            .lte('created_at', endOfMonth.toISOString());
        
        if (error) throw error;
        return data ? data.length : 0;
    }, 0);

    // 3. 법인카드 사용 카운트
    stats.cardUsageCount = await safeLoadData(async () => {
        const { data, error } = await window.db.client
            .from('corporate_card_usage')
            .select('id')
            .eq('user_id', userId)
            .gte('usage_date', startOfMonth.toISOString().split('T')[0])
            .lte('usage_date', endOfMonth.toISOString().split('T')[0]);
        
        if (error) throw error;
        return data ? data.length : 0;
    }, 0);

    // 4. 거래처 카운트 (전체 기간)
    stats.clientCount = await safeLoadData(async () => {
        const { data, error } = await window.db.client
            .from('client_companies')
            .select('id')
            .eq('user_id', userId);
        
        if (error) throw error;
        return data ? data.length : 0;
    }, 0);

    return stats;
}

// 최근 활동 안전 로딩
async function loadRecentActivitiesSafely(user) {
    const activities = [];
    const currentDate = new Date();
    const oneMonthAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, currentDate.getDate());

    // 사용자 ID 정규화 (통계 로딩과 동일한 로직)
    const getUserId = async () => {
        let actualUserId = user.id;
        if (typeof user.id === 'string' && user.id.includes('-')) {
            const userData = await safeLoadData(async () => {
                const { data, error } = await window.db.client
                    .from('users')
                    .select('id')
                    .eq('oauth_id', user.id)
                    .single();
                
                if (error) throw error;
                return data;
            }, null);
            
            if (userData) {
                actualUserId = userData.id;
            }
        }
        return actualUserId.toString();
    };

    const userId = await getUserId();

    // 업무일지 활동
    const workLogActivities = await safeLoadData(async () => {
        const { data, error } = await window.db.client
            .from('work_logs')
            .select(`
                id,
                visit_date,
                visit_purpose,
                company_id,
                client_companies!inner (
                    company_name
                )
            `)
            .eq('user_id', userId)
            .gte('visit_date', oneMonthAgo.toISOString().split('T')[0])
            .lte('visit_date', currentDate.toISOString().split('T')[0])
            .order('visit_date', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        return data.map(log => ({
            type: 'worklog',
            title: `${log.client_companies.company_name} 방문`,
            description: log.visit_purpose || '업무 방문',
            date: new Date(log.visit_date),
            icon: 'fas fa-clipboard-list'
        }));
    }, []);

    activities.push(...workLogActivities);

    // 서류 요청 활동
    const documentActivities = await safeLoadData(async () => {
        const { data, error } = await window.db.client
            .from('document_requests')
            .select('id, title, created_at, status')
            .eq('requester_id', userId)
            .gte('created_at', oneMonthAgo.toISOString())
            .lte('created_at', currentDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        return data.map(doc => ({
            type: 'document',
            title: '서류 요청',
            description: doc.title || '서류 처리',
            date: new Date(doc.created_at),
            icon: 'fas fa-file-alt'
        }));
    }, []);

    activities.push(...documentActivities);

    // 날짜순 정렬 및 최대 10개 제한
    return activities
        .sort((a, b) => b.date - a.date)
        .slice(0, 10);
}

// 로딩 상태 관리
function showLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.add('active');
    }
}

function hideLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.remove('active');
    }
}

// 통계 UI 업데이트
function updateStatisticsUI(stats) {
    const elements = {
        workLogCount: document.getElementById('workLogCount'),
        projectCount: document.getElementById('projectCount'),
        cardUsageCount: document.getElementById('cardUsageCount'),
        clientCount: document.getElementById('clientCount')
    };

    if (elements.workLogCount) elements.workLogCount.textContent = stats.workLogCount || 0;
    if (elements.projectCount) elements.projectCount.textContent = stats.documentCount || 0;
    if (elements.cardUsageCount) elements.cardUsageCount.textContent = stats.cardUsageCount || 0;
    if (elements.clientCount) elements.clientCount.textContent = stats.clientCount || 0;

    console.log('📊 통계 UI 업데이트 완료:', stats);
}

// 활동 UI 업데이트
function updateActivitiesUI(activities) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    if (activities.length === 0) {
        activityList.innerHTML = `
            <div class="activity-item" style="text-align: center; padding: 2rem; color: #666;">
                <i class="fas fa-info-circle" style="margin-right: 0.5rem;"></i>
                최근 활동이 없습니다.
            </div>
        `;
        return;
    }

    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-details">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-description">${activity.description}</div>
                <div class="activity-time">${formatActivityDate(activity.date)}</div>
            </div>
        </div>
    `).join('');

    console.log('📋 활동 UI 업데이트 완료:', activities.length, '개');
}

// 날짜 포맷팅
function formatActivityDate(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '오늘';
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    return `${Math.floor(days / 30)}개월 전`;
}

// 사용자 정보 UI 업데이트
function updateUserUI(user) {
    // 환영 메시지
    const welcomeElement = document.getElementById('userName');
    const infoElement = document.getElementById('userInfo');
    
    if (welcomeElement) {
        welcomeElement.textContent = user.name || '사용자';
    }

    if (infoElement) {
        let infoText = '';
        if (!user.role) {
            infoText = '⏳ 계정 승인 대기 중입니다.';
        } else {
            switch(user.role) {
                case 'master':
                    infoText = '마스터 관리자로 로그인하셨습니다.';
                    break;
                case 'company_admin':
                    infoText = user.position && user.company ? 
                        `${user.position} · ${user.company}` : '회사 관리자';
                    break;
                case 'employee':
                    if (user.department && user.position) {
                        infoText = `${user.department} ${user.position}`;
                    } else if (user.department) {
                        infoText = user.department;
                    } else if (user.position) {
                        infoText = user.position;
                    }
                    break;
                default:
                    infoText = user.role;
            }
        }
        infoElement.textContent = infoText;
    }

    console.log('👤 사용자 UI 업데이트 완료:', user.name, user.role);
}

// 에러 표시
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff6b6b;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
        z-index: 1000;
        font-weight: 500;
    `;
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
        ${message}
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// 메인 초기화 함수
async function initializeDashboard() {
    console.log('🚀 대시보드 초기화 시작');
    showLoading();

    try {
        // 1. 데이터베이스 연결 대기
        const dbConnected = await waitForDatabase();
        if (!dbConnected) {
            throw new Error('데이터베이스 연결에 실패했습니다.');
        }

        // 2. 사용자 정보 로드
        currentUser = await loadUserSafely();
        if (!currentUser) {
            throw new Error('사용자 정보를 찾을 수 없습니다.');
        }

        console.log('✅ 사용자 로드 완료:', currentUser.name);

        // 3. 사용자 UI 업데이트
        updateUserUI(currentUser);

        // 4. 통계 데이터 로드 (병렬 처리)
        const [stats, activities] = await Promise.all([
            loadUserStatisticsSafely(currentUser),
            loadRecentActivitiesSafely(currentUser)
        ]);

        // 5. UI 업데이트
        updateStatisticsUI(stats);
        updateActivitiesUI(activities);

        console.log('✅ 대시보드 초기화 완료');

    } catch (error) {
        console.error('❌ 대시보드 초기화 실패:', error);
        showError(error.message);
        
        // 로그인 페이지로 리디렉션
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
        
    } finally {
        hideLoading();
    }
}

// 버튼 클릭 이벤트 핸들러들

// 1. 프로필 관련 함수들
function showProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.style.display = 'flex';
        // 현재 사용자 정보로 모달 폼 채우기
        if (currentUser) {
            const nameInput = document.getElementById('profileName');
            const emailInput = document.getElementById('profileEmail');
            if (nameInput) nameInput.value = currentUser.name || '';
            if (emailInput) emailInput.value = currentUser.email || '';
        }
    }
}

function hideProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function handleProfileImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showError('파일 크기는 5MB 이하여야 합니다.');
        return;
    }

    // 파일 타입 체크
    if (!file.type.startsWith('image/')) {
        showError('이미지 파일만 업로드 가능합니다.');
        return;
    }

    // 미리보기 표시
    const reader = new FileReader();
    reader.onload = function(e) {
        const profileImg = document.getElementById('profileImageDashboard');
        if (profileImg) {
            profileImg.src = e.target.result;
        }
    };
    reader.readAsDataURL(file);

    console.log('프로필 이미지 업로드:', file.name);
}

// 2. 네비게이션 함수들
function goToHomepage() {
    window.location.href = 'index.html';
}

function goToSettings() {
    window.location.href = 'settings.html';
}

function openApprovalNotifications() {
    // 알림 페이지로 이동 또는 모달 표시
    window.location.href = 'notifications.html';
}

// 3. 메뉴 카드 클릭 함수들
function openWorkLog() {
    console.log('업무일지 메뉴 클릭');
    window.location.href = 'worklog.html';
}

function openCorporateCard() {
    console.log('법인카드 메뉴 클릭');
    window.location.href = 'corporate-card.html';
}

function openDocuments() {
    console.log('결재 서류 메뉴 클릭');
    window.location.href = 'documents.html';
}

function openDocumentApproval() {
    console.log('서류 승인 메뉴 클릭');
    window.location.href = 'document-approval.html';
}

// 4. 로그아웃 처리
async function handleLogout() {
    if (!confirm('정말 로그아웃 하시겠습니까?')) {
        return;
    }

    try {
        // 세션 정리
        sessionStorage.clear();
        localStorage.clear();

        // Supabase 로그아웃 (있는 경우)
        if (window.db && window.db.client && window.db.client.auth) {
            await window.db.client.auth.signOut();
        }

        console.log('로그아웃 완료');
        
        // 로그인 페이지로 이동
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('로그아웃 오류:', error);
        // 오류가 있어도 강제 로그아웃
        window.location.href = 'index.html';
    }
}

// 5. 권한 체크 함수들
function checkMenuPermissions() {
    if (!currentUser) return;

    const menuCards = document.querySelectorAll('.menu-card');
    
    // 역할별 메뉴 표시/숨김 처리
    switch (currentUser.role) {
        case 'master':
            // 마스터는 모든 메뉴 접근 가능
            break;
            
        case 'company_admin':
        case 'company_manager':
            // 관리자는 대부분 메뉴 접근 가능
            break;
            
        case 'employee':
            // 일반 직원은 일부 메뉴만 접근
            const approvalCard = document.getElementById('documentApprovalCard');
            if (approvalCard) {
                approvalCard.style.display = 'none';
            }
            break;
            
        default:
            // 승인되지 않은 사용자는 제한된 메뉴만
            menuCards.forEach(card => {
                if (card.id !== 'workLogCard') {
                    card.style.opacity = '0.5';
                    card.style.pointerEvents = 'none';
                }
            });
    }
}

// 6. 알림 확인 함수들
async function checkNotifications() {
    if (!currentUser) return;

    try {
        let totalCount = 0;

        // 승인 대기 알림 (관리자만)
        if (['master', 'company_admin', 'company_manager'].includes(currentUser.role)) {
            const pendingCount = await safeLoadData(async () => {
                const { data, error } = await window.db.client
                    .from('users')
                    .select('id')
                    .is('role', null)
                    .eq('is_active', true);
                
                if (error) throw error;
                return data ? data.length : 0;
            }, 0);
            
            totalCount += pendingCount;
        }

        // 서류 승인 알림
        if (currentUser.role !== 'employee') {
            const approvalCount = await safeLoadData(async () => {
                const { data, error } = await window.db.client
                    .from('document_requests')
                    .select('id')
                    .eq('status', 'pending');
                
                if (error) throw error;
                return data ? data.length : 0;
            }, 0);
            
            totalCount += approvalCount;
        }

        // 알림 배지 업데이트
        const badge = document.getElementById('approvalNotificationBadgeHeader');
        if (badge) {
            if (totalCount > 0) {
                badge.textContent = totalCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('알림 확인 오류:', error);
    }
}

// 페이지 로드 시 권한 체크 및 알림 확인 추가
async function initializeDashboardWithPermissions() {
    await initializeDashboard();
    
    if (currentUser) {
        checkMenuPermissions();
        checkNotifications();
        
        // 주기적으로 알림 확인 (5분마다)
        setInterval(checkNotifications, 5 * 60 * 1000);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initializeDashboardWithPermissions);

// 전역에서 접근 가능하도록 export
window.dashboardUtils = {
    initializeDashboard,
    loadUserSafely,
    safeLoadData,
    showError
};

// 전역 함수들을 window에 등록 (HTML onclick에서 사용)
window.showProfileModal = showProfileModal;
window.hideProfileModal = hideProfileModal;
window.handleProfileImageUpload = handleProfileImageUpload;
window.goToHomepage = goToHomepage;
window.goToSettings = goToSettings;
window.openApprovalNotifications = openApprovalNotifications;
window.openWorkLog = openWorkLog;
window.openCorporateCard = openCorporateCard;
window.openDocuments = openDocuments;
window.openDocumentApproval = openDocumentApproval;
window.handleLogout = handleLogout;