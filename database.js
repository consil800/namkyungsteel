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
            const { data, error } = await this.client
                .from('users')
                .update(updateData)
                .eq('id', userId)
                .select();
            
            if (error) throw error;
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

        // work_logs 테이블이 없으므로 client_companies의 notes 필드를 활용하여 업무일지 저장
        try {
            // 기존 업체 정보 가져오기
            const { data: companies, error: fetchError } = await this.client
                .from('client_companies')
                .select('notes')
                .eq('id', workLogData.company_id)
                .single();
            
            if (fetchError) throw fetchError;
            
            // 기존 notes를 파싱하여 업무일지와 메모 분리
            let workLogs = [];
            let originalNotes = companies.notes || '';
            
            if (companies && companies.notes) {
                try {
                    const notesData = JSON.parse(companies.notes);
                    if (notesData.workLogs && Array.isArray(notesData.workLogs)) {
                        workLogs = notesData.workLogs;
                        originalNotes = notesData.memo || '';
                    }
                } catch (e) {
                    // 기존 notes가 JSON이 아닌 경우 원본 텍스트 보존
                    originalNotes = companies.notes;
                    workLogs = [];
                }
            }
            
            // 새 업무일지 추가
            const newWorkLog = {
                id: Date.now(), // 간단한 ID 생성
                user_id: workLogData.user_id || workLogData.userId,
                visit_date: workLogData.visit_date,
                visit_purpose: workLogData.visit_purpose,
                meeting_person: workLogData.meeting_person || '',
                discussion_content: workLogData.discussion_content,
                next_action: workLogData.next_action || '',
                follow_up_date: workLogData.follow_up_date,
                additional_notes: workLogData.additional_notes || '',
                created_at: new Date().toISOString()
            };
            
            workLogs.push(newWorkLog);
            
            // notes 필드에 업무일지와 메모를 함께 저장
            const { data, error } = await this.client
                .from('client_companies')
                .update({
                    notes: JSON.stringify({ 
                        workLogs: workLogs,
                        memo: originalNotes 
                    })
                })
                .eq('id', workLogData.company_id)
                .select();
            
            if (error) throw error;
            return { success: true, data: newWorkLog };
        } catch (error) {
            console.error('업무 일지 생성 오류:', error);
            throw error;
        }
    }

    // 업체별 업무 일지 조회
    async getWorkLogsByCompany(companyId, userId = null) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            // client_companies의 notes 필드에서 업무일지 가져오기
            const { data: companies, error } = await this.client
                .from('client_companies')
                .select('notes')
                .eq('id', companyId)
                .single();
            
            if (error) throw error;
            
            let workLogs = [];
            if (companies && companies.notes) {
                try {
                    const notesData = JSON.parse(companies.notes);
                    if (notesData.workLogs && Array.isArray(notesData.workLogs)) {
                        workLogs = notesData.workLogs;
                        
                        // userId가 제공된 경우 해당 사용자의 업무일지만 필터링
                        if (userId) {
                            workLogs = workLogs.filter(log => log.user_id === userId);
                        }
                        
                        // 날짜순 정렬 (최신순)
                        workLogs.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
                    }
                } catch (e) {
                    console.error('업무일지 파싱 오류:', e);
                    workLogs = [];
                }
            }
            
            return workLogs;
        } catch (error) {
            console.error('업체별 업무 일지 조회 오류:', error);
            throw error;
        }
    }

    // 업무 일지 삭제
    async deleteWorkLog(companyId, workLogId) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            // 기존 업체 정보 가져오기
            const { data: companies, error: fetchError } = await this.client
                .from('client_companies')
                .select('notes, visit_count, last_visit_date')
                .eq('id', companyId)
                .single();
            
            if (fetchError) throw fetchError;
            
            let workLogs = [];
            let originalMemo = '';
            
            if (companies && companies.notes) {
                try {
                    const notesData = JSON.parse(companies.notes);
                    if (notesData.workLogs && Array.isArray(notesData.workLogs)) {
                        // 삭제할 업무일지를 제외한 나머지만 필터링
                        workLogs = notesData.workLogs.filter(log => log.id !== workLogId);
                        originalMemo = notesData.memo || '';
                    }
                } catch (e) {
                    console.error('업무일지 파싱 오류:', e);
                    throw new Error('업무일지 데이터를 읽을 수 없습니다.');
                }
            }
            
            // 방문횟수를 남은 업무일지 개수로 설정
            const newVisitCount = workLogs.length;
            
            // 최근 방문일 재계산 (남은 업무일지 중 가장 최근 날짜)
            let newLastVisitDate = null;
            if (workLogs.length > 0) {
                const sortedLogs = workLogs.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
                newLastVisitDate = sortedLogs[0].visit_date;
            }
            
            // notes 필드와 방문 정보 업데이트
            const { data, error } = await this.client
                .from('client_companies')
                .update({
                    notes: JSON.stringify({ 
                        workLogs: workLogs,
                        memo: originalMemo 
                    }),
                    visit_count: newVisitCount,
                    last_visit_date: newLastVisitDate
                })
                .eq('id', companyId)
                .select();
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('업무 일지 삭제 오류:', error);
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
            const { data, error } = await this.client
                .from('users')
                .update(updateData)
                .eq('id', userId)
                .select();

            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('사용자 정보 업데이트 오류:', error);
            throw error;
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
                query = query.eq('user_id', userId);
            }
            
            const { data, error } = await query.order('company_name', { ascending: true });
            
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

            const newCompany = {
                ...companyData,
                company_domain: companyData.company_domain || this.currentDomain || 'namkyungsteel.com',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('client_companies')
                .insert([newCompany])
                .select();
            
            if (error) throw error;
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

    async searchClientCompanies(region = null, companyName = null, userId = null) {
        if (!this.client) {
            throw new Error('데이터베이스 연결이 필요합니다.');
        }

        try {
            let query = this.client.from('client_companies').select('*');
            
            if (userId) {
                query = query.eq('user_id', userId);
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
}

// 전역 데이터베이스 매니저 인스턴스
const db = new DatabaseManager();

// 전역 함수로 내보내기
window.db = db;

// 테스트 사용자 생성 함수
async function createTestUser() {
    try {
        const testUser = {
            email: 'master@steelworks.com',
            password: 'steelmaster2025',
            name: '마스터 관리자',
            role: 'master_admin',
            department: '관리부',
            position: '마스터',
            company_domain: 'consil800.com'
        };
        
        const result = await db.createUser(testUser);
        console.log('테스트 사용자 생성 결과:', result);
        return result;
    } catch (error) {
        console.error('테스트 사용자 생성 오류:', error);
        return { success: false, error: error.message };
    }
}

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
                
                // 마스터 사용자가 없으면 생성
                const masterUser = users.find(u => u.email === 'master@steelworks.com');
                if (!masterUser) {
                    console.log('마스터 사용자가 없습니다. 생성 중...');
                    await createTestUser();
                }
            } catch (error) {
                console.error('사용자 데이터 확인 오류:', error);
            }
        } else {
            console.error('❌ 데이터베이스 연결 실패 - 모든 데이터베이스 작업이 실패합니다.');
        }
    }, 1000);
});