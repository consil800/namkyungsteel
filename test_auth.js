// 인증 상태 및 Policy 테스트
console.log('test_auth.js 로드됨');

async function testAuthAndPolicy() {
    try {
        console.log('🔐 인증 상태 및 Policy 테스트 시작');
        
        if (!window.db || !window.db.client) {
            console.error('❌ 데이터베이스 연결 없음');
            return;
        }
        
        // 1. 현재 sessionStorage 사용자
        const sessionUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        console.log('👤 sessionStorage 사용자:', sessionUser);
        
        // 2. Supabase 인증 상태 확인
        const { data: authUser, error: authError } = await window.db.client.auth.getUser();
        console.log('🔐 Supabase 인증된 사용자:', authUser);
        console.log('🔐 Supabase auth.uid():', authUser?.user?.id);
        
        if (authError) {
            console.error('❌ 인증 오류:', authError);
        }
        
        // 3. client_companies 쿼리 테스트
        console.log('🔍 client_companies 쿼리 테스트...');
        
        const { data: companies, error: companiesError } = await window.db.client
            .from('client_companies')
            .select('*');
        
        console.log('📊 client_companies 쿼리 결과:', companies);
        console.log('📊 데이터 개수:', companies ? companies.length : 0);
        
        if (companiesError) {
            console.error('❌ client_companies 쿼리 오류:', companiesError);
            console.log('💡 이 오류가 Policy 관련 오류인지 확인하세요');
        }
        
        // 4. 인증이 필요한 경우 로그인 시도
        if (!authUser?.user) {
            console.log('🔑 Supabase 인증이 필요합니다. 로그인 시도...');
            
            // sessionStorage의 사용자 정보로 로그인 시도
            if (sessionUser.email) {
                console.log('📧 이메일로 로그인 시도:', sessionUser.email);
                
                // 임시 패스워드로 로그인 시도 (실제로는 사용자가 입력해야 함)
                const { data: loginData, error: loginError } = await window.db.client.auth.signInWithPassword({
                    email: sessionUser.email,
                    password: 'temp_password' // 실제 패스워드 필요
                });
                
                console.log('🔑 로그인 시도 결과:', loginData, loginError);
                
                if (loginError) {
                    console.log('💡 수동 로그인이 필요할 수 있습니다');
                    console.log('💡 또는 Policy에서 user_id 매핑 방식을 수정해야 할 수 있습니다');
                }
            }
        }
        
        // 5. user_id와 auth.uid() 매핑 확인
        console.log('🔍 user_id와 auth.uid() 매핑 확인...');
        
        if (authUser?.user?.id && sessionUser.id) {
            console.log('📋 매핑 확인:', {
                'sessionUser.id': sessionUser.id,
                'auth.uid()': authUser.user.id,
                '타입 일치': typeof sessionUser.id === typeof authUser.user.id,
                '값 일치': sessionUser.id === authUser.user.id
            });
            
            // Policy가 user_id = auth.uid()::text를 사용하므로
            // auth.uid()를 문자열로 변환했을 때 sessionUser.id와 일치하는지 확인
            const authUidAsString = authUser.user.id.toString();
            const sessionUserIdAsString = sessionUser.id.toString();
            
            console.log('📋 문자열 변환 후 매핑:', {
                'sessionUser.id (string)': sessionUserIdAsString,
                'auth.uid() (string)': authUidAsString,
                '문자열 일치': sessionUserIdAsString === authUidAsString
            });
        }
        
        // 6. Policy 우회 테스트 (관리자 권한으로)
        console.log('🔧 Policy 우회 테스트...');
        
        // service_role 키를 사용한 우회 쿼리 (개발용)
        // 실제 production에서는 사용하지 말 것
        
        
    } catch (error) {
        console.error('❌ 인증 테스트 전체 오류:', error);
    }
}

// 전역 함수로 등록
window.testAuthAndPolicy = testAuthAndPolicy;

// 자동 실행
setTimeout(() => {
    console.log(`
🔐 인증 상태 및 Policy 테스트 도구가 준비되었습니다!

사용법:
testAuthAndPolicy()

브라우저 콘솔에서 위 명령어를 실행하세요.
    `);
}, 3000);