// 권한 관리 시스템
const AuthManager = {
    // 사용자 역할 정의
    ROLES: {
        MASTER: 'master',
        COMPANY_CEO: 'company_CEO',
        COMPANY_MANAGER: 'company_manager',
        EMPLOYEE: 'employee'
    },

    // 권한 정의
    PERMISSIONS: {
        // 마스터 권한
        MANAGE_ALL_COMPANIES: 'manage_all_companies',
        MANAGE_ALL_USERS: 'manage_all_users',
        SYSTEM_SETTINGS: 'system_settings',
        
        // 회사 관련 권한
        MANAGE_COMPANY_HOMEPAGE: 'manage_company_homepage',
        MANAGE_COMPANY_EMPLOYEES: 'manage_company_employees',
        MANAGE_EMPLOYEE_SYSTEMS: 'manage_employee_systems',
        MANAGE_COMPANY_CEO: 'manage_company_CEO', // CEO 관리 권한 (CEO만 가능)
        VIEW_COMPANY_ANALYTICS: 'view_company_analytics',
        MANAGE_COMPANY_DATA: 'manage_company_data',
        MANAGE_EMPLOYEE_ROLES: 'manage_employee_roles',
        MANAGE_COMPANY_SETTINGS: 'manage_company_settings',
        MANAGE_COMPANY_BILLING: 'manage_company_billing',
        
        // 직원 권한
        ACCESS_EMPLOYEE_DASHBOARD: 'access_employee_dashboard',
        CREATE_WORK_LOG: 'create_work_log',
        ACCESS_SALES_SYSTEM: 'access_sales_system',
        VIEW_TEAM_DATA: 'view_team_data'
    },

    // 역할별 권한 매핑
    ROLE_PERMISSIONS: {
        master: [
            // 마스터 - 모든 권한 (시스템 전체 관리)
            'manage_all_companies',
            'manage_all_users',
            'system_settings',
            'manage_company_homepage',
            'manage_company_employees',
            'manage_employee_systems',
            'manage_company_CEO',
            'view_company_analytics',
            'manage_company_data',
            'manage_employee_roles',
            'manage_company_settings',
            'manage_company_billing',
            'access_employee_dashboard',
            'create_work_log',
            'access_sales_system',
            'view_team_data'
        ],
        company_CEO: [
            // 회사 CEO - 회사내 모든 권한 (회사당 1명)
            'manage_company_homepage',
            'manage_company_employees',
            'manage_employee_systems',
            'manage_company_CEO', // CEO 관리 권한
            'view_company_analytics',
            'manage_company_data',
            'manage_employee_roles',
            'manage_company_settings',
            'manage_company_billing',
            'access_employee_dashboard',
            'create_work_log',
            'access_sales_system',
            'view_team_data'
        ],
        company_manager: [
            // 회사 관리자 - CEO 관리 권한 제외한 모든 권한
            'manage_company_homepage',
            'manage_company_employees',
            'manage_employee_systems',
            'view_company_analytics',
            'manage_company_data',
            'manage_employee_roles',
            'manage_company_settings',
            'access_employee_dashboard',
            'create_work_log',
            'access_sales_system',
            'view_team_data'
        ],
        employee: [
            // 일반 직원 - 회사에서 정해준 기본 권한만
            'access_employee_dashboard',
            'create_work_log',
            'access_sales_system',
            'view_team_data'
        ]
    },

    // 현재 사용자 정보 가져오기
    getCurrentUser() {
        const userJson = sessionStorage.getItem('currentUser');
        if (!userJson) return null;
        
        try {
            return JSON.parse(userJson);
        } catch (e) {
            return null;
        }
    },

    // 로그인
    async login(email, password, role = 'employee') {
        // 데이터베이스에서 사용자 인증
        if (!window.db || !window.db.authenticateUser) {
            return { success: false, message: '데이터베이스 연결이 필요합니다.' };
        }
        
        try {
            console.log('🔐 AuthManager.login 호출:', { email });
            const result = await window.db.authenticateUser(email, password);
            console.log('📥 authenticateUser 결과:', result);
            
            if (result.success && result.user) {
                const user = result.user;
                
                // 도메인별 회사 검증
                if (window.domainCompanyManager) {
                    const isValidCompany = window.domainCompanyManager.validateUserCompany(user);
                    if (!isValidCompany) {
                        console.error('❌ 회사 도메인 불일치');
                        return { success: false, message: '이 도메인에서 접근할 수 없는 계정입니다.' };
                    }
                }
                
                const userWithPermissions = {
                    ...user,
                    is_approved: user.is_approved !== false, // 기본적으로 승인된 것으로 간주 (기존 사용자 호환성)
                    permissions: this.ROLE_PERMISSIONS[user.role] || this.ROLE_PERMISSIONS['employee']
                };
                
                sessionStorage.setItem('currentUser', JSON.stringify(userWithPermissions));
                sessionStorage.setItem('userRole', user.role);
                sessionStorage.setItem('userName', user.name);
                
                console.log('✅ AuthManager 로그인 성공:', userWithPermissions);
                return { success: true, user: userWithPermissions };
            } else {
                console.error('❌ AuthManager 로그인 실패:', result.message);
                return { success: false, message: result.message || '잘못된 이메일 또는 비밀번호입니다.' };
            }
        } catch (error) {
            console.error('❌ AuthManager 인증 오류:', error);
            return { success: false, message: '로그인 중 오류가 발생했습니다.' };
        }
    },

    // 회원가입
    async register(userData) {
        console.log('📝 회원가입 시도:', userData.email);
        
        // 데이터베이스 연결 확인
        if (!window.db || !window.db.createUser) {
            return { success: false, message: '데이터베이스 연결이 필요합니다.' };
        }
        
        try {
            // 도메인별 회사 정보 적용
            let enhancedUserData = userData;
            if (window.domainCompanyManager) {
                enhancedUserData = window.domainCompanyManager.enhanceUserData(userData);
                console.log('🏢 도메인별 회사 정보 적용:', enhancedUserData);
            }
            
            // 이메일 중복 확인
            const existingUsers = await window.db.getUsers();
            const emailExists = existingUsers.some(user => user.email === enhancedUserData.email);
            
            if (emailExists) {
                return { success: false, message: '이미 등록된 이메일입니다.' };
            }
            
            // 사용자 생성
            const result = await window.db.createUser({
                username: enhancedUserData.email,
                email: enhancedUserData.email,
                phone: enhancedUserData.phone || '',
                password: enhancedUserData.password,
                name: enhancedUserData.name,
                role: null, // 가입 시에는 role 없음, 승인 시 설정
                department: enhancedUserData.department || '',
                position: enhancedUserData.position || '',
                company_domain: enhancedUserData.company_domain,
                is_approved: false // 모든 신규 사용자는 승인 대기
            });
            
            if (result.success) {
                console.log('✅ 회원가입 성공:', result.data);
                
                // 관리자들에게 알림 생성
                try {
                    // company_CEO와 company_admin 역할의 사용자들 조회
                    const { data: admins, error: adminError } = await window.db.client
                        .from('users')
                        .select('id')
                        .in('role', ['company_CEO', 'company_admin'])
                        .eq('company_domain', enhancedUserData.company_domain || 'namkyungsteel.com')
                        .eq('is_active', true);
                    
                    if (adminError) {
                        console.error('관리자 조회 오류:', adminError);
                    } else if (admins && admins.length > 0) {
                        // 각 관리자에게 알림 생성
                        const notifications = admins.map(admin => ({
                            user_id: admin.id,
                            type: 'user_registration',
                            title: '신규 회원가입 승인 요청',
                            message: `${enhancedUserData.name}님이 회원가입을 신청했습니다. 승인이 필요합니다.`,
                            related_id: result.data.id,
                            company_domain: enhancedUserData.company_domain || 'namkyungsteel.com',
                            is_read: false,
                            created_at: new Date().toISOString()
                        }));
                        
                        const { error: notifError } = await window.db.client
                            .from('notifications')
                            .insert(notifications);
                        
                        if (notifError) {
                            console.error('알림 생성 오류:', notifError);
                        } else {
                            console.log('✅ 관리자 알림 생성 완료:', notifications.length, '개');
                        }
                    }
                } catch (notificationError) {
                    console.error('알림 생성 실패:', notificationError);
                    // 알림 실패해도 회원가입은 성공한 것으로 처리
                }
                
                return { success: true, user: result.data };
            } else {
                return { success: false, message: result.error || '회원가입에 실패했습니다.' };
            }
        } catch (error) {
            console.error('회원가입 오류:', error);
            return { success: false, message: '회원가입 중 오류가 발생했습니다.' };
        }
    },

    // 구글 소셜 로그인
    async googleLogin() {
        console.log('🔐 Google OAuth 로그인 시도');
        
        if (!window.db || !window.db.client) {
            return { success: false, message: '데이터베이스 연결이 필요합니다.' };
        }
        
        try {
            // Supabase Google OAuth 로그인
            const { data, error } = await window.db.client.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: 'https://namkyungsteel.com'
                }
            });
            
            if (error) {
                console.error('❌ Google 로그인 오류:', error);
                return { success: false, message: error.message };
            }
            
            console.log('✅ Google OAuth 시작됨:', data);
            // OAuth는 리다이렉트로 처리되므로 여기서는 성공 반환
            return { success: true, message: 'Google 로그인 페이지로 이동합니다...' };
            
        } catch (error) {
            console.error('❌ Google 로그인 예외:', error);
            return { success: false, message: 'Google 로그인 중 오류가 발생했습니다.' };
        }
    },

    // 카카오 소셜 로그인
    async kakaoLogin() {
        console.log('🔐 Kakao OAuth 로그인 시도');
        
        if (!window.db || !window.db.client) {
            return { success: false, message: '데이터베이스 연결이 필요합니다.' };
        }
        
        try {
            // Supabase Kakao OAuth 로그인 (기본 scope만 사용)
            const { data, error } = await window.db.client.auth.signInWithOAuth({
                provider: 'kakao',
                options: {
                    redirectTo: 'https://namkyungsteel.com'
                    // scopes 옵션 완전 제거 - Supabase 기본 설정 사용
                }
            });
            
            if (error) {
                console.error('❌ Kakao 로그인 오류:', error);
                return { success: false, message: error.message };
            }
            
            console.log('✅ Kakao OAuth 시작됨:', data);
            // OAuth는 리다이렉트로 처리되므로 여기서는 성공 반환
            return { success: true, message: 'Kakao 로그인 페이지로 이동합니다...' };
            
        } catch (error) {
            console.error('❌ Kakao 로그인 예외:', error);
            return { success: false, message: 'Kakao 로그인 중 오류가 발생했습니다.' };
        }
    },

    // OAuth 콜백 처리
    async handleOAuthCallback() {
        console.log('🔐 OAuth 콜백 처리 시작');
        
        if (!window.db || !window.db.client) {
            return { success: false, message: '데이터베이스 연결이 필요합니다.' };
        }
        
        try {
            // 현재 세션 확인
            const { data: { session }, error } = await window.db.client.auth.getSession();
            
            if (error) {
                console.error('❌ 세션 확인 오류:', error);
                return { success: false, message: error.message };
            }
            
            if (!session || !session.user) {
                return { success: false, message: '로그인 세션을 찾을 수 없습니다.' };
            }
            
            console.log('✅ OAuth 세션 확인됨:', session.user);
            
            // public.users 테이블에서 사용자 확인/생성
            try {
                const provider = session.user.app_metadata?.provider || 'unknown';
                const userEmail = session.user.email;
                const userId = session.user.id;
                
                // 먼저 기존 사용자 확인
                let existingUser, fetchError;
                
                if (userEmail) {
                    // 이메일이 있는 경우 이메일로 조회
                    const result = await window.db.client
                        .from('users')
                        .select('*')
                        .eq('email', userEmail)
                        .single();
                    existingUser = result.data;
                    fetchError = result.error;
                } else {
                    // 이메일이 없는 경우 (카카오) OAuth ID로 조회
                    const result = await window.db.client
                        .from('users')
                        .select('*')
                        .eq('oauth_id', userId)
                        .single();
                    existingUser = result.data;
                    fetchError = result.error;
                }
                
                let dbUser;
                
                if (fetchError && fetchError.code === 'PGRST116') {
                    // 사용자가 없으므로 생성
                    console.log('📝 public.users에 새 사용자 생성');
                    const userName = session.user.user_metadata?.full_name || 
                                   session.user.user_metadata?.name || 
                                   session.user.user_metadata?.nickname ||
                                   userEmail || 
                                   `kakao_user_${userId.slice(-8)}`;
                    
                    const newUser = {
                        username: userEmail || `kakao_${userId.slice(-8)}`,
                        email: userEmail || null,
                        oauth_id: userId,
                        oauth_provider: provider,
                        name: userName,
                        role: 'employee', // 기본 역할을 employee로 설정
                        company_domain: 'namkyungsteel.com',
                        company_name: '남경스틸(주)',
                        profile_image: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
                        password: 'oauth_user', // OAuth 사용자 표시
                        is_active: true,
                        is_approved: true, // OAuth 사용자는 자동 승인
                        created_at: new Date().toISOString()
                    };
                    
                    const { data: createdUser, error: createError } = await window.db.client
                        .from('users')
                        .insert([newUser])
                        .select()
                        .single();
                    
                    if (createError) {
                        console.error('❌ 사용자 생성 오류:', createError);
                        // 트리거가 이미 생성했을 수 있으므로 다시 조회
                        if (userEmail) {
                            const { data: retriedUser } = await window.db.client
                                .from('users')
                                .select('*')
                                .eq('email', userEmail)
                                .single();
                            dbUser = retriedUser;
                        } else {
                            const { data: retriedUser } = await window.db.client
                                .from('users')
                                .select('*')
                                .eq('oauth_id', userId)
                                .single();
                            dbUser = retriedUser;
                        }
                        
                        if (!dbUser) {
                            // 여전히 사용자가 없다면 기본 정보로 진행
                            console.log('⚠️ 사용자 생성 실패, 기본 정보로 진행');
                            dbUser = {
                                id: userId,
                                email: userEmail,
                                name: userName,
                                role: 'employee',
                                company_domain: 'namkyungsteel.com',
                                company_name: '남경스틸(주)',
                                profile_image: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
                                is_approved: true,
                                is_active: true
                            };
                        }
                    } else {
                        dbUser = createdUser;
                        
                        // 새 사용자 가입 알림 생성
                        const notification = {
                            id: Date.now().toString(),
                            type: 'new_user_signup',
                            title: '새로운 사용자 가입 승인 대기',
                            message: `${userName}님이 ${provider === 'kakao' ? '카카오' : 'Google'} 로그인으로 가입했습니다. 승인이 필요합니다.`,
                            userInfo: {
                                id: dbUser.id.toString(),
                                name: userName,
                                email: userEmail || '이메일 미제공',
                                provider: provider === 'kakao' ? '카카오' : 'Google',
                                signupTime: new Date().toISOString()
                            },
                            isRead: false,
                            createdAt: new Date().toISOString()
                        };
                        
                        // 관리자용 알림 저장
                        const notifications = JSON.parse(sessionStorage.getItem('admin_notifications') || '[]');
                        notifications.unshift(notification);
                        
                        // 최대 50개까지만 보관
                        if (notifications.length > 50) {
                            notifications.splice(50);
                        }
                        
                        sessionStorage.setItem('admin_notifications', JSON.stringify(notifications));
                        console.log('📢 새 사용자 가입 알림 생성:', notification);
                    }
                } else {
                    // 기존 사용자 업데이트
                    console.log('✅ 기존 사용자 발견, 정보 업데이트');
                    const updateData = {
                        last_login_at: new Date().toISOString(),
                        profile_image: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
                        updated_at: new Date().toISOString()
                    };
                    
                    let updatedUser;
                    if (userEmail) {
                        const result = await window.db.client
                            .from('users')
                            .update(updateData)
                            .eq('email', userEmail)
                            .select()
                            .single();
                        updatedUser = result.data;
                    } else {
                        const result = await window.db.client
                            .from('users')
                            .update(updateData)
                            .eq('oauth_id', userId)
                            .select()
                            .single();
                        updatedUser = result.data;
                    }
                    
                    dbUser = updatedUser || existingUser;
                }
                
                // 사용자 정보로 로컬 사용자 객체 생성
                const finalProvider = session.user.app_metadata?.provider || 'unknown';
                const finalUserName = dbUser?.name || 
                                    session.user.user_metadata?.full_name || 
                                    session.user.user_metadata?.name || 
                                    session.user.user_metadata?.nickname ||
                                    userEmail || 
                                    `kakao_user_${userId.slice(-8)}`;
                
                const user = {
                    id: dbUser?.id || session.user.id,
                    email: userEmail || null,
                    oauth_id: userId,
                    name: finalUserName,
                    role: dbUser?.role || 'employee',
                    department: dbUser?.department || '',
                    position: dbUser?.position || '',
                    company_domain: dbUser?.company_domain || 'namkyungsteel.com',
                    company_name: dbUser?.company_name || '남경스틸(주)',
                    profileImage: dbUser?.profile_image || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
                    provider: finalProvider,
                    is_approved: dbUser?.is_approved !== false, // 데이터베이스에서 is_approved가 false가 아니면 승인된 것으로 간주
                    permissions: this.ROLE_PERMISSIONS[dbUser?.role || 'employee']
                };
                
                // 세션 스토리지에 저장
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                sessionStorage.setItem('userRole', user.role);
                sessionStorage.setItem('userName', user.name);
                
                console.log('✅ OAuth 로그인 완료:', user);
                return { success: true, user: user };
                
            } catch (dbError) {
                console.error('❌ 데이터베이스 작업 오류:', dbError);
                // DB 오류가 있어도 기본 정보로 로그인 허용
                const provider = session.user.app_metadata?.provider || 'unknown';
                const user = {
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.full_name || 
                          session.user.user_metadata?.name || 
                          session.user.email,
                    role: 'employee',
                    company_domain: 'namkyungsteel.com',
                    company_name: '남경스틸(주)',
                    profileImage: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
                    provider: provider,
                    is_approved: true,
                    permissions: this.ROLE_PERMISSIONS['employee']
                };
                
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                sessionStorage.setItem('userRole', user.role);
                sessionStorage.setItem('userName', user.name);
                
                return { success: true, user: user };
            }
            
        } catch (error) {
            console.error('❌ OAuth 콜백 처리 오류:', error);
            return { success: false, message: 'OAuth 처리 중 오류가 발생했습니다.' };
        }
    },

    // 로그아웃
    logout() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userName');
        window.location.href = '../../1-homepage/templates/index.html';
    },

    // 권한 확인
    hasPermission(permission) {
        const user = this.getCurrentUser();
        if (!user || !user.permissions) return false;
        
        return user.permissions.includes(permission);
    },

    // 역할 확인
    hasRole(role) {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        return user.role === role;
    },

    // 회사 확인
    belongsToCompany(companyId) {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        // 마스터는 모든 회사 접근 가능
        if (user.role === 'master') return true;
        
        return user.company === companyId;
    },

    // 페이지 접근 권한 확인
    canAccessPage(page) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const pagePermissions = {
            'master-dashboard': ['master'],
            'company-admin': ['master', 'company_CEO', 'company_manager'],
            'employee-workspace': ['master', 'company_CEO', 'company_manager', 'employee'],
            'sales-system': ['master', 'company_CEO', 'company_manager', 'employee']
        };

        const allowedRoles = pagePermissions[page] || [];
        return allowedRoles.includes(user.role);
    },

    // 리다이렉트 처리
    redirectToAppropriatePanel() {
        const user = this.getCurrentUser();
        console.log('리다이렉트 처리 중인 사용자:', user);
        
        if (!user) {
            window.location.href = '../../1-homepage/templates/index.html';
            return;
        }

        switch (user.role) {
            case 'master':
                console.log('마스터 대시보드로 이동');
                window.location.href = '../../2-member-management/admin/master-dashboard.html';
                break;
            case 'company_CEO':
            case 'company_manager':
                console.log('회사 관리자 대시보드로 이동');
                window.location.href = '../../2-member-management/employee/employee-dashboard.html';
                break;
            case 'employee':
                console.log('직원 시스템으로 이동');
                // steel-business-app으로 리다이렉트
                window.location.href = `../../steel-business-app/index.html`;
                break;
            default:
                console.log('기본 페이지로 이동');
                window.location.href = '../../1-homepage/templates/index.html';
        }
    },

};

// 전역 함수로 내보내기
window.AuthManager = AuthManager;