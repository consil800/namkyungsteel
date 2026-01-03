// 수파베이스 쿼리 상세 디버깅
console.log('deep_debug.js 로드됨');

async function deepDebugQuery() {
    try {
        console.log('🔍 DEEP DEBUG: 수파베이스 쿼리 상세 분석 시작');
        
        // 1. 현재 사용자 정보
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        console.log('👤 현재 사용자:', currentUser);
        console.log('👤 사용자 ID 타입:', typeof currentUser.id, '값:', currentUser.id);
        
        if (!window.db || !window.db.client) {
            console.error('❌ 데이터베이스 연결 없음');
            return;
        }
        
        // 2. 전체 client_companies 테이블 조회 (필터 없음)
        console.log('🔍 Step 1: 전체 client_companies 테이블 조회');
        const { data: allData, error: allError } = await window.db.client
            .from('client_companies')
            .select('*');
        
        console.log('📊 전체 client_companies 데이터:', allData);
        console.log('📊 전체 데이터 개수:', allData ? allData.length : 0);
        if (allError) console.error('❌ 전체 조회 오류:', allError);
        
        // 3. user_id별 그룹핑
        if (allData && allData.length > 0) {
            const userGroups = {};
            allData.forEach(company => {
                const uid = company.user_id;
                if (!userGroups[uid]) userGroups[uid] = [];
                userGroups[uid].push(company);
            });
            
            console.log('👥 사용자별 업체 그룹핑:', userGroups);
            console.log('👥 사용자 ID 3의 데이터:', userGroups['3'] || userGroups[3]);
        }
        
        // 4. 다양한 방식으로 user_id=3 조회 테스트
        console.log('🔍 Step 2: user_id=3 다양한 조회 방식 테스트');
        
        // 4-1. 숫자로 조회
        const { data: data1, error: error1 } = await window.db.client
            .from('client_companies')
            .select('*')
            .eq('user_id', 3);
        console.log('📊 숫자 3으로 조회:', data1, error1);
        
        // 4-2. 문자열로 조회
        const { data: data2, error: error2 } = await window.db.client
            .from('client_companies')
            .select('*')
            .eq('user_id', '3');
        console.log('📊 문자열 "3"으로 조회:', data2, error2);
        
        // 4-3. in 절로 조회
        const { data: data3, error: error3 } = await window.db.client
            .from('client_companies')
            .select('*')
            .in('user_id', [3, '3']);
        console.log('📊 in절 [3, "3"]으로 조회:', data3, error3);
        
        // 5. RLS 정책 확인을 위한 raw SQL 시도
        console.log('🔍 Step 3: RLS 정책 및 권한 확인');
        
        // 5-1. 현재 인증된 사용자 확인
        const { data: authUser, error: authError } = await window.db.client.auth.getUser();
        console.log('🔐 현재 인증된 사용자:', authUser, authError);
        
        // 5-2. 테이블 권한 확인을 위한 select count
        const { count, error: countError } = await window.db.client
            .from('client_companies')
            .select('*', { count: 'exact', head: true });
        console.log('📊 테이블 총 레코드 수:', count, countError);
        
        // 6. database.js의 getClientCompanies 함수 직접 호출 테스트
        console.log('🔍 Step 4: database.js getClientCompanies 함수 직접 테스트');
        try {
            const result = await window.db.getClientCompanies(currentUser.id);
            console.log('✅ getClientCompanies 결과:', result);
        } catch (dbError) {
            console.error('❌ getClientCompanies 오류:', dbError);
        }
        
        // 7. 쿼리 빌더 단계별 확인
        console.log('🔍 Step 5: 쿼리 빌더 단계별 확인');
        let query = window.db.client.from('client_companies').select('*');
        console.log('📋 기본 쿼리 객체:', query);
        
        query = query.eq('user_id', currentUser.id.toString());
        console.log('📋 필터 적용된 쿼리 객체:', query);
        
        const finalResult = await query;
        console.log('📊 최종 쿼리 결과:', finalResult);
        
    } catch (error) {
        console.error('❌ DEEP DEBUG 전체 오류:', error);
    }
}

// 전역 함수로 등록
window.deepDebugQuery = deepDebugQuery;

// 자동 실행
setTimeout(() => {
    console.log(`
🔧 수파베이스 쿼리 디버깅 도구가 준비되었습니다!

사용법:
deepDebugQuery()

브라우저 콘솔에서 위 명령어를 실행하여 상세한 쿼리 분석을 확인하세요.
    `);
}, 3000);