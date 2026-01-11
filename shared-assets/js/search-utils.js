/**
 * =========================================
 * 통합 검색 유틸리티 (ChatGPT + Claude 협업)
 * 작성일: 2026-01-11
 * PostgreSQL FTS + Supabase RPC 연동
 * =========================================
 */

// 검색 유틸리티 객체
const SearchUtils = {
    // 디바운스 타이머
    debounceTimer: null,

    // 캐시 (자동완성용)
    cache: new Map(),
    cacheExpiry: 60000, // 1분

    // 현재 검색 상태
    currentQuery: '',
    isSearching: false,

    /**
     * 통합 검색 실행
     * @param {string} query - 검색어
     * @param {Object} options - 옵션
     * @returns {Promise<Array>} 검색 결과
     */
    async search(query, options = {}) {
        const {
            sourceTypes = null,  // ['user', 'document', 'company', 'worklog'] 또는 null (전체)
            limit = 20,
            offset = 0
        } = options;

        // 빈 검색어 체크
        if (!query || query.trim().length < 1) {
            return { results: [], total: 0 };
        }

        try {
            this.isSearching = true;
            this.currentQuery = query;

            // 현재 사용자 정보 가져오기
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('로그인이 필요합니다.');
            }

            // Supabase RPC 호출
            const { data, error } = await window.supabase.rpc('unified_search', {
                p_query: query.trim(),
                p_user_id: user.id,
                p_company_domain: user.company_domain,
                p_source_types: sourceTypes,
                p_limit: limit,
                p_offset: offset
            });

            if (error) {
                console.error('검색 오류:', error);
                throw error;
            }

            // 결과 가공
            const results = (data || []).map(item => ({
                ...item,
                // 하이라이트 처리
                titleHighlight: this.highlightText(item.title, query),
                contentHighlight: this.highlightText(item.content_preview, query),
                // 소스 타입 한글 변환
                sourceTypeKorean: this.getSourceTypeKorean(item.source_type),
                // 아이콘
                icon: this.getSourceIcon(item.source_type),
                // 링크 생성
                link: this.generateLink(item.source_type, item.source_id)
            }));

            return {
                results,
                total: results.length,
                query,
                hasMore: results.length === limit
            };

        } catch (error) {
            console.error('검색 실행 오류:', error);
            throw error;
        } finally {
            this.isSearching = false;
        }
    },

    /**
     * 자동완성 검색
     * @param {string} query - 검색어
     * @param {number} limit - 결과 수
     * @returns {Promise<Array>} 자동완성 결과
     */
    async autocomplete(query, limit = 10) {
        // 최소 2글자 이상
        if (!query || query.trim().length < 2) {
            return [];
        }

        // 캐시 확인
        const cacheKey = `ac_${query.trim().toLowerCase()}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const user = await this.getCurrentUser();
            if (!user) return [];

            const { data, error } = await window.supabase.rpc('search_autocomplete', {
                p_query: query.trim(),
                p_user_id: user.id,
                p_company_domain: user.company_domain,
                p_limit: limit
            });

            if (error) {
                console.error('자동완성 오류:', error);
                return [];
            }

            const results = (data || []).map(item => ({
                suggestion: item.suggestion,
                sourceType: item.source_type,
                sourceId: item.source_id,
                icon: this.getSourceIcon(item.source_type)
            }));

            // 캐시 저장
            this.cache.set(cacheKey, {
                data: results,
                timestamp: Date.now()
            });

            return results;

        } catch (error) {
            console.error('자동완성 실행 오류:', error);
            return [];
        }
    },

    /**
     * 디바운스 검색 (입력 중 검색용)
     * @param {string} query - 검색어
     * @param {Function} callback - 콜백 함수
     * @param {number} delay - 지연 시간 (ms)
     */
    debounceSearch(query, callback, delay = 300) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
            const results = await this.autocomplete(query);
            callback(results);
        }, delay);
    },

    /**
     * 검색어 하이라이트
     * @param {string} text - 원본 텍스트
     * @param {string} query - 검색어
     * @returns {string} 하이라이트된 HTML
     */
    highlightText(text, query) {
        if (!text || !query) return text || '';

        const words = query.trim().split(/\s+/);
        let result = this.escapeHtml(text);

        words.forEach(word => {
            if (word.length > 0) {
                const regex = new RegExp(`(${this.escapeRegex(word)})`, 'gi');
                result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
            }
        });

        return result;
    },

    /**
     * HTML 이스케이프
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 정규식 특수문자 이스케이프
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * 소스 타입 한글 변환
     */
    getSourceTypeKorean(sourceType) {
        const types = {
            'user': '사용자',
            'document': '문서',
            'company': '거래처',
            'worklog': '업무일지',
            'notification': '알림'
        };
        return types[sourceType] || sourceType;
    },

    /**
     * 소스 타입별 아이콘
     */
    getSourceIcon(sourceType) {
        const icons = {
            'user': 'fa-user',
            'document': 'fa-file-alt',
            'company': 'fa-building',
            'worklog': 'fa-clipboard-list',
            'notification': 'fa-bell'
        };
        return icons[sourceType] || 'fa-search';
    },

    /**
     * 상세 페이지 링크 생성
     */
    generateLink(sourceType, sourceId) {
        const links = {
            'user': `/member-detail.html?id=${sourceId}`,
            'document': `/document-detail.html?id=${sourceId}`,
            'company': `/company-detail.html?id=${sourceId}`,
            'worklog': `/worklog-detail.html?id=${sourceId}`,
            'notification': `/notifications.html?id=${sourceId}`
        };
        return links[sourceType] || '#';
    },

    /**
     * 현재 사용자 정보 가져오기
     */
    async getCurrentUser() {
        // 캐시된 사용자 정보 확인
        if (window.currentUser) {
            return window.currentUser;
        }

        // Supabase 세션에서 가져오기
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session?.user) return null;

        // users 테이블에서 상세 정보 조회
        const { data: userData } = await window.supabase
            .from('users')
            .select('id, name, email, company_domain, role')
            .eq('email', session.user.email)
            .single();

        if (userData) {
            window.currentUser = userData;
        }

        return userData;
    },

    /**
     * 검색 인덱스 재구축 (관리자 전용)
     */
    async rebuildIndex() {
        try {
            const { data, error } = await window.supabase.rpc('rebuild_search_index');

            if (error) throw error;

            return {
                success: true,
                message: data
            };
        } catch (error) {
            console.error('인덱스 재구축 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * 캐시 초기화
     */
    clearCache() {
        this.cache.clear();
    }
};

// 검색 UI 컨트롤러
const SearchUI = {
    // DOM 요소
    elements: {
        searchInput: null,
        searchButton: null,
        resultsContainer: null,
        autocompleteDropdown: null,
        loadingIndicator: null,
        filterButtons: null
    },

    // 현재 필터
    currentFilter: null,

    /**
     * 검색 UI 초기화
     * @param {Object} selectors - DOM 선택자
     */
    init(selectors = {}) {
        const {
            searchInput = '#search-input',
            searchButton = '#search-button',
            resultsContainer = '#search-results',
            autocompleteDropdown = '#search-autocomplete',
            loadingIndicator = '#search-loading',
            filterButtons = '.search-filter-btn'
        } = selectors;

        // DOM 요소 캐싱
        this.elements.searchInput = document.querySelector(searchInput);
        this.elements.searchButton = document.querySelector(searchButton);
        this.elements.resultsContainer = document.querySelector(resultsContainer);
        this.elements.autocompleteDropdown = document.querySelector(autocompleteDropdown);
        this.elements.loadingIndicator = document.querySelector(loadingIndicator);
        this.elements.filterButtons = document.querySelectorAll(filterButtons);

        // 이벤트 바인딩
        this.bindEvents();

        console.log('SearchUI 초기화 완료');
    },

    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        // 검색 입력 이벤트
        if (this.elements.searchInput) {
            // 입력 시 자동완성
            this.elements.searchInput.addEventListener('input', (e) => {
                const query = e.target.value;
                SearchUtils.debounceSearch(query, (results) => {
                    this.renderAutocomplete(results);
                });
            });

            // Enter 키로 검색
            this.elements.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.performSearch();
                }
            });

            // 포커스 아웃 시 자동완성 닫기
            this.elements.searchInput.addEventListener('blur', () => {
                setTimeout(() => this.hideAutocomplete(), 200);
            });
        }

        // 검색 버튼 클릭
        if (this.elements.searchButton) {
            this.elements.searchButton.addEventListener('click', () => {
                this.performSearch();
            });
        }

        // 필터 버튼
        this.elements.filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.setFilter(filter);
                this.performSearch();
            });
        });
    },

    /**
     * 검색 실행
     */
    async performSearch() {
        const query = this.elements.searchInput?.value?.trim();

        if (!query) {
            this.showMessage('검색어를 입력하세요.');
            return;
        }

        this.showLoading();
        this.hideAutocomplete();

        try {
            const sourceTypes = this.currentFilter ? [this.currentFilter] : null;
            const result = await SearchUtils.search(query, { sourceTypes });
            this.renderResults(result);
        } catch (error) {
            this.showError('검색 중 오류가 발생했습니다.');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * 필터 설정
     */
    setFilter(filter) {
        this.currentFilter = filter === 'all' ? null : filter;

        // 버튼 활성화 상태 업데이트
        this.elements.filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
    },

    /**
     * 자동완성 렌더링
     */
    renderAutocomplete(results) {
        if (!this.elements.autocompleteDropdown) return;

        if (!results || results.length === 0) {
            this.hideAutocomplete();
            return;
        }

        const html = results.map(item => `
            <div class="autocomplete-item" data-type="${item.sourceType}" data-id="${item.sourceId}">
                <i class="fas ${item.icon} me-2 text-secondary"></i>
                <span>${SearchUtils.escapeHtml(item.suggestion)}</span>
                <small class="text-muted ms-auto">${SearchUtils.getSourceTypeKorean(item.sourceType)}</small>
            </div>
        `).join('');

        this.elements.autocompleteDropdown.innerHTML = html;
        this.elements.autocompleteDropdown.style.display = 'block';

        // 자동완성 항목 클릭 이벤트
        this.elements.autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                this.elements.searchInput.value = item.querySelector('span').textContent;
                this.hideAutocomplete();
                this.performSearch();
            });
        });
    },

    /**
     * 검색 결과 렌더링
     */
    renderResults(result) {
        if (!this.elements.resultsContainer) return;

        const { results, total, query } = result;

        if (results.length === 0) {
            this.elements.resultsContainer.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <h5>검색 결과가 없습니다</h5>
                    <p class="text-muted">"${SearchUtils.escapeHtml(query)}"에 대한 검색 결과가 없습니다.</p>
                </div>
            `;
            return;
        }

        const html = `
            <div class="search-results-header mb-3">
                <span class="text-muted">
                    "<strong>${SearchUtils.escapeHtml(query)}</strong>" 검색 결과:
                    <strong>${total}</strong>건
                </span>
            </div>
            <div class="search-results-list">
                ${results.map(item => this.renderResultItem(item)).join('')}
            </div>
        `;

        this.elements.resultsContainer.innerHTML = html;

        // 결과 항목 클릭 이벤트
        this.elements.resultsContainer.querySelectorAll('.search-result-item').forEach(itemEl => {
            itemEl.addEventListener('click', () => {
                const link = itemEl.dataset.link;
                if (link && link !== '#') {
                    window.location.href = link;
                }
            });
        });
    },

    /**
     * 단일 결과 항목 렌더링
     */
    renderResultItem(item) {
        return `
            <div class="search-result-item card mb-2" data-link="${item.link}" style="cursor: pointer;">
                <div class="card-body py-3">
                    <div class="d-flex align-items-start">
                        <div class="search-result-icon me-3">
                            <i class="fas ${item.icon} fa-lg text-primary"></i>
                        </div>
                        <div class="search-result-content flex-grow-1">
                            <div class="d-flex align-items-center mb-1">
                                <span class="badge bg-secondary me-2">${item.sourceTypeKorean}</span>
                                <h6 class="mb-0">${item.titleHighlight}</h6>
                            </div>
                            <p class="text-muted small mb-1">${item.contentHighlight}</p>
                            ${item.tags && item.tags.length > 0 ? `
                                <div class="search-result-tags">
                                    ${item.tags.filter(t => t).map(tag =>
                                        `<span class="badge bg-light text-dark me-1">${SearchUtils.escapeHtml(tag)}</span>`
                                    ).join('')}
                                </div>
                            ` : ''}
                        </div>
                        <div class="search-result-meta text-end">
                            <small class="text-muted">
                                ${new Date(item.created_at).toLocaleDateString('ko-KR')}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 자동완성 숨기기
     */
    hideAutocomplete() {
        if (this.elements.autocompleteDropdown) {
            this.elements.autocompleteDropdown.style.display = 'none';
        }
    },

    /**
     * 로딩 표시
     */
    showLoading() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'block';
        }
        if (this.elements.resultsContainer) {
            this.elements.resultsContainer.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">검색 중...</span>
                    </div>
                    <p class="text-muted mt-2">검색 중...</p>
                </div>
            `;
        }
    },

    /**
     * 로딩 숨기기
     */
    hideLoading() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'none';
        }
    },

    /**
     * 메시지 표시
     */
    showMessage(message) {
        if (this.elements.resultsContainer) {
            this.elements.resultsContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    ${message}
                </div>
            `;
        }
    },

    /**
     * 에러 표시
     */
    showError(message) {
        if (this.elements.resultsContainer) {
            this.elements.resultsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    ${message}
                </div>
            `;
        }
    }
};

// 전역 검색 모달 컨트롤러
const GlobalSearch = {
    modalElement: null,
    isOpen: false,

    /**
     * 전역 검색 모달 초기화
     */
    init() {
        this.createModal();
        this.bindShortcuts();
    },

    /**
     * 모달 DOM 생성
     */
    createModal() {
        const modalHtml = `
            <div class="modal fade" id="globalSearchModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header border-0 pb-0">
                            <div class="input-group">
                                <span class="input-group-text bg-transparent border-0">
                                    <i class="fas fa-search text-muted"></i>
                                </span>
                                <input type="text"
                                       class="form-control border-0 shadow-none fs-5"
                                       id="global-search-input"
                                       placeholder="검색어를 입력하세요... (Ctrl+K)"
                                       autocomplete="off">
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body pt-0">
                            <!-- 필터 버튼 -->
                            <div class="search-filters mb-3 border-bottom pb-2">
                                <button class="btn btn-sm btn-outline-secondary search-filter-btn active" data-filter="all">
                                    전체
                                </button>
                                <button class="btn btn-sm btn-outline-secondary search-filter-btn" data-filter="user">
                                    <i class="fas fa-user me-1"></i>사용자
                                </button>
                                <button class="btn btn-sm btn-outline-secondary search-filter-btn" data-filter="document">
                                    <i class="fas fa-file-alt me-1"></i>문서
                                </button>
                                <button class="btn btn-sm btn-outline-secondary search-filter-btn" data-filter="company">
                                    <i class="fas fa-building me-1"></i>거래처
                                </button>
                                <button class="btn btn-sm btn-outline-secondary search-filter-btn" data-filter="worklog">
                                    <i class="fas fa-clipboard-list me-1"></i>업무일지
                                </button>
                            </div>

                            <!-- 자동완성 드롭다운 -->
                            <div id="global-search-autocomplete" class="list-group mb-3" style="display: none;"></div>

                            <!-- 검색 결과 -->
                            <div id="global-search-results">
                                <div class="text-center py-4 text-muted">
                                    <i class="fas fa-search fa-2x mb-2"></i>
                                    <p>검색어를 입력하세요</p>
                                    <small>사용자, 문서, 거래처, 업무일지를 통합 검색합니다</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 기존 모달 제거
        const existingModal = document.getElementById('globalSearchModal');
        if (existingModal) existingModal.remove();

        // 새 모달 추가
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        this.modalElement = new bootstrap.Modal(document.getElementById('globalSearchModal'));

        // SearchUI 초기화 (모달용)
        SearchUI.init({
            searchInput: '#global-search-input',
            resultsContainer: '#global-search-results',
            autocompleteDropdown: '#global-search-autocomplete',
            filterButtons: '#globalSearchModal .search-filter-btn'
        });

        // 모달 열릴 때 포커스
        document.getElementById('globalSearchModal').addEventListener('shown.bs.modal', () => {
            document.getElementById('global-search-input').focus();
            this.isOpen = true;
        });

        document.getElementById('globalSearchModal').addEventListener('hidden.bs.modal', () => {
            this.isOpen = false;
        });
    },

    /**
     * 키보드 단축키 바인딩
     */
    bindShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K 또는 Cmd+K로 검색 모달 열기
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }

            // ESC로 닫기
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    },

    /**
     * 모달 열기
     */
    open() {
        if (this.modalElement) {
            this.modalElement.show();
        }
    },

    /**
     * 모달 닫기
     */
    close() {
        if (this.modalElement) {
            this.modalElement.hide();
        }
    },

    /**
     * 토글
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
};

// CSS 스타일 추가
const searchStyles = `
<style>
/* 검색 하이라이트 */
.search-highlight {
    background-color: #fff3cd;
    padding: 0 2px;
    border-radius: 2px;
}

/* 자동완성 드롭다운 */
.autocomplete-item {
    display: flex;
    align-items: center;
    padding: 10px 15px;
    cursor: pointer;
    border-bottom: 1px solid #eee;
}

.autocomplete-item:hover {
    background-color: #f8f9fa;
}

.autocomplete-item:last-child {
    border-bottom: none;
}

/* 검색 결과 항목 */
.search-result-item {
    transition: all 0.2s ease;
}

.search-result-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.search-result-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
    border-radius: 8px;
}

/* 필터 버튼 */
.search-filters .btn {
    margin-right: 5px;
    margin-bottom: 5px;
}

.search-filters .btn.active {
    background-color: #0d6efd;
    color: white;
    border-color: #0d6efd;
}

/* 전역 검색 모달 */
#globalSearchModal .modal-content {
    border-radius: 12px;
}

#globalSearchModal .modal-header {
    padding: 1rem 1.5rem;
}

#globalSearchModal .form-control:focus {
    box-shadow: none;
}
</style>
`;

// 스타일 주입
document.head.insertAdjacentHTML('beforeend', searchStyles);

// 전역 객체로 내보내기
window.SearchUtils = SearchUtils;
window.SearchUI = SearchUI;
window.GlobalSearch = GlobalSearch;

// DOMContentLoaded 시 전역 검색 초기화
document.addEventListener('DOMContentLoaded', () => {
    // Bootstrap이 로드된 경우에만 전역 검색 모달 초기화
    if (typeof bootstrap !== 'undefined') {
        GlobalSearch.init();
        console.log('GlobalSearch 초기화 완료 - Ctrl+K로 검색');
    }
});

console.log('search-utils.js 로드 완료');
