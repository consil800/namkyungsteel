// 신종욱 사용자를 위한 테스트 데이터 추가 스크립트
console.log('add_test_data.js 로드됨');

// 테스트 데이터 추가 함수
async function addTestData() {
    try {
        console.log('🔧 테스트 데이터 추가 시작');
        
        // 현재 사용자 확인
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        console.log('👤 현재 사용자:', currentUser);
        
        if (!currentUser.id) {
            console.error('❌ 사용자 정보가 없습니다');
            return;
        }
        
        if (!window.db || !window.db.client) {
            console.error('❌ 데이터베이스 연결이 없습니다');
            return;
        }
        
        // 테스트 업체 데이터
        const testCompanies = [
            {
                user_id: currentUser.id,
                company_name: '삼성전자',
                address: '서울시 강남구 테헤란로 123',
                contact_person: '김철수',
                phone: '02-1234-5678',
                email: 'kim@samsung.com',
                business_type: '제조업',
                region: '서울',
                payment_terms: '월말결제',
                color_code: 'blue',
                notes: '테스트 업체 1',
                visit_count: 0,
                last_visit_date: null,
                created_at: new Date().toISOString()
            },
            {
                user_id: currentUser.id,
                company_name: 'LG전자',
                address: '부산시 해운대구 센텀로 456',
                contact_person: '이영희',
                phone: '051-9876-5432',
                email: 'lee@lg.com',
                business_type: '제조업',
                region: '부산',
                payment_terms: '30일',
                color_code: 'red',
                notes: '테스트 업체 2',
                visit_count: 0,
                last_visit_date: null,
                created_at: new Date().toISOString()
            },
            {
                user_id: currentUser.id,
                company_name: '현대건설',
                address: '창원시 의창구 공단로 789',
                contact_person: '박민수',
                phone: '055-1111-2222',
                email: 'park@hyundai.com',
                business_type: '건설업',
                region: '창원',
                payment_terms: '45일',
                color_code: 'green',
                notes: '테스트 업체 3',
                visit_count: 0,
                last_visit_date: null,
                created_at: new Date().toISOString()
            }
        ];
        
        console.log('📊 추가할 테스트 데이터:', testCompanies);
        
        // 데이터베이스에 추가
        const { data, error } = await window.db.client
            .from('client_companies')
            .insert(testCompanies)
            .select();
        
        if (error) {
            console.error('❌ 테스트 데이터 추가 오류:', error);
            alert('테스트 데이터 추가 중 오류가 발생했습니다: ' + error.message);
        } else {
            console.log('✅ 테스트 데이터 추가 성공:', data);
            alert(`✅ ${testCompanies.length}개의 테스트 업체가 추가되었습니다!\n페이지를 새로고침하여 확인하세요.`);
            
            // 데이터 추가 후 업체 목록 다시 로드
            if (typeof loadCompanies === 'function') {
                console.log('🔄 업체 목록 재로드 중...');
                setTimeout(() => {
                    loadCompanies();
                }, 1000);
            }
        }
        
    } catch (error) {
        console.error('❌ 테스트 데이터 추가 전체 오류:', error);
        alert('테스트 데이터 추가 중 오류가 발생했습니다.');
    }
}

// 기존 테스트 데이터 삭제 함수
async function clearTestData() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        
        if (!currentUser.id) {
            console.error('❌ 사용자 정보가 없습니다');
            return;
        }
        
        console.log('🗑️ 기존 테스트 데이터 삭제 중...');
        
        const { data, error } = await window.db.client
            .from('client_companies')
            .delete()
            .eq('user_id', currentUser.id);
        
        if (error) {
            console.error('❌ 데이터 삭제 오류:', error);
        } else {
            console.log('✅ 기존 데이터 삭제 완료');
        }
        
    } catch (error) {
        console.error('❌ 데이터 삭제 전체 오류:', error);
    }
}

// 전역 함수로 등록
window.addTestData = addTestData;
window.clearTestData = clearTestData;

// 페이지 로드 완료 후 안내 메시지
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log(`
🔧 테스트 데이터 관리 도구가 준비되었습니다!

사용법:
1. 테스트 데이터 추가: addTestData()
2. 기존 데이터 삭제: clearTestData()

브라우저 콘솔에서 위 명령어를 실행하세요.
        `);
    }, 2000);
});