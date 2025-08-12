// Supabase 데이터베이스 연결 및 관리
// 이 파일은 모든 데이터베이스 작업을 위한 중앙 집중식 관리를 제공합니다

// Supabase 설정 (환경변수로 관리 권장)
const SUPABASE_URL = 'https://zgyawfmjconubxaiamod.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpneWF3Zm1qY29udWJ4YWlhbW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3NjQzNzIsImV4cCI6MjA2NzM0MDM3Mn0.shjBE2OQeILwkLLi4E6Bq0-b6YPUs-WFwquexdUiM9A';

// Supabase 클라이언트 초기화
let supabaseClient = null;

// Supabase 클라이언트 초기화 함수
async function initSupabase() {
    if (!supabaseClient) {
        // CDN에서 Supabase 클라이언트 로드
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase 라이브러리가 로드되지 않았습니다. 데이터베이스 연결이 필요합니다.');
        }
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch (error) {
            throw new Error('Supabase 연결 실패: ' + error.message);
        }
    }
    return supabaseClient;
}

// 데이터베이스 매니저 클래스 (멀티 테넌트 지원)
class DatabaseManager {
    constructor() {
        this.client = null;
        this.currentDomain = null;
        this.init();
    }

    async init() {
        try {
            this.client = await initSupabase();
            // 도메인 매니저가 있으면 현재 도메인 설정
            if (typeof domainManager !== 'undefined') {
                this.currentDomain = domainManager.getCurrentDomain();
            }
        } catch (error) {
            console.error('Supabase 초기화 오류:', error);
            throw error;
        }
    }

    // 현재 도메인 설정
    setCurrentDomain(domain) {
        this.currentDomain = domain;
    }

    // 현재 도메인 가져오기
    getCurrentDomain() {
        return this.currentDomain;
    }

    // 회사 관리 (Companies)
    async getCompanies() {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            const { data, error } = await this.client
                .from('companies')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('회사 목록 조회 오류:', error);
            throw error;
        }
    }

    async createCompany(companyData) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        const company = {
            company_name: companyData.companyName || companyData.company_name,
            domain: companyData.domain,
            website: companyData.website || '',
            email: companyData.email || '',
            phone: companyData.phone || '',
            address: companyData.address || '',
            subscription_plan: companyData.subscription_plan || 'basic',
            is_active: true,
            created_at: new Date().toISOString()
        };

        try {
            const { data, error } = await this.client
                .from('companies')
                .insert([company])
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('회사 생성 오류:', error);
            throw error;
        }
    }

    async updateCompany(domain, updateData) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('companies')
                .update(updateData)
                .eq('domain', domain)
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('회사 업데이트 오류:', error);
            throw error;
        }
    }

    async deleteCompany(domain) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { error } = await this.client
                .from('companies')
                .delete()
                .eq('domain', domain);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('회사 삭제 오류:', error);
            throw error;
        }
    }

    // 사용자 관리 (Users)
    async getUsers(companyDomain = null) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            let query = this.client.from('users').select('*');
            
            if (companyDomain) {
                query = query.eq('company_domain', companyDomain);
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('사용자 목록 조회 오류:', error);
            throw error;
        }
    }

    // 역할별 사용자 조회
    async getUsersByRole(roles, companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            let query = this.client
                .from('users')
                .select('id, name, email, position, department, role')
                .eq('company_domain', companyDomain)
                .eq('is_active', true);
            
            if (Array.isArray(roles)) {
                query = query.in('role', roles);
            } else {
                query = query.eq('role', roles);
            }
            
            const { data, error } = await query.order('name', { ascending: true });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('역할별 사용자 조회 오류:', error);
            throw error;
        }
    }

    async createUser(userData) {
        console.log('📋 createUser 호출됨:', userData);
        
        if (!this.client) {
            console.error('❌ Supabase 클라이언트가 없습니다');
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        const user = {
            username: userData.username || userData.email,
            email: userData.email,
            password: userData.password,
            name: userData.name,
            phone: userData.phone || '',
            department: userData.department || '',
            position: userData.position || '',
            role: userData.role || 'employee',
            company_domain: userData.company_domain || this.currentDomain || 'namkyungsteel.com',
            company_name: userData.company_name || '남경스틸(주)',
            is_active: true,
            created_at: new Date().toISOString()
        };

        console.log('📤 Supabase에 전송할 사용자 데이터:', user);

        try {
            const { data, error } = await this.client
                .from('users')
                .insert([user])
                .select();
            
            console.log('📥 Supabase 응답:', { data, error });
            
            if (error) {
                console.error('❌ Supabase 에러 상세:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                
                // RLS 정책 관련 에러인 경우
                if (error.code === '42501') {
                    throw new Error('권한 오류: Row Level Security 정책을 확인하세요.');
                }
                
                throw error;
            }
            
            if (!data || data.length === 0) {
                throw new Error('사용자가 생성되었지만 데이터를 반환받지 못했습니다.');
            }
            
            console.log('✅ 사용자 생성 성공:', data[0]);
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('❌ 사용자 생성 실패:', {
                message: error.message,
                error: error
            });
            
            // 에러를 더 명확하게 반환
            return { 
                success: false, 
                error: error.message || '알 수 없는 오류가 발생했습니다.' 
            };
        }
    }

    async updateUser(userId, updateData) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            let query = this.client.from('users').update(updateData);
            
            // userId가 UUID 형식인지 확인 (OAuth 사용자)
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
            
            if (isUUID) {
                // OAuth 사용자인 경우 oauth_id로 조회
                console.log('OAuth 사용자 업데이트 (oauth_id):', userId);
                query = query.eq('oauth_id', userId);
            } else if (!isNaN(userId)) {
                // 숫자 ID인 경우 일반 ID로 조회
                console.log('일반 사용자 업데이트 (id):', userId);
                query = query.eq('id', userId);
            } else if (updateData.email) {
                // ID가 올바르지 않지만 이메일이 있는 경우 이메일로 조회
                console.log('이메일로 사용자 업데이트:', updateData.email);
                query = query.eq('email', updateData.email);
            } else {
                throw new Error('유효한 사용자 식별자가 없습니다.');
            }
            
            const { data, error } = await query.select();
            
            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }
            
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('사용자 업데이트 오류:', error);
            throw error;
        }
    }

    async deleteUser(userId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { error } = await this.client
                .from('users')
                .delete()
                .eq('id', userId);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('사용자 삭제 오류:', error);
            throw error;
        }
    }

    // 사용자 설정 관리
    async getUserSettings(userId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('users')
                .select('settings')
                .eq('id', userId)
                .single();
            
            if (error) throw error;
            
            // settings가 없거나 null인 경우 기본값 반환
            return data?.settings || {
                paymentTerms: [],
                industries: [],
                regions: [],
                visitPurposes: [],
                colors: []
            };
        } catch (error) {
            console.error('사용자 설정 조회 오류:', error);
            // 오류 발생 시 기본값 반환
            return {
                paymentTerms: [],
                industries: [],
                regions: [],
                visitPurposes: [],
                colors: []
            };
        }
    }

    async updateUserSettings(userId, settings) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('users')
                .update({ 
                    settings: settings,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select();
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }
            
            return { success: true, data: data[0].settings };
        } catch (error) {
            console.error('사용자 설정 업데이트 오류:', error);
            throw error;
        }
    }

    // 직원 관리 (Employees)
    async getEmployees(companyId = null) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            let query = this.client.from('users').select('*');
            
            if (companyId) {
                query = query.eq('companyId', companyId);
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) throw error;
            
            // 데이터 형식 변환 (DB 스키마에 맞게)
            const employees = data.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                position: user.position,
                phone: user.phone,
                profileImage: user.profile_image,
                companyId: user.company_domain || companyId,
                createdAt: user.created_at,
                updatedAt: user.updated_at || user.created_at
            }));
            
            return employees;
        } catch (error) {
            console.error('직원 목록 조회 오류:', error);
            throw error;
        }
    }

    // 업무 일지 관리 (Work Logs)
    async getWorkLogs(userId = null, startDate = null, endDate = null) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            let query = this.client.from('work_logs').select('*');
            
            if (userId) query = query.eq('user_id', userId);
            if (startDate) query = query.gte('work_date', startDate);
            if (endDate) query = query.lte('work_date', endDate);
            
            const { data, error } = await query.order('work_date', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('업무 일지 조회 오류:', error);
            throw error;
        }
    }

    async createWorkLog(workLogData) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            console.log('🔍 업무일지 생성 시작:', workLogData);
            
            // user_id가 숫자인 경우 문자열로 변환
            const userId = workLogData.user_id ? workLogData.user_id.toString() : workLogData.userId?.toString();
            
            // work_logs 테이블에 직접 저장
            const { data, error } = await this.client
                .from('work_logs')
                .insert({
                    company_id: parseInt(workLogData.company_id),
                    user_id: userId,
                    visit_date: workLogData.visit_date,
                    visit_purpose: workLogData.visit_purpose,
                    meeting_person: workLogData.meeting_person || '',
                    discussion_content: workLogData.discussion_content,
                    next_action: workLogData.next_action || '',
                    follow_up_date: workLogData.follow_up_date || null,
                    additional_notes: workLogData.additional_notes || ''
                })
                .select()
                .single();
            
            if (error) {
                console.error('❌ 업무일지 생성 오류:', error);
                throw error;
            }
            
            console.log('✅ 업무일지 생성 성공:', data);
            // 트리거가 자동으로 업체 방문 통계를 업데이트함
            return { success: true, data: data };
        } catch (error) {
            console.error('업무일지 생성 오류:', error);
            throw error;
        }
    }

    // 업체별 업무 일지 조회
    async getWorkLogsByCompany(companyId, userId = null) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            console.log('🔍 업무일지 조회 시작 - companyId:', companyId, 'userId:', userId);
            
            // work_logs 테이블에서 직접 조회
            let query = this.client
                .from('work_logs')
                .select('*')
                .eq('company_id', parseInt(companyId));
            
            // userId가 제공된 경우 해당 사용자의 업무일지만 필터링
            if (userId) {
                query = query.eq('user_id', userId.toString());
            }
            
            // 날짜순 정렬 (최신순)
            const { data: workLogs, error } = await query.order('visit_date', { ascending: false });
            
            if (error) {
                console.error('❌ 업무일지 조회 오류:', error);
                throw error;
            }
            
            console.log('✅ 업무일지 조회 성공:', workLogs?.length || 0, '개');
            return workLogs || [];
        } catch (error) {
            console.error('업체별 업무일지 조회 오류:', error);
            throw error;
        }
    }

    // 업무 일지 삭제
    async deleteWorkLog(companyId, workLogId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            console.log('🔍 업무일지 삭제 시작 - companyId:', companyId, 'workLogId:', workLogId);
            
            // work_logs 테이블에서 직접 삭제
            const { data, error } = await this.client
                .from('work_logs')
                .delete()
                .eq('id', parseInt(workLogId))
                .eq('company_id', parseInt(companyId))
                .select();
            
            if (error) {
                console.error('❌ 업무일지 삭제 오류:', error);
                throw error;
            }
            
            console.log('✅ 업무일지 삭제 성공:', data);
            // 트리거가 자동으로 업체 방문 통계를 업데이트함
            return { success: true, data: data };
        } catch (error) {
            console.error('업무일지 삭제 오류:', error);
            throw error;
        }
    }

    // 업체의 방문 통계 업데이트
    async updateCompanyVisitStats(companyId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            // 해당 업체의 모든 업무일지 가져오기
            const { data: workLogs, error: fetchError } = await this.client
                .from('work_logs')
                .select('visit_date')
                .eq('company_id', parseInt(companyId))
                .order('visit_date', { ascending: false });
            
            if (fetchError) throw fetchError;
            
            // 방문횟수와 최근 방문일 계산
            const visitCount = workLogs ? workLogs.length : 0;
            const lastVisitDate = workLogs && workLogs.length > 0 ? workLogs[0].visit_date : null;
            
            // client_companies 테이블 업데이트
            const { data, error } = await this.client
                .from('client_companies')
                .update({
                    visit_count: visitCount,
                    last_visit_date: lastVisitDate
                })
                .eq('id', parseInt(companyId))
                .select();
            
            if (error) throw error;
            
            console.log('✅ 업체 방문 통계 업데이트 완료:', { visitCount, lastVisitDate });
            return { success: true, visitCount, lastVisitDate };
        } catch (error) {
            console.error('업체 방문 통계 업데이트 오류:', error);
            throw error;
        }
    }

    // 사용자 업데이트
    async updateUser(userId, userData) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        const updateData = {
            name: userData.name,
            email: userData.email,
            department: userData.department,
            position: userData.position,
            phone: userData.phone,
            profile_image: userData.profileImage,
            updated_at: new Date().toISOString()
        };

        try {
            let query = this.client.from('users').update(updateData);
            
            // userId가 UUID 형식인지 확인 (OAuth 사용자)
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
            
            if (isUUID) {
                // OAuth 사용자인 경우 oauth_id로 조회
                console.log('OAuth 사용자 업데이트 (oauth_id):', userId);
                query = query.eq('oauth_id', userId);
            } else if (!isNaN(userId)) {
                // 숫자 ID인 경우 일반 ID로 조회
                console.log('일반 사용자 업데이트 (id):', userId);
                query = query.eq('id', userId);
            } else if (userData.email) {
                // ID가 올바르지 않지만 이메일이 있는 경우 이메일로 조회
                console.log('이메일로 사용자 업데이트:', userData.email);
                query = query.eq('email', userData.email);
            } else {
                throw new Error('유효한 사용자 식별자가 없습니다.');
            }
            
            const { data, error } = await query.select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }
            
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('사용자 정보 업데이트 오류:', error);
            throw error;
        }
    }

    // 사용자 승인
    async approveUser(userId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            console.log('👍 사용자 승인 시작:', userId);
            
            const { data, error } = await this.client
                .from('users')
                .update({
                    is_approved: true,
                    role: 'employee', // 승인 시 기본 역할을 employee로 설정
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select();

            if (error) {
                console.error('❌ 사용자 승인 오류:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }

            console.log('✅ 사용자 승인 완료:', data[0]);
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('❌ 사용자 승인 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // 사용자 반려
    async rejectUser(userId, reason) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            console.log('👎 사용자 반려 시작:', userId, reason);
            
            const { data, error } = await this.client
                .from('users')
                .update({
                    is_approved: false,
                    is_active: false,
                    rejection_reason: reason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select();

            if (error) {
                console.error('❌ 사용자 반려 오류:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }

            console.log('✅ 사용자 반려 완료:', data[0]);
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('❌ 사용자 반려 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // 인증 관련
    async authenticateUser(email, password) {
        console.log('🔐 로그인 시도:', { email });
        
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            // 먼저 이메일로만 사용자 조회
            const { data, error } = await this.client
                .from('users')
                .select('*')
                .eq('email', email)
                .single();
            
            if (error) {
                console.error('❌ 사용자 조회 오류:', error);
                
                // RLS 정책 오류인 경우 (406 에러)
                if (error.code === '42501' || error.message?.includes('row-level security')) {
                    return { 
                        success: false, 
                        message: 'Row Level Security 정책으로 인해 로그인이 제한됩니다. Supabase 설정을 확인해주세요.' 
                    };
                }
                
                if (error.code === 'PGRST116') {
                    return { success: false, message: '등록되지 않은 이메일입니다.' };
                }
                return { success: false, message: '로그인 중 오류가 발생했습니다: ' + error.message };
            }
            
            // 사용자를 찾았으면 비밀번호 확인
            if (!data) {
                return { success: false, message: '사용자를 찾을 수 없습니다.' };
            }
            
            // 비밀번호 비교 (실제로는 해시 비교 필요)
            console.log('🔍 비밀번호 비교:', {
                입력된_비밀번호: password,
                저장된_비밀번호: data.password,
                비밀번호_일치: data.password === password
            });
            
            if (data.password !== password) {
                console.error('❌ 비밀번호 불일치');
                return { success: false, message: '비밀번호가 올바르지 않습니다.' };
            }
            
            // 활성 사용자인지 확인
            if (data.is_active === false) {
                return { success: false, message: '비활성화된 계정입니다.' };
            }
            
            console.log('✅ 로그인 성공:', data.email);
            
            // 데이터 형식 변환 (프론트엔드에서 사용하는 필드명으로)
            const user = {
                id: data.id,
                name: data.name,
                email: data.email,
                role: data.role,
                department: data.department,
                position: data.position,
                phone: data.phone,
                profileImage: data.profile_image, // 데이터베이스의 profile_image를 profileImage로 변환
                company_domain: data.company_domain,
                company_name: data.company_name,
                is_active: data.is_active,
                created_at: data.created_at,
                updated_at: data.updated_at
            };
            
            return { success: true, user: user };
        } catch (error) {
            console.error('❌ 인증 오류:', error);
            return { 
                success: false, 
                message: error.message || '로그인 중 오류가 발생했습니다.' 
            };
        }
    }

    // 거래처/업체 관리 (Client Companies) - 개인별
    async getClientCompanies(userId = null) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            let query = this.client.from('client_companies').select('*');
            
            if (userId) {
                // 사용자 권한 확인
                const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
                const userRole = currentUser.role;
                
                console.log('현재 사용자 권한:', userRole);
                console.log('🔍 getClientCompanies - 전달받은 userId:', userId);
                console.log('🔍 getClientCompanies - sessionStorage 사용자:', currentUser);
                
                // 모든 사용자는 자신이 등록한 업체만 볼 수 있음 (보안 강화)
                console.log('사용자별 개인 업체만 로드 (user_id 필터링 적용)');
                
                // UUID 형식인지 확인 (OAuth 사용자)
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
                
                if (isUUID) {
                    // OAuth 사용자의 경우 users 테이블에서 numeric ID 찾기
                    const { data: userRecord, error: userError } = await this.client
                        .from('users')
                        .select('id')
                        .eq('oauth_id', userId)
                        .single();
                    
                    if (userError || !userRecord) {
                        console.log('OAuth 사용자의 numeric ID를 찾을 수 없음, 빈 결과 반환');
                        return [];
                    }
                    
                    query = query.eq('user_id', userRecord.id.toString());
                } else {
                    // 일반 사용자 (numeric ID) - 문자열로 변환해서 검색
                    console.log('🔍 일반 사용자 쿼리 - userId:', userId, 'typeof:', typeof userId);
                    console.log('🔍 문자열로 변환:', userId.toString());
                    query = query.eq('user_id', userId.toString());
                }
            }
            
            const { data, error } = await query.order('company_name', { ascending: true });
            
            console.log('🔍 getClientCompanies 쿼리 결과:', {
                userId: userId,
                dataCount: data ? data.length : 0,
                error: error,
                data: data
            });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('거래처 목록 조회 오류:', error);
            throw error;
        }
    }

    async createClientCompany(companyData) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            // user_id가 필수로 필요
            if (!companyData.user_id) {
                throw new Error('사용자 ID가 필요합니다.');
            }

            let actualUserId = companyData.user_id;
            
            // OAuth 사용자 ID(UUID 형태)인 경우 실제 데이터베이스 ID로 변환
            if (typeof companyData.user_id === 'string' && companyData.user_id.includes('-')) {
                console.log('🔍 OAuth 사용자 ID 감지, 데이터베이스에서 실제 ID 조회:', companyData.user_id);
                
                // 현재 사용자 정보 가져오기
                const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
                console.log('👤 현재 사용자 정보:', currentUser);
                
                if (currentUser.email) {
                    // 이메일로 users 테이블에서 실제 ID 조회
                    const { data: userData, error: userError } = await this.client
                        .from('users')
                        .select('id')
                        .eq('email', currentUser.email)
                        .single();
                    
                    if (userError) {
                        console.error('❌ 사용자 조회 오류:', userError);
                        
                        // OAuth ID로도 시도해보기
                        const { data: oauthUserData, error: oauthError } = await this.client
                            .from('users')
                            .select('id')
                            .eq('oauth_id', companyData.user_id)
                            .single();
                        
                        if (oauthError) {
                            console.error('❌ OAuth ID로 사용자 조회 오류:', oauthError);
                            throw new Error('사용자 정보를 찾을 수 없습니다.');
                        } else {
                            actualUserId = oauthUserData.id;
                            console.log('✅ OAuth ID로 실제 사용자 ID 조회 성공:', actualUserId);
                        }
                    } else {
                        actualUserId = userData.id;
                        console.log('✅ 이메일로 실제 사용자 ID 조회 성공:', actualUserId, '(타입:', typeof actualUserId, ')');
                    }
                } else {
                    // 이메일이 없으면 OAuth ID로 조회
                    const { data: oauthUserData, error: oauthError } = await this.client
                        .from('users')
                        .select('id')
                        .eq('oauth_id', companyData.user_id)
                        .single();
                    
                    if (oauthError) {
                        console.error('❌ OAuth ID로 사용자 조회 오류:', oauthError);
                        throw new Error('사용자 정보를 찾을 수 없습니다.');
                    } else {
                        actualUserId = oauthUserData.id;
                        console.log('✅ OAuth ID로 실제 사용자 ID 조회 성공:', actualUserId, '(타입:', typeof actualUserId, ')');
                    }
                }
            }

            const newCompany = {
                ...companyData,
                user_id: String(actualUserId), // VARCHAR 필드이므로 문자열로 변환
                company_domain: companyData.company_domain || this.currentDomain || 'namkyungsteel.com',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            console.log('📝 거래처 생성 데이터:', newCompany);

            const { data, error } = await this.client
                .from('client_companies')
                .insert([newCompany])
                .select();
            
            if (error) {
                console.error('❌ Supabase 삽입 오류:', error);
                throw error;
            }
            
            console.log('✅ 거래처 생성 성공:', data);
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('거래처 생성 오류:', error);
            throw error;
        }
    }

    async updateClientCompany(companyId, updateData) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('client_companies')
                .update({
                    ...updateData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', companyId)
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('거래처 업데이트 오류:', error);
            throw error;
        }
    }

    async deleteClientCompany(companyId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { error } = await this.client
                .from('client_companies')
                .delete()
                .eq('id', companyId);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('거래처 삭제 오류:', error);
            throw error;
        }
    }

    // 사용자 설정 가져오기
    async getUserSettings(userId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            console.log('🔍 사용자 설정 조회 시작 - userId:', userId);
            
            // user_settings 테이블에서 설정 조회
            const { data, error } = await this.client
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    // 설정이 없는 경우 빈 배열 반환
                    console.log('📝 사용자 설정이 없음, 빈 설정 반환');
                    const emptySettings = {
                        paymentTerms: [],
                        businessTypes: [],
                        visitPurposes: [],
                        regions: [],
                        colors: []
                    };
                    
                    // 빈 설정을 데이터베이스에 저장
                    await this.updateUserSettings(userId, emptySettings);
                    return emptySettings;
                }
                throw error;
            }
            
            console.log('✅ 사용자 설정 조회 성공');
            
            // JSON 데이터 파싱
            return {
                paymentTerms: data.payment_terms || [],
                businessTypes: data.business_types || [],
                visitPurposes: data.visit_purposes || [],
                regions: data.regions || [],
                colors: data.colors || []
            };
        } catch (error) {
            console.error('사용자 설정 조회 오류:', error);
            throw error;
        }
    }

    // 사용자 설정 업데이트
    async updateUserSettings(userId, settings) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            console.log('📝 사용자 설정 업데이트 시작 - userId:', userId);
            
            const settingsData = {
                user_id: userId,
                payment_terms: settings.paymentTerms || [],
                business_types: settings.businessTypes || [],
                visit_purposes: settings.visitPurposes || [],
                regions: settings.regions || [],
                colors: settings.colors || [],
                updated_at: new Date().toISOString()
            };
            
            // upsert (존재하면 업데이트, 없으면 삽입)
            const { data, error } = await this.client
                .from('user_settings')
                .upsert(settingsData, {
                    onConflict: 'user_id'
                })
                .select();
            
            if (error) throw error;
            
            console.log('✅ 사용자 설정 업데이트 성공');
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('사용자 설정 업데이트 오류:', error);
            throw error;
        }
    }

    async searchClientCompanies(region = null, companyName = null, userId = null) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            let query = this.client.from('client_companies').select('*');
            
            if (userId) {
                // UUID 형식인지 확인 (OAuth 사용자)
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
                
                if (isUUID) {
                    // OAuth 사용자의 경우 users 테이블에서 numeric ID 찾기
                    const { data: userRecord, error: userError } = await this.client
                        .from('users')
                        .select('id')
                        .eq('oauth_id', userId)
                        .single();
                    
                    if (userError || !userRecord) {
                        console.log('OAuth 사용자의 numeric ID를 찾을 수 없음, 빈 결과 반환');
                        return [];
                    }
                    
                    query = query.eq('user_id', userRecord.id);
                } else {
                    // 일반 사용자 (numeric ID)
                    query = query.eq('user_id', userId);
                }
            }
            
            if (region) {
                query = query.eq('region', region);
            }
            
            if (companyName) {
                query = query.ilike('company_name', `%${companyName}%`);
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('거래처 검색 오류:', error);
            throw error;
        }
    }

    // 통계 정보
    async getStatistics() {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        const companies = await this.getCompanies();
        const users = await this.getUsers();
        
        return {
            totalCompanies: companies.length,
            totalUsers: users.length,
            activeCompanies: companies.filter(c => c.is_active !== false).length,
            usersByRole: {
                master: users.filter(u => u.role === 'master').length,
                company_admin: users.filter(u => u.role === 'company_admin').length,
                company_manager: users.filter(u => u.role === 'company_manager').length,
                employee: users.filter(u => u.role === 'employee').length
            }
        };
    }

    // 데이터베이스 연결 상태 확인
    isConnected() {
        return !!this.client;
    }

    // 연결 상태 확인 후 에러 처리
    async ensureConnection() {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다. Supabase 클라이언트를 초기화해주세요.');
        }
        return this.client;
    }

    // 서류 요청 관리
    async createDocumentRequest(documentData) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            
            // 요청자 ID 확인
            let requesterId = currentUser.id;
            if (typeof requesterId === 'string' && requesterId.includes('-')) {
                // OAuth 사용자인 경우 실제 ID 조회
                const { data: userData, error: userError } = await this.client
                    .from('users')
                    .select('id')
                    .eq('email', currentUser.email)
                    .single();
                
                if (userError) throw userError;
                requesterId = userData.id;
            }

            const newDocument = {
                document_type: documentData.document_type,
                title: documentData.title,
                content: documentData.content,
                requester_id: requesterId,
                requester_name: currentUser.name || currentUser.username,
                requester_email: currentUser.email,
                company_domain: currentUser.company_domain || 'namkyungsteel.com',
                status: 'pending',
                approver_1_id: documentData.approver_1_id,
                approver_1_name: documentData.approver_1_name,
                approver_2_id: documentData.approver_2_id,
                approver_2_name: documentData.approver_2_name,
                current_approver_id: documentData.approver_1_id,
                current_approver_name: documentData.approver_1_name,
                created_at: new Date().toISOString()
            };

            console.log('📝 서류 생성 데이터:', newDocument);

            const { data, error } = await this.client
                .from('document_requests')
                .insert([newDocument])
                .select();
            
            if (error) throw error;
            
            console.log('✅ 서류 생성 성공:', data);
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('서류 생성 오류:', error);
            throw error;
        }
    }

    // 서류 목록 조회
    async getDocumentRequests(userId = null, role = null) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            let query = this.client.from('document_requests').select('*');
            
            if (userId && role === 'employee') {
                // 일반 직원은 자신이 작성한 서류만 조회
                query = query.eq('requester_id', userId);
            } else if (userId) {
                // 승인자는 자신이 승인해야 할 서류 조회
                query = query.or(`approver_1_id.eq.${userId},approver_2_id.eq.${userId}`);
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('서류 목록 조회 오류:', error);
            throw error;
        }
    }

    // 승인 대기 중인 서류 조회
    async getPendingDocuments(approverId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            // 실제 사용자 ID 확인
            let actualApproverId = approverId;
            if (typeof approverId === 'string' && approverId.includes('-')) {
                const { data: userData, error: userError } = await this.client
                    .from('users')
                    .select('id')
                    .eq('oauth_id', approverId)
                    .single();
                
                if (!userError && userData) {
                    actualApproverId = userData.id;
                }
            }

            const { data, error } = await this.client
                .from('document_requests')
                .select('*')
                .eq('status', 'pending')
                .eq('current_approver_id', actualApproverId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('승인 대기 서류 조회 오류:', error);
            throw error;
        }
    }

    // 서류 승인/반려
    async updateDocumentStatus(documentId, action, comment = '') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            
            // 현재 서류 정보 조회
            const { data: doc, error: fetchError } = await this.client
                .from('document_requests')
                .select('*')
                .eq('id', documentId)
                .single();
            
            if (fetchError) throw fetchError;
            
            const now = new Date().toISOString();
            let updateData = {
                updated_at: now
            };

            // 1차 승인자인 경우
            if (doc.current_approver_id === doc.approver_1_id) {
                updateData.approver_1_status = action;
                updateData.approver_1_comment = comment;
                updateData.approver_1_date = now;
                
                if (action === 'approved' && doc.approver_2_id) {
                    // 2차 승인자가 있으면 2차 승인자에게 넘김
                    updateData.current_approver_id = doc.approver_2_id;
                    updateData.current_approver_name = doc.approver_2_name;
                } else {
                    // 2차 승인자가 없거나 반려인 경우 최종 처리
                    updateData.status = action;
                    updateData.completed_at = now;
                }
            }
            // 2차 승인자인 경우
            else if (doc.current_approver_id === doc.approver_2_id) {
                updateData.approver_2_status = action;
                updateData.approver_2_comment = comment;
                updateData.approver_2_date = now;
                updateData.status = action;
                updateData.completed_at = now;
            }

            const { data, error } = await this.client
                .from('document_requests')
                .update(updateData)
                .eq('id', documentId)
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('서류 상태 업데이트 오류:', error);
            throw error;
        }
    }

    // 대시보드 통계 조회
    async getDashboardStatistics(companyDomain) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('document_statistics')
                .select('*')
                .eq('company_domain', companyDomain)
                .single();
            
            if (error) {
                // 뷰가 없거나 데이터가 없는 경우 기본값 반환
                return {
                    monthly_total: 0,
                    monthly_pending: 0,
                    monthly_approved: 0,
                    monthly_rejected: 0,
                    monthly_leave: 0,
                    monthly_proposal: 0
                };
            }
            
            return data;
        } catch (error) {
            console.error('통계 조회 오류:', error);
            return {
                monthly_total: 0,
                monthly_pending: 0,
                monthly_approved: 0,
                monthly_rejected: 0,
                monthly_leave: 0,
                monthly_proposal: 0
            };
        }
    }

    // 최근 활동 조회
    async getRecentActivities(companyDomain, limit = 5) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('recent_activities')
                .select('*')
                .eq('company_domain', companyDomain)
                .limit(limit);
            
            if (error) {
                // 뷰가 없는 경우 직접 조회
                const { data: fallbackData, error: fallbackError } = await this.client
                    .from('document_requests')
                    .select('*')
                    .eq('company_domain', companyDomain)
                    .order('created_at', { ascending: false })
                    .limit(limit);
                
                if (fallbackError) throw fallbackError;
                return fallbackData || [];
            }
            
            return data || [];
        } catch (error) {
            console.error('최근 활동 조회 오류:', error);
            return [];
        }
    }

    // 문서 템플릿 설정 관리
    async getDocumentTemplatesSettings(companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('document_templates_with_approver')
                .select('*')
                .eq('company_domain', companyDomain)
                .order('template_id');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('문서 템플릿 설정 조회 오류:', error);
            throw error;
        }
    }

    async updateDocumentTemplateSettings(templateId, settings) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const updateData = {
                template_name: settings.template_name,
                template_content: settings.template_content,
                is_enabled: settings.is_enabled,
                final_approver_id: settings.final_approver_id,
                final_approver_name: settings.final_approver_name,
                final_approver_email: settings.final_approver_email,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('document_templates_settings')
                .update(updateData)
                .eq('template_id', templateId)
                .select();

            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('문서 템플릿 설정 업데이트 오류:', error);
            throw error;
        }
    }

    async createDocumentTemplateSettings(templateData) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('document_templates_settings')
                .insert([templateData])
                .select();

            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('문서 템플릿 설정 생성 오류:', error);
            throw error;
        }
    }

    async deleteDocumentTemplateSettings(templateId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('document_templates_settings')
                .delete()
                .eq('template_id', templateId)
                .select();

            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('문서 템플릿 설정 삭제 오류:', error);
            throw error;
        }
    }

    // 문서 승인 흐름 개선
    async updateDocumentStatus(documentId, action, comment = '', approverId = null) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            // 먼저 현재 문서 상태 조회
            const { data: currentDoc, error: fetchError } = await this.client
                .from('document_requests')
                .select('*')
                .eq('id', documentId)
                .single();

            if (fetchError) throw fetchError;

            let nextStatus = action;
            let nextApproverId = null;

            // 문서 템플릿 설정에서 최종 승인자 확인
            const { data: templateSettings, error: templateError } = await this.client
                .from('document_templates_settings')
                .select('final_approver_id')
                .eq('template_id', currentDoc.document_type)
                .single();

            if (!templateError && templateSettings?.final_approver_id) {
                const finalApproverId = templateSettings.final_approver_id;
                
                if (action === 'approved') {
                    // 현재 승인자가 최종 승인자인지 확인
                    if (currentDoc.current_approver_id === finalApproverId) {
                        // 최종 승인자가 승인하면 완료
                        nextStatus = 'completed';
                        nextApproverId = null;
                    } else if (currentDoc.current_approver_id === currentDoc.approver_1_id) {
                        // 1차 승인자가 승인하면 2차 승인자 또는 최종 승인자로
                        if (currentDoc.approver_2_id && currentDoc.approver_2_id !== finalApproverId) {
                            nextStatus = 'pending';
                            nextApproverId = currentDoc.approver_2_id;
                        } else {
                            nextStatus = 'pending';
                            nextApproverId = finalApproverId;
                        }
                    } else if (currentDoc.current_approver_id === currentDoc.approver_2_id) {
                        // 2차 승인자가 승인하면 최종 승인자로
                        nextStatus = 'pending';
                        nextApproverId = finalApproverId;
                    }
                }
            } else {
                // 최종 승인자가 설정되지 않은 경우 기존 로직 사용
                if (action === 'approved') {
                    if (currentDoc.current_approver_id === currentDoc.approver_1_id && currentDoc.approver_2_id) {
                        nextStatus = 'pending';
                        nextApproverId = currentDoc.approver_2_id;
                    } else {
                        nextStatus = 'completed';
                        nextApproverId = null;
                    }
                }
            }

            const updateData = {
                status: nextStatus,
                current_approver_id: nextApproverId,
                approval_comment: comment,
                updated_at: new Date().toISOString()
            };

            if (action === 'approved') {
                updateData.approved_at = new Date().toISOString();
                updateData.approved_by = approverId || currentDoc.current_approver_id;
            } else if (action === 'rejected') {
                updateData.rejected_at = new Date().toISOString();
                updateData.rejected_by = approverId || currentDoc.current_approver_id;
            }

            const { data, error } = await this.client
                .from('document_requests')
                .update(updateData)
                .eq('id', documentId)
                .select();

            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('문서 상태 업데이트 오류:', error);
            throw error;
        }
    }

    // ========================================
    // 권한 관리 시스템 메서드들
    // ========================================

    // 권한 유형 목록 조회
    async getPermissionTypes(companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            const { data, error } = await this.client
                .from('permission_types')
                .select('*')
                .eq('company_domain', companyDomain)
                .eq('is_active', true)
                .order('display_name', { ascending: true });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('권한 유형 조회 오류:', error);
            throw error;
        }
    }

    // 사용자 권한 확인 (OR 조건: 개인별 OR 부서별 OR 직급별)
    async checkUserPermission(userId, permissionType, companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            const { data, error } = await this.client
                .from('user_permission_check')
                .select('*')
                .eq('user_id', userId)
                .eq('permission_type', permissionType)
                .eq('company_domain', companyDomain)
                .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            
            return {
                hasPermission: data ? data.max_permission_level > 0 : false,
                permissionLevel: data ? data.effective_permission_level : 'none',
                maxLevel: data ? data.max_permission_level : 0
            };
        } catch (error) {
            console.error('사용자 권한 확인 오류:', error);
            return { hasPermission: false, permissionLevel: 'none', maxLevel: 0 };
        }
    }

    // 사용자의 모든 권한 조회
    async getUserAllPermissions(userId, companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            const { data, error } = await this.client
                .from('user_permission_check')
                .select('*')
                .eq('user_id', userId)
                .eq('company_domain', companyDomain)
                .gt('max_permission_level', 0);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('사용자 전체 권한 조회 오류:', error);
            throw error;
        }
    }

    // 권한 설정 목록 조회 (관리자용)
    async getPermissionSettings(companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            const { data, error } = await this.client
                .from('user_permissions')
                .select(`
                    *,
                    permission_types (
                        name,
                        display_name
                    ),
                    users (
                        name,
                        email
                    )
                `)
                .eq('company_domain', companyDomain)
                .eq('is_active', true)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('권한 설정 조회 오류:', error);
            throw error;
        }
    }

    // 권한 부여 (개인별)
    async grantUserPermission(permissionTypeId, userId, permissionLevel = 'read', grantedBy, companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            // 기존 개인 권한 비활성화
            await this.client
                .from('user_permissions')
                .update({ is_active: false })
                .eq('permission_type_id', permissionTypeId)
                .eq('user_id', userId)
                .eq('company_domain', companyDomain);
            
            // 새 권한 부여
            const { data, error } = await this.client
                .from('user_permissions')
                .insert([{
                    permission_type_id: permissionTypeId,
                    user_id: userId,
                    permission_level: permissionLevel,
                    company_domain: companyDomain,
                    granted_by: grantedBy,
                    is_active: true
                }])
                .select();
            
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('개인 권한 부여 오류:', error);
            throw error;
        }
    }

    // 권한 부여 (부서별)
    async grantDepartmentPermission(permissionTypeId, department, permissionLevel = 'read', grantedBy, companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            // 기존 부서 권한 비활성화
            await this.client
                .from('user_permissions')
                .update({ is_active: false })
                .eq('permission_type_id', permissionTypeId)
                .eq('department', department)
                .is('user_id', null)
                .eq('company_domain', companyDomain);
            
            // 새 권한 부여
            const { data, error } = await this.client
                .from('user_permissions')
                .insert([{
                    permission_type_id: permissionTypeId,
                    department: department,
                    permission_level: permissionLevel,
                    company_domain: companyDomain,
                    granted_by: grantedBy,
                    is_active: true
                }])
                .select();
            
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('부서 권한 부여 오류:', error);
            throw error;
        }
    }

    // 권한 부여 (직급별)
    async grantPositionPermission(permissionTypeId, position, permissionLevel = 'read', grantedBy, companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            // 기존 직급 권한 비활성화
            await this.client
                .from('user_permissions')
                .update({ is_active: false })
                .eq('permission_type_id', permissionTypeId)
                .eq('position', position)
                .is('user_id', null)
                .is('department', null)
                .eq('company_domain', companyDomain);
            
            // 새 권한 부여
            const { data, error } = await this.client
                .from('user_permissions')
                .insert([{
                    permission_type_id: permissionTypeId,
                    position: position,
                    permission_level: permissionLevel,
                    company_domain: companyDomain,
                    granted_by: grantedBy,
                    is_active: true
                }])
                .select();
            
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('직급 권한 부여 오류:', error);
            throw error;
        }
    }

    // 권한 취소
    async revokePermission(permissionId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            const { data, error } = await this.client
                .from('user_permissions')
                .update({ is_active: false })
                .eq('id', permissionId)
                .select();
            
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('권한 취소 오류:', error);
            throw error;
        }
    }

    // 부서 목록 조회 (권한 설정용)
    async getDepartments(companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            const { data, error } = await this.client
                .from('users')
                .select('department')
                .eq('company_domain', companyDomain)
                .eq('is_active', true)
                .not('department', 'is', null)
                .not('department', 'eq', '');
            
            if (error) throw error;
            
            // 중복 제거
            const uniqueDepartments = [...new Set(data.map(item => item.department))];
            return uniqueDepartments.sort();
        } catch (error) {
            console.error('부서 목록 조회 오류:', error);
            throw error;
        }
    }

    // 직급 목록 조회 (권한 설정용)
    async getPositions(companyDomain = 'namkyungsteel.com') {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }
        
        try {
            const { data, error } = await this.client
                .from('users')
                .select('position')
                .eq('company_domain', companyDomain)
                .eq('is_active', true)
                .not('position', 'is', null)
                .not('position', 'eq', '');
            
            if (error) throw error;
            
            // 중복 제거
            const uniquePositions = [...new Set(data.map(item => item.position))];
            return uniquePositions.sort();
        } catch (error) {
            console.error('직급 목록 조회 오류:', error);
            throw error;
        }
    }

    // ========================================
    // 알림(Notification) 관리 메서드들
    // ========================================

    // 알림 생성
    async createNotification(notificationData) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const notification = {
                ...notificationData,
                created_at: new Date().toISOString(),
                is_read: false
            };

            const { data, error } = await this.client
                .from('notifications')
                .insert([notification])
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('알림 생성 오류:', error);
            throw error;
        }
    }

    // 여러 사용자에게 알림 생성
    async createNotificationsForUsers(userIds, notificationTemplate) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const notifications = userIds.map(userId => ({
                ...notificationTemplate,
                user_id: userId,
                created_at: new Date().toISOString(),
                is_read: false
            }));

            const { data, error } = await this.client
                .from('notifications')
                .insert(notifications)
                .select();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('다중 알림 생성 오류:', error);
            throw error;
        }
    }

    // 특정 역할의 모든 사용자에게 알림 생성
    async createNotificationForRoles(roles, companyDomain, notificationTemplate) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            // 해당 역할의 사용자들 조회
            const { data: users, error: userError } = await this.client
                .from('users')
                .select('id')
                .in('role', roles)
                .eq('company_domain', companyDomain)
                .eq('is_active', true);
            
            if (userError) throw userError;
            
            if (!users || users.length === 0) {
                return { success: true, data: [] };
            }

            // 알림 생성
            const userIds = users.map(user => user.id);
            return await this.createNotificationsForUsers(userIds, notificationTemplate);
        } catch (error) {
            console.error('역할별 알림 생성 오류:', error);
            throw error;
        }
    }

    // 사용자의 알림 목록 조회
    async getUserNotifications(userId, limit = 50) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('알림 목록 조회 오류:', error);
            throw error;
        }
    }

    // 알림 읽음 처리
    async markNotificationAsRead(notificationId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('notifications')
                .update({ 
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('id', notificationId)
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('알림 읽음 처리 오류:', error);
            throw error;
        }
    }

    // 모든 알림 읽음 처리
    async markAllNotificationsAsRead(userId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { data, error } = await this.client
                .from('notifications')
                .update({ 
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('is_read', false)
                .select();
            
            if (error) throw error;
            return { success: true, count: data.length };
        } catch (error) {
            console.error('모든 알림 읽음 처리 오류:', error);
            throw error;
        }
    }

    // 읽지 않은 알림 개수 조회
    async getUnreadNotificationCount(userId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            const { count, error } = await this.client
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_read', false);
            
            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error('읽지 않은 알림 개수 조회 오류:', error);
            throw error;
        }
    }
}

// 전역 데이터베이스 매니저 인스턴스
const db = new DatabaseManager();

// 전역 함수로 내보내기
window.db = db;

// 초기화 완료 후 이벤트 발생
document.addEventListener('DOMContentLoaded', function() {
    // 데이터베이스 연결 상태 확인
    setTimeout(async () => {
        if (db.client) {
            console.log('✅ Supabase 데이터베이스 연결됨');
            
            // 테스트 사용자 확인
            try {
                const users = await db.getUsers();
                console.log('현재 사용자 수:', users.length);
                
                // 데이터베이스 사용자 수 확인만 수행 (마스터 체크 제거)
                console.log('데이터베이스 사용자 확인 완료');
            } catch (error) {
                console.error('사용자 데이터 확인 오류:', error);
            }
        }
    }, 1000);
});