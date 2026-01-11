// 직원 대시보드 JavaScript - 안정화된 데이터 로딩

let currentUser = null;
let retryCount = 0;
const MAX_RETRY_COUNT = 3;

// 데이터베이스 연결 대기 및 재시도 (성능 최적화)
async function waitForDatabase(maxRetries = 30) { // 재시도 횟수 감소
    let retries = 0;
    while (retries < maxRetries) {
        if (window.db && window.db.client) {
            console.log('✅ 데이터베이스 연결 확인됨');
            return true;
        }
        // 첫 10회는 짧은 간격, 이후 길어짐
        const delay = retries < 10 ? 100 : 300;
        await new Promise(resolve => setTimeout(resolve, delay));
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

// 사용자 정보 안전 로딩 (데이터베이스 우선)
async function loadUserSafely() {
    return await safeLoadData(async () => {
        // 먼저 세션 스토리지에서 ID 확인
        const sessionUser = sessionStorage.getItem('currentUser');
        let userEmail = null;
        let userId = null;
        
        if (sessionUser) {
            const user = JSON.parse(sessionUser);
            userEmail = user.email;
            userId = user.id;
            console.log('📦 세션에서 사용자 식별정보 확인:', user.name);
        }

        // 데이터베이스에서 최신 정보 확인 (우선순위)
        if (window.db && window.db.client) {
            try {
                let dbUser = null;
                let error = null;

                // 1차: 이메일로 조회
                if (userEmail) {
                    const result = await window.db.client
                        .from('users')
                        .select('*')
                        .eq('email', userEmail)
                        .single();
                    dbUser = result.data;
                    error = result.error;
                }

                // 2차: 이메일 조회 실패 시 ID로 조회
                if (!dbUser && userId) {
                    console.log('🔄 이메일 조회 실패, ID로 재시도:', userId);
                    const result = await window.db.client
                        .from('users')
                        .select('*')
                        .eq('id', userId)
                        .single();
                    dbUser = result.data;
                    error = result.error;
                }

                if (!error && dbUser) {
                    console.log('🗄️ 데이터베이스에서 최신 사용자 정보 로드:', {
                        id: dbUser.id,
                        name: dbUser.name,
                        email: dbUser.email,
                        role: dbUser.role,
                        is_approved: dbUser.is_approved,
                        profile_image: dbUser.profile_image ? 'YES' : 'NO',
                        profile_image_length: dbUser.profile_image ? dbUser.profile_image.length : 0
                    });
                    // 최신 정보를 세션에 저장
                    sessionStorage.setItem('currentUser', JSON.stringify(dbUser));
                    return dbUser;
                } else if (error) {
                    console.error('❌ 데이터베이스 조회 오류:', error);
                }
            } catch (dbError) {
                console.warn('데이터베이스 조회 오류, 세션 정보 사용:', dbError);
            }
        }
        
        // 데이터베이스 조회 실패시 기존 함수 사용
        if (window.getCurrentUserFromDB) {
            const dbUser = await window.getCurrentUserFromDB();
            if (dbUser) {
                console.log('🗄️ getCurrentUserFromDB에서 사용자 정보 로드:', {
                    name: dbUser.name,
                    profile_image: dbUser.profile_image ? 'YES' : 'NO',
                    profileImage: dbUser.profileImage ? 'YES' : 'NO'
                });
                // 세션에 저장
                sessionStorage.setItem('currentUser', JSON.stringify(dbUser));
                return dbUser;
            }
        }
        
        // 최후의 수단으로 세션 정보 사용
        if (sessionUser) {
            const user = JSON.parse(sessionUser);
            console.log('📦 세션에서 사용자 정보 로드 (fallback):', user.name);
            return user;
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

    // 3. 법인카드 사용 카운트 (테이블이 존재하지 않아 비활성화)
    stats.cardUsageCount = 0; // 테이블 미생성으로 인한 임시 비활성화
    
    // 향후 corporate_card_usage 테이블 생성 시 활성화
    /*
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
    */

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
        // is_approved가 false인 경우에만 승인 대기 표시 (role이 없는 것과 별개)
        if (user.is_approved === false) {
            infoText = '⏳ 계정 승인 대기 중입니다.';
        } else if (!user.role) {
            // role이 없지만 승인된 경우 - 역할 미설정 상태
            infoText = '직원';
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

    // 헤더 프로필 이미지 업데이트
    const headerProfileImg = document.getElementById('profileImageDashboard');
    if (headerProfileImg) {
        console.log('📸 헤더 프로필 이미지 업데이트 시작:', {
            profile_image: user.profile_image ? 'YES' : 'NO',
            profileImage: user.profileImage ? 'YES' : 'NO',
            elementFound: true
        });
        
        // 프로필 이미지가 있으면 src 업데이트, 없으면 기본 이미지
        if (user.profile_image || user.profileImage) {
            const imageUrl = user.profile_image || user.profileImage;
            headerProfileImg.src = imageUrl;
            console.log('✅ 헤더 프로필 이미지 URL 업데이트 완료:', imageUrl.substring(0, 50) + '...');
        } else {
            // 기본 프로필 이미지로 복원
            headerProfileImg.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjUiIGN5PSIyNSIgcj0iMjUiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIyNSigeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPu2yqTwvc3ZnPgo8L3N2Zz4=";
            console.log('📸 기본 프로필 이미지로 복원');
        }
    } else {
        console.log('❌ 헤더 프로필 이미지 요소를 찾을 수 없음 (profileImageDashboard)');
        
        // 다시 한번 찾아보기 (다른 방법)
        const profileContainer = document.querySelector('.user-profile-dashboard img');
        if (profileContainer) {
            console.log('✅ 대체 방법으로 프로필 이미지 요소 찾음');
            if (user.profile_image || user.profileImage) {
                const imageUrl = user.profile_image || user.profileImage;
                profileContainer.src = imageUrl;
                console.log('✅ 헤더 프로필 이미지 URL 업데이트 완료 (대체 방법)');
            }
        }
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

// 메인 초기화 함수 (성능 최적화된 버전)
async function initializeDashboard() {
    console.log('🚀 대시보드 초기화 시작');
    showLoading();

    try {
        // 1. 데이터베이스 연결 대기
        const dbConnected = await waitForDatabase();
        if (!dbConnected) {
            throw new Error('데이터베이스 연결에 실패했습니다.');
        }
        
        // 테이블 구조 확인 (디버깅용)
        try {
            console.log('🔍 users 테이블 구조 확인 중...');
            const { data: tableInfo, error: tableError } = await window.db.client
                .from('users')
                .select('*')
                .limit(1);
                
            if (!tableError && tableInfo && tableInfo.length > 0) {
                const columns = Object.keys(tableInfo[0]);
                console.log('📋 users 테이블 컬럼 목록:', columns);
                console.log('✅ profile_image 컬럼 존재:', columns.includes('profile_image'));
            }
        } catch (e) {
            console.warn('⚠️ 테이블 구조 확인 실패:', e);
        }

        // 2. 사용자 정보 로드 (빠른 로드를 위해 우선 처리)
        currentUser = await loadUserSafely();
        if (!currentUser) {
            throw new Error('사용자 정보를 찾을 수 없습니다.');
        }

        console.log('✅ 사용자 로드 완료:', currentUser.name);

        // 3. 사용자 UI 즉시 업데이트 (사용자 경험 개선)
        updateUserUI(currentUser);
        
        // 프로필 이미지가 있는지 한번 더 확인하고 업데이트
        setTimeout(() => {
            console.log('🔄 프로필 이미지 재확인...', {
                hasProfileImage: !!currentUser.profile_image,
                hasProfileImageField: !!currentUser.profileImage,
                userId: currentUser.id,
                userName: currentUser.name
            });
            
            // 모든 가능한 이미지 필드 확인
            const imageUrl = currentUser.profile_image || currentUser.profileImage || null;
            
            if (imageUrl) {
                const profileImg = document.getElementById('profileImageDashboard');
                console.log('🔍 헤더 프로필 이미지 요소:', {
                    found: !!profileImg,
                    currentSrc: profileImg?.src?.substring(0, 50)
                });
                
                if (profileImg) {
                    profileImg.src = imageUrl;
                    console.log('✅ 프로필 이미지 재설정 완료');
                    
                    // 이미지 로드 에러 핸들링
                    profileImg.onerror = function() {
                        console.error('❌ 프로필 이미지 로드 실패');
                        this.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjUiIGN5PSIyNSIgcj0iMjUiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIyNSIgeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPu2yqTwvc3ZnPgo8L3N2Zz4=";
                    };
                } else {
                    console.error('❌ profileImageDashboard 요소를 찾을 수 없음');
                }
            } else {
                console.log('⚠️ 프로필 이미지 URL이 없음');
            }
        }, 500);
        
        // 4. 중요하지 않은 데이터는 로딩 화면 해제 후 백그라운드에서 로드
        hideLoading(); // 여기서 먼저 로딩 화면 제거
        
        // 5. 비동기로 통계 및 활동 데이터 로드 (사용자는 이미 페이지 사용 가능)
        loadBackgroundData(currentUser);

        console.log('✅ 대시보드 초기화 완료 (빠른 모드)');

    } catch (error) {
        console.error('❌ 대시보드 초기화 실패:', error);
        hideLoading();
        showError(error.message);
        
        // 로그인 페이지로 리디렉션
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }
}

// 백그라운드 데이터 로딩 (사용자 경험을 방해하지 않음)
async function loadBackgroundData(user) {
    try {
        console.log('📊 백그라운드 데이터 로딩 시작');
        
        // 통계 데이터부터 로드 (더 중요함)
        const stats = await loadUserStatisticsSafely(user);
        updateStatisticsUI(stats);
        console.log('✅ 통계 데이터 로드 완료');
        
        // 잠시 대기 후 활동 데이터 로드 (부담 분산)
        setTimeout(async () => {
            try {
                const activities = await loadRecentActivitiesSafely(user);
                updateActivitiesUI(activities);
                console.log('✅ 활동 데이터 로드 완료');
            } catch (error) {
                console.warn('활동 데이터 로드 실패:', error);
                // 활동 데이터 실패해도 계속 진행
            }
        }, 500);
        
    } catch (error) {
        console.warn('백그라운드 데이터 로드 실패:', error);
        // 백그라운드 로딩 실패해도 계속 진행
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
            // 프로필 폼 필드들
            const nameInput = document.getElementById('profileUserName');
            const emailInput = document.getElementById('profileUserEmail');
            const departmentInput = document.getElementById('profileUserDepartment');
            const positionInput = document.getElementById('profileUserPosition');
            const phoneInput = document.getElementById('profileUserPhone');
            const modalImage = document.getElementById('modalProfileImage');
            
            if (nameInput) nameInput.value = currentUser.name || '';
            if (emailInput) emailInput.value = currentUser.email || '';
            if (departmentInput) departmentInput.value = currentUser.department || '';
            if (positionInput) positionInput.value = currentUser.position || '';
            if (phoneInput) phoneInput.value = currentUser.phone || '';
            
            // 프로필 이미지 설정
            if (modalImage) {
                // currentUser에 profile_image가 있으면 사용
                if (currentUser.profile_image) {
                    modalImage.src = currentUser.profile_image;
                    console.log('✅ 모달에 저장된 프로필 이미지 표시');
                } else {
                    // 없으면 현재 헤더 이미지 사용
                    const dashboardImage = document.getElementById('profileImageDashboard');
                    if (dashboardImage) {
                        modalImage.src = dashboardImage.src;
                    }
                }
            }
        }
        
        // 프로필 폼 이벤트 리스너 등록
        initializeProfileForm();
    }
}

function hideProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 이미지 리사이징 함수
function resizeImage(file, maxWidth = 300, maxHeight = 300, quality = 0.8) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // 리사이징 계산
            let { width, height } = img;
            
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // 이미지 그리기
            ctx.drawImage(img, 0, 0, width, height);
            
            // Base64로 변환
            const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(resizedDataUrl);
        };
        
        const reader = new FileReader();
        reader.onload = (e) => img.src = e.target.result;
        reader.readAsDataURL(file);
    });
}

function handleProfileImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showError('파일 크기는 10MB 이하여야 합니다.');
        return;
    }

    // 파일 타입 체크
    if (!file.type.startsWith('image/')) {
        showError('이미지 파일만 업로드 가능합니다.');
        return;
    }

    console.log('📷 프로필 이미지 업로드 시작:', {
        name: file.name,
        size: (file.size / 1024).toFixed(2) + 'KB',
        type: file.type
    });

    // 이미지 리사이징 및 미리보기 표시
    resizeImage(file, 300, 300, 0.8).then((resizedDataUrl) => {
        const resizedSizeKB = (resizedDataUrl.length * 3/4) / 1024;
        console.log('🔧 이미지 리사이징 완료:', resizedSizeKB.toFixed(2) + 'KB');
        
        // 대시보드와 모달 둘 다 업데이트
        const profileImg = document.getElementById('profileImageDashboard');
        const modalImg = document.getElementById('modalProfileImage');
        
        if (profileImg) {
            profileImg.src = resizedDataUrl;
        }
        if (modalImg) {
            modalImg.src = resizedDataUrl;
            console.log('✅ 모달 프로필 이미지 업데이트 완료');
        }
    }).catch((error) => {
        console.error('❌ 이미지 리사이징 실패:', error);
        showError('이미지 처리 중 오류가 발생했습니다.');
    });
}

// 프로필 폼 초기화
function initializeProfileForm() {
    const profileForm = document.getElementById('profileForm');
    const passwordForm = document.getElementById('passwordChangeForm');
    
    // 프로필 저장 폼 이벤트
    if (profileForm) {
        // 기존 이벤트 리스너 제거 후 새로 등록
        profileForm.removeEventListener('submit', handleProfileSubmit);
        profileForm.addEventListener('submit', handleProfileSubmit);
    }
    
    // 비밀번호 변경 폼 이벤트
    if (passwordForm) {
        passwordForm.removeEventListener('submit', handlePasswordChange);
        passwordForm.addEventListener('submit', handlePasswordChange);
    }
}

// 프로필 저장 처리
async function handleProfileSubmit(event) {
    event.preventDefault();
    
    if (!currentUser) {
        showError('사용자 정보가 없습니다.');
        return;
    }
    
    // 폼 데이터 수집
    const formData = {
        name: document.getElementById('profileUserName').value.trim(),
        email: document.getElementById('profileUserEmail').value.trim(),
        department: document.getElementById('profileUserDepartment').value.trim(),
        position: document.getElementById('profileUserPosition').value.trim(),
        phone: document.getElementById('profileUserPhone').value.trim()
    };
    
    // 프로필 이미지 데이터 수집
    let profileImageData = null;
    const modalImg = document.getElementById('modalProfileImage');
    console.log('🔍 모달 이미지 요소 확인:', {
        exists: !!modalImg,
        src: modalImg?.src?.substring(0, 100),
        isDataUrl: modalImg?.src?.startsWith('data:')
    });
    
    if (modalImg && modalImg.src && modalImg.src.startsWith('data:')) {
        profileImageData = modalImg.src;
        console.log('📸 프로필 이미지 데이터 발견:', {
            length: profileImageData.length,
            sizeKB: (profileImageData.length * 3/4 / 1024).toFixed(2),
            preview: profileImageData.substring(0, 50) + '...'
        });
    } else {
        console.log('⚠️ 프로필 이미지 데이터가 없거나 올바르지 않음');
    }
    
    // 유효성 검사
    if (!formData.name) {
        showError('이름을 입력해주세요.');
        return;
    }
    
    if (!formData.email) {
        showError('이메일을 입력해주세요.');
        return;
    }
    
    // 저장 버튼 비활성화 (try 블록 밖으로 이동)
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = '저장 중...';
        
        console.log('프로필 업데이트 시작:', formData);
        
        // 데이터베이스 업데이트 (프로필 이미지 포함)
        const updateResult = await safeLoadData(async () => {
            if (!window.db || !window.db.client) {
                throw new Error('데이터베이스 연결이 필요합니다.');
            }
            
            // Supabase 인증 상태 확인
            const { data: { user }, error: authError } = await window.db.client.auth.getUser();
            console.log('🔐 현재 Supabase 인증 상태:', {
                authenticated: !!user,
                user_id: user?.id,
                user_email: user?.email,
                current_user_id: currentUser.id,
                match: user?.email === currentUser.email
            });
            
            if (!user) {
                console.warn('⚠️ Supabase 인증되지 않은 상태입니다.');
            }
            
            // RLS를 위한 사용자 ID 설정 (있다면)
            try {
                if (window.db.client.rpc && currentUser.id) {
                    await window.db.client.rpc('set_current_user_id', { user_id: currentUser.id.toString() });
                    console.log('🔐 RLS 사용자 ID 설정 완료:', currentUser.id);
                }
            } catch (rlsError) {
                console.warn('⚠️ RLS 설정 실패 (무시하고 계속):', rlsError.message);
            }
            
            const updateData = {
                name: formData.name,
                department: formData.department,
                position: formData.position,
                phone: formData.phone,
                updated_at: new Date().toISOString()
            };
            
            // 프로필 이미지가 있으면 추가
            if (profileImageData) {
                // Base64 데이터 크기 확인
                const imageSizeKB = (profileImageData.length * 3/4) / 1024;
                console.log('📏 프로필 이미지 크기:', imageSizeKB.toFixed(2) + 'KB');
                
                if (imageSizeKB > 1024) { // 1MB 초과시 경고
                    console.warn('⚠️ 프로필 이미지가 큽니다 (1MB 초과). 저장에 실패할 수 있습니다.');
                }
                
                updateData.profile_image = profileImageData;
                console.log('📸 프로필 이미지 데이터베이스 저장 시도');
                console.log('📸 이미지 데이터 시작 부분:', profileImageData.substring(0, 100));
            } else {
                console.log('⚠️ profileImageData가 없음');
            }
            
            console.log('🔧 업데이트 데이터:', {
                ...updateData,
                profile_image: updateData.profile_image ? '[IMAGE_DATA]' : 'none'
            });
            
            const { data, error } = await window.db.client
                .from('users')
                .update(updateData)
                .eq('id', currentUser.id)
                .select('*');
                
            if (error) {
                console.error('❌ 데이터베이스 업데이트 상세 오류:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                    update_data_keys: Object.keys(updateData)
                });
                
                // profile_image 컬럼 관련 오류인지 확인
                if (error.message && error.message.toLowerCase().includes('profile_image')) {
                    console.error('💥 profile_image 컬럼 관련 오류 발생!');
                    console.error('- users 테이블에 profile_image 컬럼이 존재하지 않을 가능성');
                    
                    // profile_image 없이 다시 시도
                    console.log('🔄 profile_image 제외하고 다시 저장 시도...');
                    const updateDataWithoutImage = { ...updateData };
                    delete updateDataWithoutImage.profile_image;
                    
                    const { data: retryData, error: retryError } = await window.db.client
                        .from('users')
                        .update(updateDataWithoutImage)
                        .eq('id', currentUser.id)
                        .select('*');
                        
                    if (retryError) {
                        console.error('❌ profile_image 제외 재시도도 실패:', retryError);
                        throw retryError;
                    } else {
                        console.log('✅ profile_image 제외하고 다른 데이터 저장 성공');
                        showError('프로필 정보는 저장되었으나, 프로필 이미지 저장에 실패했습니다. 관리자에게 문의하세요.');
                        return retryData;
                    }
                }
                
                throw error;
            }
            
            console.log('📊 데이터베이스 업데이트 결과:', data);
            if (data && data[0]) {
                console.log('🔍 저장된 사용자 데이터 상세:', {
                    id: data[0].id,
                    name: data[0].name,
                    email: data[0].email,
                    profile_image_exists: !!data[0].profile_image,
                    profile_image_length: data[0].profile_image ? data[0].profile_image.length : 0,
                    profile_image_starts_with: data[0].profile_image ? data[0].profile_image.substring(0, 30) : 'none'
                });
                
                if (data[0].profile_image) {
                    console.log('✅ 데이터베이스에 프로필 이미지 저장 확인됨');
                    
                    // 즉시 데이터베이스에서 다시 읽어서 확인
                    setTimeout(async () => {
                        try {
                            const { data: verifyData, error: verifyError } = await window.db.client
                                .from('users')
                                .select('profile_image')
                                .eq('id', currentUser.id)
                                .single();
                                
                            if (verifyError) {
                                console.error('❌ 저장 확인 조회 실패:', verifyError);
                            } else {
                                console.log('🔍 저장 확인 결과:', {
                                    profile_image_exists: !!verifyData.profile_image,
                                    matches_saved: verifyData.profile_image === data[0].profile_image
                                });
                            }
                        } catch (e) {
                            console.error('❌ 저장 확인 오류:', e);
                        }
                    }, 1000);
                } else {
                    console.log('❌ 데이터베이스에 프로필 이미지가 저장되지 않음');
                }
            } else {
                console.log('❌ 데이터베이스 업데이트 결과가 없음');
            }
            
            return data;
        }, null, 2);
        
        // 현재 사용자 정보 업데이트 (반환된 데이터베이스 데이터 우선)
        if (updateResult && updateResult[0]) {
            currentUser = updateResult[0];
            console.log('✅ 데이터베이스에서 반환된 최신 사용자 정보로 업데이트');
        } else {
            // 반환 데이터가 없으면 로컬 업데이트
            currentUser = {
                ...currentUser,
                ...formData
            };
            
            // 프로필 이미지도 currentUser에 추가
            if (profileImageData) {
                currentUser.profile_image = profileImageData;
                console.log('📸 currentUser에 프로필 이미지 저장됨');
            }
        }
        
        // 세션 스토리지 업데이트
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // UI 업데이트
        updateUserUI(currentUser);
        
        // 헤더 프로필 이미지 강제 업데이트
        if (profileImageData) {
            const headerImg = document.getElementById('profileImageDashboard');
            if (headerImg) {
                headerImg.src = profileImageData;
                console.log('✅ 헤더 프로필 이미지 강제 업데이트');
            }
        }
        
        console.log('✅ 프로필 업데이트 성공');
        
        // 성공 메시지 표시
        showSuccessMessage('프로필이 성공적으로 저장되었습니다.');
        
        // 모달 닫기
        setTimeout(() => {
            hideProfileModal();
        }, 1500);
        
    } catch (error) {
        console.error('❌ 프로필 저장 오류:', error);
        showError('프로필 저장 중 오류가 발생했습니다: ' + error.message);
        
    } finally {
        // 저장 버튼 복구
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

// 비밀번호 변경 처리
async function handlePasswordChange(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // 유효성 검사
    if (!currentPassword || !newPassword || !confirmPassword) {
        showError('모든 비밀번호 필드를 입력해주세요.');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showError('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
        return;
    }
    
    if (newPassword.length < 6) {
        showError('새 비밀번호는 6자 이상이어야 합니다.');
        return;
    }
    
    try {
        // Supabase 인증을 통한 비밀번호 변경
        const { error } = await window.db.client.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        showSuccessMessage('비밀번호가 성공적으로 변경되었습니다.');
        
        // 폼 초기화
        event.target.reset();
        
    } catch (error) {
        console.error('비밀번호 변경 오류:', error);
        showError('비밀번호 변경 중 오류가 발생했습니다.');
    }
}

// 성공 메시지 표시
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        z-index: 1000;
        font-weight: 500;
    `;
    successDiv.innerHTML = `
        <i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i>
        ${message}
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
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

function openScheduleGenerator() {
    console.log('스케줄 생성 메뉴 클릭');
    window.location.href = 'schedule-generator.html';
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
    const notificationBtn = document.getElementById('approvalNotificationBtn');
    const adminDashboardBtn = document.getElementById('adminDashboardBtn');

    // 역할별 메뉴 표시/숨김 처리
    switch (currentUser.role) {
        case 'master':
            // 마스터는 모든 메뉴 접근 가능
            if (adminDashboardBtn) adminDashboardBtn.style.display = '';
            break;

        case 'company_admin':
        case 'company_manager':
            // 관리자는 대부분 메뉴 접근 가능
            if (adminDashboardBtn) adminDashboardBtn.style.display = '';
            break;
            
        case 'employee':
            // 일반 직원은 일부 메뉴만 접근
            const approvalCard = document.getElementById('documentApprovalCard');
            if (approvalCard) {
                approvalCard.style.display = 'none';
            }
            
            // 알림 버튼 숨김 (일반 직원은 승인 권한이 없음)
            if (notificationBtn) {
                notificationBtn.style.display = 'none';
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
            
            // 알림 버튼도 숨김
            if (notificationBtn) {
                notificationBtn.style.display = 'none';
            }
    }
    
    console.log('✅ 권한별 UI 설정 완료:', {
        role: currentUser.role,
        notificationVisible: currentUser.role !== 'employee'
    });
}

// 6. 알림 확인 함수들 (성능 최적화 및 안전성 강화)
async function checkNotifications() {
    if (!currentUser) return;

    try {
        let totalCount = 0;

        // 승인 대기 알림 (관리자만)
        if (['master', 'company_admin', 'company_manager'].includes(currentUser.role)) {
            const pendingCount = await safeLoadData(async () => {
                const { data, error } = await window.db.client
                    .from('users')
                    .select('id', { count: 'exact' }) // count만 필요한 경우 최적화
                    .is('role', null)
                    .eq('is_active', true);
                
                if (error) throw error;
                return data ? data.length : 0;
            }, 0, 1); // 재시도 1회로 제한
            
            totalCount += pendingCount;
        }

        // 서류 승인 알림 (document_requests 테이블 존재 여부 확인)
        if (currentUser.role !== 'employee') {
            const approvalCount = await safeLoadData(async () => {
                // 테이블 존재 여부 먼저 확인
                const { data, error } = await window.db.client
                    .from('document_requests')
                    .select('id', { count: 'exact' })
                    .eq('status', 'pending')
                    .limit(1); // 개수만 필요하므로 제한
                
                if (error) {
                    // 404 오류인 경우 테이블이 없으므로 0 반환
                    if (error.code === 'PGRST106' || error.message?.includes('404')) {
                        console.warn('⚠️ document_requests 테이블이 없습니다. SQL 스크립트를 실행하세요.');
                        return 0;
                    }
                    throw error;
                }
                return data ? data.length : 0;
            }, 0, 1); // 재시도 1회로 제한
            
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

        console.log('🔔 알림 확인 완료:', { totalCount, userRole: currentUser.role });

    } catch (error) {
        console.error('알림 확인 오류:', error);
        // 알림 확인 실패 시 배지 숨김
        const badge = document.getElementById('approvalNotificationBadgeHeader');
        if (badge) {
            badge.style.display = 'none';
        }
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

// RLS 정책 확인 함수
async function checkRLSPolicies() {
    try {
        console.log('🔍 RLS 정책 확인 중...');
        
        // 현재 사용자가 자신의 데이터를 읽을 수 있는지 확인
        const { data: readTest, error: readError } = await window.db.client
            .from('users')
            .select('id, name')
            .eq('id', currentUser.id)
            .single();
            
        console.log('📖 읽기 권한:', readError ? '❌ 실패' : '✅ 성공');
        if (readError) console.error('읽기 오류:', readError);
        
        // 업데이트 권한 확인 (name만 변경)
        const { data: updateTest, error: updateError } = await window.db.client
            .from('users')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', currentUser.id)
            .select('id');
            
        console.log('✏️ 업데이트 권한:', updateError ? '❌ 실패' : '✅ 성공');
        if (updateError) console.error('업데이트 오류:', updateError);
        
    } catch (error) {
        console.error('RLS 정책 확인 실패:', error);
    }
}

// 프로필 이미지 테스트 함수 (디버깅용)
async function testProfileImageSave() {
    if (!currentUser) {
        console.error('❌ 로그인된 사용자가 없습니다.');
        return;
    }
    
    console.log('🧪 프로필 이미지 저장 테스트 시작...');
    console.log('👤 현재 사용자:', { id: currentUser.id, name: currentUser.name });
    
    // 먼저 RLS 정책 확인
    await checkRLSPolicies();
    
    try {
        // 1. 작은 테스트 이미지 생성 (1x1 빨간 픽셀)
        const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        
        console.log('🔐 인증 상태 확인...');
        const { data: { user: authUser } } = await window.db.client.auth.getUser();
        console.log('🔐 인증된 사용자:', authUser?.email);
        
        // 2. 데이터베이스에 저장
        console.log('💾 프로필 이미지 저장 시도...');
        const { data: saveData, error: saveError } = await window.db.client
            .from('users')
            .update({ 
                profile_image: testImage,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id)
            .select('id, name, profile_image');
            
        if (saveError) {
            console.error('❌ 저장 실패:', {
                message: saveError.message,
                details: saveError.details,
                hint: saveError.hint,
                code: saveError.code
            });
            return;
        }
        
        console.log('✅ 저장 성공:', saveData);
        
        // 3. 데이터베이스에서 다시 읽기
        console.log('📖 저장된 데이터 다시 읽기...');
        const { data: readData, error: readError } = await window.db.client
            .from('users')
            .select('id, name, profile_image')
            .eq('id', currentUser.id)
            .single();
            
        if (readError) {
            console.error('❌ 읽기 실패:', readError);
            return;
        }
        
        console.log('✅ 읽기 성공:', {
            id: readData.id,
            name: readData.name,
            hasImage: !!readData.profile_image,
            imageLength: readData.profile_image ? readData.profile_image.length : 0,
            imageMatches: readData.profile_image === testImage
        });
        
        // 4. 현재 사용자 객체 업데이트
        currentUser.profile_image = testImage;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserUI(currentUser);
        console.log('✅ UI 업데이트 완료');
        
    } catch (error) {
        console.error('❌ 테스트 실패:', error);
    }
}

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
// 헤더 프로필 이미지 강제 업데이트 함수
function forceUpdateHeaderProfileImage() {
    console.log('🔧 헤더 프로필 이미지 강제 업데이트 시작...');
    
    if (!currentUser) {
        console.error('❌ 현재 사용자 정보가 없습니다.');
        return;
    }
    
    const imageUrl = currentUser.profile_image || currentUser.profileImage;
    if (!imageUrl) {
        console.error('❌ 프로필 이미지 URL이 없습니다.');
        return;
    }
    
    const profileImg = document.getElementById('profileImageDashboard');
    if (profileImg) {
        profileImg.src = imageUrl;
        console.log('✅ 헤더 프로필 이미지 강제 업데이트 완료');
        console.log('📸 이미지 URL:', imageUrl.substring(0, 100) + '...');
    } else {
        console.error('❌ profileImageDashboard 요소를 찾을 수 없습니다.');
    }
}

// 데이터베이스에서 최신 프로필 이미지 다시 로드
async function reloadProfileImage() {
    console.log('🔄 데이터베이스에서 최신 프로필 이미지 다시 로드...');
    
    if (!currentUser || !currentUser.id) {
        console.error('❌ 사용자 정보가 없습니다.');
        return;
    }
    
    try {
        const { data, error } = await window.db.client
            .from('users')
            .select('profile_image')
            .eq('id', currentUser.id)
            .single();
            
        if (error) {
            console.error('❌ 프로필 이미지 로드 실패:', error);
            return;
        }
        
        if (data && data.profile_image) {
            console.log('✅ 프로필 이미지 로드 성공');
            
            // currentUser 업데이트
            currentUser.profile_image = data.profile_image;
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // 헤더 이미지 업데이트
            const profileImg = document.getElementById('profileImageDashboard');
            if (profileImg) {
                profileImg.src = data.profile_image;
                console.log('✅ 헤더 프로필 이미지 업데이트 완료');
            }
            
            // 모달 이미지도 업데이트
            const modalImg = document.getElementById('modalProfileImage');
            if (modalImg) {
                modalImg.src = data.profile_image;
                console.log('✅ 모달 프로필 이미지 업데이트 완료');
            }
        } else {
            console.log('⚠️ 프로필 이미지가 없습니다.');
        }
    } catch (error) {
        console.error('❌ 프로필 이미지 로드 중 오류:', error);
    }
}

window.handleLogout = handleLogout;
window.testProfileImageSave = testProfileImageSave;
window.checkRLSPolicies = checkRLSPolicies;
window.forceUpdateHeaderProfileImage = forceUpdateHeaderProfileImage;
window.reloadProfileImage = reloadProfileImage;