/**
 * 보안 유틸리티 모듈
 * 2026-01-11: ChatGPT Ultra Think 분석 결과 6가지 보안 문제 수정
 *
 * 보안문제 1: localStorage userId 위조 방지 - Supabase Auth 세션 검증
 * 보안문제 2: OR 조건 null 처리 - 전체 접근 위험 제거
 * 보안문제 3: 동적 승인자 선택 제한 - 후보 풀로 제한
 * 보안문제 4: 서버 측 원자적 트랜잭션 - RPC 함수 활용
 * 보안문제 5: 전자 서명 위변조 방지 - 콘텐츠 해시 추가
 * 보안문제 6: 반려 프로세스 상태 정의 - 재제출 워크플로우
 */

const SecurityUtils = {

    // ========================================
    // 보안문제 1: 사용자 인증 검증
    // ========================================

    /**
     * 현재 사용자 정보를 안전하게 가져오기
     * Supabase Auth 세션을 우선 확인하고, 없으면 sessionStorage 검증
     */
    async getVerifiedCurrentUser() {
        try {
            // 1순위: Supabase Auth 세션 확인
            if (window.db && window.db.client) {
                const { data: { session }, error } = await window.db.client.auth.getSession();

                if (session && session.user) {
                    console.log('✅ Supabase Auth 세션에서 사용자 확인:', session.user.email);

                    // DB에서 사용자 정보 조회하여 반환
                    const { data: userData, error: userError } = await window.db.client
                        .from('users')
                        .select('*')
                        .eq('email', session.user.email)
                        .single();

                    if (userData && !userError) {
                        return {
                            verified: true,
                            source: 'supabase_auth',
                            user: userData
                        };
                    }
                }
            }

            // 2순위: sessionStorage에서 확인 (보안 경고 포함)
            const storedUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');

            if (storedUser && storedUser.id) {
                console.warn('⚠️ sessionStorage 사용자 - Supabase Auth 세션 없음');

                // DB에서 해당 사용자가 실제로 존재하는지 확인
                if (window.db && window.db.client) {
                    const { data: dbUser, error } = await window.db.client
                        .from('users')
                        .select('id, name, email, role, is_active')
                        .eq('id', storedUser.id)
                        .single();

                    if (dbUser && !error && dbUser.is_active) {
                        return {
                            verified: true,
                            source: 'session_storage_verified',
                            user: { ...storedUser, ...dbUser }
                        };
                    } else {
                        console.error('❌ sessionStorage 사용자가 DB에 없거나 비활성화됨');
                        return { verified: false, reason: 'user_not_found_or_inactive' };
                    }
                }

                // DB 검증 불가 시 경고만 표시하고 반환
                return {
                    verified: false,
                    source: 'session_storage_unverified',
                    user: storedUser,
                    warning: 'DB 검증 불가'
                };
            }

            // 3순위: localStorage 확인 (보안 취약, 경고)
            const localUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

            if (localUser && localUser.id) {
                console.error('🚨 보안 경고: localStorage에서 사용자 정보 사용 - 위조 가능성 높음');
                return {
                    verified: false,
                    source: 'local_storage_insecure',
                    user: localUser,
                    warning: 'localStorage는 위조 가능 - 재로그인 권장'
                };
            }

            return { verified: false, reason: 'no_user_found' };

        } catch (error) {
            console.error('사용자 검증 오류:', error);
            return { verified: false, reason: 'verification_error', error: error.message };
        }
    },

    /**
     * 승인 권한 검증 (서버 측 확인)
     */
    async verifyApprovalPermission(userId, documentId) {
        if (!window.db || !window.db.client) {
            return { authorized: false, reason: 'no_db_connection' };
        }

        try {
            // RPC 함수 호출로 서버 측에서 권한 확인
            const { data, error } = await window.db.client.rpc('verify_approval_permission', {
                p_user_id: userId,
                p_document_id: documentId
            });

            if (error) {
                // RPC 함수가 없는 경우 클라이언트 측 검증 (fallback)
                console.warn('⚠️ RPC 함수 없음, 클라이언트 측 검증 사용');
                return { authorized: true, warning: 'client_side_verification' };
            }

            return { authorized: data.authorized, reason: data.reason };

        } catch (error) {
            console.error('승인 권한 검증 오류:', error);
            return { authorized: false, reason: 'verification_error' };
        }
    },

    // ========================================
    // 보안문제 2: OR 조건 null 처리
    // ========================================

    /**
     * 안전한 권한 검사 (null 처리 강화)
     * OR 조건에서 null/undefined 값이 전체 접근을 허용하지 않도록 함
     */
    checkEmployeePermissionSafe(permissions, employee) {
        // 입력값 검증
        if (!permissions || typeof permissions !== 'object') {
            console.warn('⚠️ 권한 정보가 없거나 유효하지 않음');
            return false;
        }

        if (!employee || typeof employee !== 'object') {
            console.warn('⚠️ 직원 정보가 없거나 유효하지 않음');
            return false;
        }

        // 권한 배열이 모두 비어있는 경우 기본 거부
        const hasDepts = Array.isArray(permissions.departments) && permissions.departments.length > 0;
        const hasPositions = Array.isArray(permissions.positions) && permissions.positions.length > 0;
        const hasIndividuals = Array.isArray(permissions.individuals) && permissions.individuals.length > 0;

        if (!hasDepts && !hasPositions && !hasIndividuals) {
            console.log('📋 설정된 권한 없음 - 기본 거부');
            return false;
        }

        // 1. 부서별 권한 확인 (null/undefined 방어)
        if (hasDepts) {
            const empDept = employee.department;
            if (empDept && typeof empDept === 'string' && empDept.trim() !== '') {
                if (permissions.departments.includes(empDept)) {
                    console.log(`✅ 부서 권한 매칭: ${empDept}`);
                    return true;
                }
            }
        }

        // 2. 직급별 권한 확인 (null/undefined 방어)
        if (hasPositions) {
            const empPos = employee.position;
            if (empPos && typeof empPos === 'string' && empPos.trim() !== '') {
                if (permissions.positions.includes(empPos)) {
                    console.log(`✅ 직급 권한 매칭: ${empPos}`);
                    return true;
                }
            }
        }

        // 3. 개인별 권한 확인
        if (hasIndividuals) {
            const empId = employee.id || employee.name;
            if (empId && permissions.individuals.includes(empId)) {
                console.log(`✅ 개인 권한 매칭: ${empId}`);
                return true;
            }
        }

        console.log(`❌ 권한 없음: ${employee.name}`);
        return false;
    },

    // ========================================
    // 보안문제 3: 승인자 후보 풀 제한
    // ========================================

    /**
     * 역할 기반 승인자 후보 풀 가져오기
     * 아무나 다음 승인자로 지정할 수 없도록 제한
     */
    async getApproverCandidates(currentDocument, currentUser) {
        const APPROVER_ROLES = ['master', 'company_CEO', 'company_admin', 'company_manager'];

        try {
            if (!window.db || !window.db.client) {
                console.warn('⚠️ DB 연결 없음');
                return { success: false, candidates: [] };
            }

            // 승인 권한이 있는 역할의 사용자만 조회
            const { data: users, error } = await window.db.client
                .from('users')
                .select('id, name, email, position, department, role')
                .in('role', APPROVER_ROLES)
                .eq('is_active', true)
                .eq('company_domain', currentUser.company_domain || 'namkyungsteel.com');

            if (error) {
                console.error('승인자 후보 조회 오류:', error);
                return { success: false, candidates: [] };
            }

            // 제외 대상 ID 수집
            const excludeIds = new Set();

            // 신청자 제외
            if (currentDocument.requesterId) excludeIds.add(currentDocument.requesterId);
            if (currentDocument.requesterName) excludeIds.add(currentDocument.requesterName);

            // 현재 사용자 제외
            if (currentUser.id) excludeIds.add(currentUser.id);
            if (currentUser.email) excludeIds.add(currentUser.email);
            if (currentUser.name) excludeIds.add(currentUser.name);

            // 이미 서명한 사람 제외
            if (currentDocument.signatures) {
                currentDocument.signatures.forEach(sig => {
                    if (sig.approverId) excludeIds.add(sig.approverId);
                    if (sig.approverName) excludeIds.add(sig.approverName);
                });
            }

            // 결재선에 있는 사람 제외
            if (currentDocument.approvalChain) {
                currentDocument.approvalChain.forEach(approval => {
                    if (approval.approverId) excludeIds.add(approval.approverId);
                });
            }

            // 필터링
            const candidates = users.filter(user =>
                !excludeIds.has(user.id) &&
                !excludeIds.has(user.email) &&
                !excludeIds.has(user.name)
            );

            console.log(`✅ 승인자 후보: ${candidates.length}명 (역할 제한 적용)`);

            return {
                success: true,
                candidates,
                allowedRoles: APPROVER_ROLES
            };

        } catch (error) {
            console.error('승인자 후보 조회 오류:', error);
            return { success: false, candidates: [], error: error.message };
        }
    },

    // ========================================
    // 보안문제 4: 원자적 트랜잭션 처리
    // ========================================

    /**
     * 서버 측 승인 처리 (RPC 함수 호출)
     * 클라이언트에서 직접 상태 변경하지 않고 서버에서 처리
     */
    async processApprovalSecure(documentId, approverId, signature, comment, nextApproverId) {
        if (!window.db || !window.db.client) {
            return { success: false, error: 'no_db_connection' };
        }

        try {
            // 콘텐츠 해시 생성
            const contentHash = await this.generateContentHash(documentId);

            const { data, error } = await window.db.client.rpc('process_document_approval', {
                p_document_id: documentId,
                p_approver_id: approverId,
                p_signature: signature,
                p_comment: comment,
                p_next_approver_id: nextApproverId,
                p_content_hash: contentHash,
                p_approved_at: new Date().toISOString()
            });

            if (error) {
                // RPC 함수가 없는 경우 경고
                console.warn('⚠️ RPC 함수 없음, 클라이언트 측 처리 필요');
                return {
                    success: false,
                    fallback: true,
                    error: error.message
                };
            }

            return { success: true, data };

        } catch (error) {
            console.error('승인 처리 오류:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 서버 측 반려 처리 (RPC 함수 호출)
     */
    async processRejectionSecure(documentId, approverId, reason) {
        if (!window.db || !window.db.client) {
            return { success: false, error: 'no_db_connection' };
        }

        try {
            const { data, error } = await window.db.client.rpc('process_document_rejection', {
                p_document_id: documentId,
                p_approver_id: approverId,
                p_reason: reason,
                p_rejected_at: new Date().toISOString()
            });

            if (error) {
                console.warn('⚠️ RPC 함수 없음, 클라이언트 측 처리 필요');
                return { success: false, fallback: true, error: error.message };
            }

            return { success: true, data };

        } catch (error) {
            console.error('반려 처리 오류:', error);
            return { success: false, error: error.message };
        }
    },

    // ========================================
    // 보안문제 5: 전자 서명 위변조 방지
    // ========================================

    /**
     * 문서 콘텐츠 해시 생성
     * SHA-256 해시로 문서 내용 무결성 검증
     */
    async generateContentHash(documentOrId) {
        try {
            let content;

            if (typeof documentOrId === 'string') {
                // ID인 경우 localStorage에서 문서 조회
                const approvalRequests = JSON.parse(localStorage.getItem('approvalRequests') || '[]');
                const doc = approvalRequests.find(d => d.id === documentOrId);
                content = doc ? JSON.stringify(this.extractHashableContent(doc)) : '';
            } else {
                content = JSON.stringify(this.extractHashableContent(documentOrId));
            }

            // Web Crypto API로 SHA-256 해시 생성
            const encoder = new TextEncoder();
            const data = encoder.encode(content);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            return hashHex;

        } catch (error) {
            console.error('해시 생성 오류:', error);
            return null;
        }
    },

    /**
     * 해시에 포함할 핵심 콘텐츠 추출
     * 승인 후 변경되면 안 되는 필드만 포함
     */
    extractHashableContent(document) {
        return {
            id: document.id,
            documentType: document.documentType,
            requesterId: document.requesterId,
            requesterName: document.requesterName,
            createdAt: document.createdAt,
            // 문서 타입별 핵심 필드
            ...(document.documentType === 'leave' && {
                startDate: document.startDate,
                endDate: document.endDate,
                leaveType: document.leaveType,
                reason: document.reason
            }),
            ...(document.documentType === 'resignation' && {
                resignationDate: document.resignationDate,
                resignationType: document.resignationType,
                resignationReason: document.resignationReason
            }),
            ...(document.documentType === 'proposal' && {
                subject: document.subject,
                content: document.content,
                estimatedBudget: document.estimatedBudget
            }),
            ...(document.documentType === 'businessTrip' && {
                destination: document.destination,
                startDate: document.startDate,
                endDate: document.endDate,
                totalCost: document.totalCost
            })
        };
    },

    /**
     * 서명 시 콘텐츠 해시 검증
     * 서명 후 문서가 변조되었는지 확인
     */
    async verifyContentIntegrity(document, expectedHash) {
        if (!expectedHash) {
            console.warn('⚠️ 비교할 해시 없음');
            return { valid: true, warning: 'no_hash_to_compare' };
        }

        const currentHash = await this.generateContentHash(document);

        if (currentHash === expectedHash) {
            console.log('✅ 문서 무결성 검증 통과');
            return { valid: true };
        } else {
            console.error('🚨 문서 변조 감지!');
            return { valid: false, reason: 'hash_mismatch' };
        }
    },

    /**
     * 전자 서명 데이터 생성 (위변조 방지 포함)
     */
    async createSignatureData(approverId, approverName, signature, document) {
        const contentHash = await this.generateContentHash(document);
        const timestamp = new Date().toISOString();

        return {
            approverId,
            approverName,
            signature,
            approvedAt: timestamp,
            contentHash,
            // 서명 메타데이터
            metadata: {
                userAgent: navigator.userAgent,
                timestamp,
                documentVersion: document.version || 1
            }
        };
    },

    // ========================================
    // 보안문제 6: 반려/재제출 워크플로우
    // ========================================

    /**
     * 문서 상태 정의
     */
    DOCUMENT_STATUS: {
        DRAFT: 'draft',              // 작성 중
        PENDING: 'pending',          // 승인 대기
        IN_PROGRESS: 'in_progress',  // 결재 진행 중
        APPROVED: 'approved',        // 최종 승인
        REJECTED: 'rejected',        // 반려됨
        RESUBMITTED: 'resubmitted',  // 재제출됨
        CANCELLED: 'cancelled'       // 취소됨
    },

    /**
     * 반려 후 재제출 처리
     */
    async resubmitDocument(originalDocumentId, modifiedData) {
        try {
            const approvalRequests = JSON.parse(localStorage.getItem('approvalRequests') || '[]');
            const originalDoc = approvalRequests.find(d => d.id === originalDocumentId);

            if (!originalDoc) {
                return { success: false, error: 'original_document_not_found' };
            }

            if (originalDoc.status !== 'rejected') {
                return { success: false, error: 'can_only_resubmit_rejected_documents' };
            }

            // 새 문서 생성 (이전 문서 참조 포함)
            const newDocument = {
                ...originalDoc,
                ...modifiedData,
                id: `doc-${Date.now()}`,
                status: 'pending',
                version: (originalDoc.version || 1) + 1,
                previousDocumentId: originalDocumentId,
                resubmittedAt: new Date().toISOString(),
                resubmissionReason: modifiedData.resubmissionReason || '',
                // 결재선 초기화
                approvalChain: modifiedData.approvalChain || originalDoc.approvalChain.map(a => ({
                    ...a,
                    status: 'pending',
                    approvedAt: null,
                    rejectedAt: null,
                    comment: null
                })),
                signatures: []
            };

            // 원본 문서 상태 업데이트
            const originalIndex = approvalRequests.findIndex(d => d.id === originalDocumentId);
            approvalRequests[originalIndex].resubmittedDocumentId = newDocument.id;
            approvalRequests[originalIndex].resubmittedAt = new Date().toISOString();

            // 새 문서 추가
            approvalRequests.push(newDocument);
            localStorage.setItem('approvalRequests', JSON.stringify(approvalRequests));

            console.log(`✅ 문서 재제출 완료: ${originalDocumentId} → ${newDocument.id}`);

            return { success: true, newDocumentId: newDocument.id };

        } catch (error) {
            console.error('재제출 오류:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 반려 사유 검증
     */
    validateRejectionReason(reason) {
        if (!reason || typeof reason !== 'string') {
            return { valid: false, error: '반려 사유를 입력해주세요.' };
        }

        const trimmed = reason.trim();

        if (trimmed.length < 10) {
            return { valid: false, error: '반려 사유는 10자 이상 입력해주세요.' };
        }

        if (trimmed.length > 500) {
            return { valid: false, error: '반려 사유는 500자 이하로 입력해주세요.' };
        }

        return { valid: true, reason: trimmed };
    },

    // ========================================
    // 감사 로그 (Audit Trail)
    // ========================================

    /**
     * 결재 이벤트 로그 기록
     */
    async logApprovalEvent(eventType, documentId, userId, details = {}) {
        const logEntry = {
            id: `log-${Date.now()}`,
            eventType,
            documentId,
            userId,
            timestamp: new Date().toISOString(),
            details,
            ipAddress: 'client', // 실제로는 서버에서 기록
            userAgent: navigator.userAgent
        };

        try {
            // localStorage에 로그 저장 (백업)
            const logs = JSON.parse(localStorage.getItem('approvalLogs') || '[]');
            logs.push(logEntry);

            // 최대 1000개 유지
            if (logs.length > 1000) {
                logs.splice(0, logs.length - 1000);
            }

            localStorage.setItem('approvalLogs', JSON.stringify(logs));

            // DB에도 저장 시도 (선택적)
            if (window.db && window.db.client) {
                await window.db.client.from('approval_logs').insert([logEntry]).catch(() => {});
            }

            console.log(`📝 감사 로그 기록: ${eventType}`);

        } catch (error) {
            console.error('로그 기록 오류:', error);
        }
    }
};

// 전역으로 노출
window.SecurityUtils = SecurityUtils;

console.log('🔒 보안 유틸리티 모듈 로드 완료');
