// worklog.html 디버깅용 스크립트
console.log('debug_worklog.js 로드됨');

// 기존 loadCompanies 함수를 덮어쓰기
async function loadCompanies() {
    try {
        console.log('🔄 DEBUG: loadCompanies 함수 실행 시작');
        
        // 1. 현재 사용자 정보 확인
        const currentUserStr = sessionStorage.getItem('currentUser');
        console.log('📋 sessionStorage currentUser 원본:', currentUserStr);
        
        let currentUser;
        try {
            currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
        } catch (error) {
            console.error('❌ 사용자 정보 파싱 오류:', error);
            currentUser = null;
        }
        
        console.log('👤 파싱된 currentUser:', currentUser);
        
        if (!currentUser || !currentUser.id) {
            console.error('❌ 사용자 정보가 없거나 ID가 없습니다');
            if (typeof companyList !== 'undefined' && companyList) {
                companyList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #f00;">로그인이 필요합니다.</td></tr>';
            }
            return;
        }
        
        // 2. 데이터베이스 연결 확인
        console.log('🔗 window.db 상태:', {
            exists: !!window.db,
            hasClient: !!(window.db && window.db.client),
            dbType: typeof window.db
        });
        
        if (!window.db || !window.db.client) {
            console.error('❌ 데이터베이스 연결이 없습니다');
            return;
        }
        
        // 3. 데이터베이스에서 사용자 검색
        console.log('🔍 데이터베이스에서 사용자 정보 확인 중...');
        const { data: users, error: userError } = await window.db.client
            .from('users')
            .select('*')
            .eq('name', '신종욱');
        
        console.log('👥 신종욱 사용자 검색 결과:', users);
        if (userError) console.error('❌ 사용자 검색 오류:', userError);
        
        // 4. client_companies 테이블 직접 조회
        console.log('🏢 client_companies 테이블 직접 조회 중...');
        const { data: allCompanies, error: companiesError } = await window.db.client
            .from('client_companies')
            .select('*');
        
        console.log('🏢 전체 client_companies 데이터:', allCompanies);
        if (companiesError) console.error('❌ 업체 조회 오류:', companiesError);
        
        // 5. 현재 사용자 ID로 필터링된 업체 조회
        console.log(`🔍 사용자 ID ${currentUser.id}로 업체 필터링 중...`);
        const { data: userCompanies, error: userCompaniesError } = await window.db.client
            .from('client_companies')
            .select('*')
            .eq('user_id', currentUser.id.toString());
        
        console.log(`👤 ${currentUser.name}(ID: ${currentUser.id})의 업체:`, userCompanies);
        if (userCompaniesError) console.error('❌ 사용자 업체 조회 오류:', userCompaniesError);
        
        // 6. getClientCompanies 함수 테스트
        console.log('🔧 getClientCompanies 함수 테스트...');
        try {
            const companies = await window.db.getClientCompanies(currentUser.id);
            console.log('✅ getClientCompanies 결과:', companies);
            
            // UI 업데이트
            if (typeof displayCompanies === 'function') {
                displayCompanies(companies);
            } else {
                console.warn('⚠️ displayCompanies 함수를 찾을 수 없습니다');
            }
        } catch (error) {
            console.error('❌ getClientCompanies 오류:', error);
        }
        
    } catch (error) {
        console.error('❌ DEBUG loadCompanies 전체 오류:', error);
    }
}

// 페이지 로드 시 자동 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 DEBUG: DOM 로드 완료, 3초 후 loadCompanies 실행');
    setTimeout(() => {
        loadCompanies();
    }, 3000);
});