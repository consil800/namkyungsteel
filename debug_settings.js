// settings.html 디버깅용 추가 스크립트
console.log('debug_settings.js 로드됨');

// 5초 후 상세 진단 실행
setTimeout(async () => {
    console.log('🔧 SETTINGS DEBUG: 상세 진단 시작');
    
    try {
        // 1. 현재 사용자 확인
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        console.log('👤 현재 사용자:', currentUser);
        
        if (!currentUser.id) {
            console.error('❌ 사용자 정보가 없습니다');
            return;
        }
        
        // 2. 데이터베이스 직접 조회
        if (window.db && window.db.client) {
            console.log('🏢 client_companies 테이블에서 사용자 데이터 직접 조회...');
            
            const { data: userCompanies, error } = await window.db.client
                .from('client_companies')
                .select('*')
                .eq('user_id', currentUser.id.toString());
            
            console.log(`👤 사용자 ID ${currentUser.id}의 업체 데이터:`, userCompanies);
            console.log(`📊 총 ${userCompanies ? userCompanies.length : 0}개 업체 발견`);
            
            if (userCompanies && userCompanies.length > 0) {
                // 고유값 추출 테스트
                const uniqueRegions = [...new Set(userCompanies.map(c => c.region).filter(Boolean))].sort();
                const uniquePaymentTerms = [...new Set(userCompanies.map(c => c.payment_terms).filter(Boolean))].sort();
                const uniqueBusinessTypes = [...new Set(userCompanies.map(c => c.business_type).filter(Boolean))].sort();
                
                console.log('📋 추출된 고유값들:', {
                    regions: uniqueRegions,
                    paymentTerms: uniquePaymentTerms,
                    businessTypes: uniqueBusinessTypes
                });
                
                // 드롭다운 테스트
                console.log('🔧 드롭다운 테스트...');
                const regionsDropdown = document.getElementById('regionsDropdown');
                const paymentTermsDropdown = document.getElementById('paymentTermsDropdown');
                const businessTypesDropdown = document.getElementById('businessTypesDropdown');
                
                console.log('📋 드롭다운 요소들:', {
                    regionsDropdown: regionsDropdown,
                    paymentTermsDropdown: paymentTermsDropdown,
                    businessTypesDropdown: businessTypesDropdown
                });
                
                // 직접 드롭다운 채우기 테스트
                if (regionsDropdown && uniqueRegions.length > 0) {
                    regionsDropdown.innerHTML = '<option value="">지역 선택</option>';
                    uniqueRegions.forEach(region => {
                        const option = document.createElement('option');
                        option.value = region;
                        option.textContent = region;
                        regionsDropdown.appendChild(option);
                    });
                    console.log(`✅ 지역 드롭다운에 ${uniqueRegions.length}개 옵션 추가됨`);
                }
                
                if (paymentTermsDropdown && uniquePaymentTerms.length > 0) {
                    paymentTermsDropdown.innerHTML = '<option value="">결제조건 선택</option>';
                    uniquePaymentTerms.forEach(term => {
                        const option = document.createElement('option');
                        option.value = term;
                        option.textContent = term;
                        paymentTermsDropdown.appendChild(option);
                    });
                    console.log(`✅ 결제조건 드롭다운에 ${uniquePaymentTerms.length}개 옵션 추가됨`);
                }
                
                if (businessTypesDropdown && uniqueBusinessTypes.length > 0) {
                    businessTypesDropdown.innerHTML = '<option value="">업종 선택</option>';
                    uniqueBusinessTypes.forEach(type => {
                        const option = document.createElement('option');
                        option.value = type;
                        option.textContent = type;
                        businessTypesDropdown.appendChild(option);
                    });
                    console.log(`✅ 업종 드롭다운에 ${uniqueBusinessTypes.length}개 옵션 추가됨`);
                }
                
            } else {
                console.warn('⚠️ 해당 사용자의 업체 데이터가 없습니다');
                console.log('💡 worklog.html에서 addTestData() 함수를 실행하여 테스트 데이터를 추가하세요');
            }
            
        } else {
            console.error('❌ 데이터베이스 연결이 없습니다');
        }
        
    } catch (error) {
        console.error('❌ SETTINGS DEBUG 오류:', error);
    }
    
}, 5000);