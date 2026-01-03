// 권한 확인 유틸리티 (OR 방식)
console.log('🔐 permission-checker.js: 권한 확인 유틸리티 로드됨');

// OR 방식으로 사용자 메뉴 접근 권한 확인 (단순화)
window.checkUserPermission = async function(menu, user = null) {
    try {
        console.log(`🔍 권한 확인 시작: ${menu}`);
        
        // 현재 사용자 정보 가져오기
        if (!user) {
            const sessionUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            if (!sessionUser || !sessionUser.email) {
                console.log('❌ 로그인되지 않은 사용자');
                return false;
            }
            
            // 데이터베이스에서 최신 사용자 정보 조회
            const { data: dbUser, error } = await window.db.client
                .from('users')
                .select('*')
                .eq('email', sessionUser.email)
                .single();
            
            if (error || !dbUser) {
                console.log('❌ 사용자 정보 조회 실패:', error);
                return false;
            }
            
            user = dbUser;
        }
        
        console.log('👤 권한 확인 대상 사용자:', {
            name: user.name,
            department: user.department,
            position: user.position,
            role: user.role
        });
        
        // 관리자 권한 확인 (마스터, CEO, 관리자는 모든 권한)
        const adminRoles = ['master', 'company_CEO', 'company_admin'];
        if (adminRoles.includes(user.role)) {
            console.log('✅ 관리자 권한으로 접근 허용:', user.role);
            return true;
        }
        
        // user_permissions 테이블에서 권한 확인 (OR 방식)
        const { data: permissions, error: permError } = await window.db.client
            .from('user_permissions')
            .select('*')
            .eq('menu', menu)
            .eq('permission', 'access');
        
        if (permError) {
            console.error('❌ 권한 조회 오류:', permError);
            return false;
        }
        
        if (!permissions || permissions.length === 0) {
            console.log('ℹ️ 설정된 권한이 없음 - 기본 거부');
            return false;
        }
        
        // OR 방식으로 권한 확인
        let hasPermission = false;
        
        for (const perm of permissions) {
            const { permission_type, target_id } = perm;
            
            if (permission_type === 'department' && user.department === target_id) {
                console.log('✅ 부서별 권한 일치:', user.department);
                hasPermission = true;
                break;
            } else if (permission_type === 'position' && user.position === target_id) {
                console.log('✅ 직급별 권한 일치:', user.position);
                hasPermission = true;
                break;
            } else if (permission_type === 'individual' && user.id.toString() === target_id) {
                console.log('✅ 개인별 권한 일치:', user.name);
                hasPermission = true;
                break;
            }
        }
        
        console.log(`🔐 최종 권한 확인 결과: ${hasPermission ? '허용' : '거부'}`);
        return hasPermission;
        
    } catch (error) {
        console.error('❌ 권한 확인 중 오류:', error);
        return false;
    }
};

// 메뉴 접근 권한 확인 (단순화)
window.checkMenuAccess = async function(menu, user = null) {
    return await window.checkUserPermission(menu, user);
};

console.log('✅ permission-checker.js: 초기화 완료');