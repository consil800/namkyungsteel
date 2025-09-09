// 업체 관계도 네트워크 차트 JavaScript
console.log('company-network.js 로드됨');

// 전역 변수
let currentUser = null;
let centerCompany = null;
let allCompanies = []; // 등록된 모든 업체 목록
let networkData = {
    nodes: [],
    links: []
};
let svg = null;
let simulation = null;
let zoom = null;
let g = null; // 메인 그래프 그룹

// 네트워크 상태
let selectedNode = null;
let isDragging = false;

// 그리드 시스템 설정
const GRID_SIZE = 21; // 21x21 그리드
const GRID_SPACING = 80; // 80픽셀 간격 (보기 편한 거리)
let gridData = [];
let showGrid = false; // 그리드 표시 여부
let gridGroup = null; // 그리드 SVG 그룹

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📊 업체 관계도 페이지 로드 시작');
    
    try {
        // 데이터베이스 초기화 대기
        await waitForDatabase();
        
        // 사용자 인증 확인
        await checkAuthentication();
        
        // URL 파라미터에서 업체 정보 가져오기
        await loadCompanyFromUrl();
        
        // 등록된 업체 목록 로드
        await loadAllCompanies();
        
        // 네트워크 차트 초기화
        initNetworkChart();
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 기존 관계도 로드 (있다면)
        await loadExistingNetwork();
        
        console.log('✅ 업체 관계도 페이지 초기화 완료');
        
    } catch (error) {
        console.error('❌ 업체 관계도 페이지 초기화 오류:', error);
        showToast('페이지 초기화 중 오류가 발생했습니다.', 'error');
    }
});

// 데이터베이스 초기화 대기
async function waitForDatabase() {
    let retryCount = 0;
    while ((!window.db || !window.db.client) && retryCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
    }
    
    if (!window.db || !window.db.client) {
        throw new Error('데이터베이스 초기화 실패');
    }
    
    console.log('✅ 데이터베이스 초기화 완료');
}

// 사용자 인증 확인
async function checkAuthentication() {
    try {
        const userJson = sessionStorage.getItem('currentUser');
        currentUser = userJson ? JSON.parse(userJson) : null;
    } catch (error) {
        console.error('사용자 정보 파싱 오류:', error);
        currentUser = null;
    }
    
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        window.location.href = 'login.html';
        throw new Error('인증 실패');
    }
    
    console.log('✅ 사용자 인증 완료:', currentUser.name);
}

// URL에서 업체 정보 로드
async function loadCompanyFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('id');
    const companyName = urlParams.get('name');
    
    if (!companyId || !companyName) {
        alert('업체 정보가 없습니다.');
        window.location.href = 'worklog.html';
        throw new Error('업체 정보 없음');
    }
    
    centerCompany = {
        id: parseInt(companyId),
        name: decodeURIComponent(companyName)
    };
    
    // 페이지 제목 설정
    document.getElementById('companyName').textContent = centerCompany.name;
    console.log('✅ 중심 업체 설정:', centerCompany);
}

// 등록된 모든 업체 목록 로드 (캐시 활용)
async function loadAllCompanies() {
    try {
        // cachedDataLoader를 통해 업체 목록 로드
        allCompanies = await window.cachedDataLoader.loadCompanies(currentUser.id);
        console.log('✅ 업체 목록 캐시 로드 완료:', allCompanies.length, '개');
    } catch (error) {
        console.error('❌ 업체 목록 로드 실패:', error);
        allCompanies = [];
    }
}

// 네트워크 차트 초기화
function initNetworkChart() {
    console.log('📊 네트워크 차트 초기화 시작');
    
    const container = document.querySelector('.network-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // SVG 초기화
    svg = d3.select('#networkSvg')
        .attr('width', width)
        .attr('height', height);
    
    // 화살표 마커 정의
    svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#666');
    
    // 줌 설정
    zoom = d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', handleZoom);
    
    svg.call(zoom);
    
    // 메인 그래프 그룹
    g = svg.append('g');
    
    // 화면 크기에 따른 시뮬레이션 조정
    const isMobile = width < 768;
    const linkDistance = isMobile ? 150 : 250;  // 모바일에서는 좀 더 가깝게
    const chargeStrength = isMobile ? -300 : -500;  // PC에서 더 강한 반발력
    const collisionRadius = isMobile ? 60 : 90;  // PC에서 더 큰 충돌 반경
    
    // 시뮬레이션 초기화 (화면 크기에 따라 조정)
    simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(linkDistance))
        .force('charge', d3.forceManyBody().strength(chargeStrength))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(collisionRadius))
    
    // 그리드 시스템 먼저 초기화
    initializeGrid();
    
    // 중심 업체 노드 추가
    addCenterCompany();
    
    // 로딩 메시지 숨기기
    document.getElementById('loadingMessage').style.display = 'none';
    
    console.log('✅ 네트워크 차트 초기화 완료');
}

// 중심 업체 노드 추가
function addCenterCompany() {
    const width = svg.attr('width');
    const height = svg.attr('height');
    
    // 화면 중심을 가장 가까운 그리드 포인트에 스냅
    const centerX = width / 2;
    const centerY = height / 2;
    const centerGridPoint = findClosestGrid(centerX, centerY);
    
    // 그리드 포인트가 없는 경우 기본 중심점 사용
    const finalPosition = centerGridPoint ? centerGridPoint : { x: centerX, y: centerY };
    
    const centerNode = {
        id: `company_${centerCompany.id}`,
        name: centerCompany.name,
        type: 'center',
        color: '#e74c3c',
        size: 'large',
        isRegistered: true,
        companyId: centerCompany.id,
        x: finalPosition.x,
        y: finalPosition.y,
        fx: finalPosition.x, // 중심 고정
        fy: finalPosition.y  // 중심 고정
    };
    
    networkData.nodes.push(centerNode);
    updateChart();
    
    // 그리드 점유 상태 업데이트
    updateGridOccupancy();
    
    console.log('✅ 중심 업체 노드 추가:', centerNode.name, `그리드 위치: (${centerGridPoint.x}, ${centerGridPoint.y})`);
}

// 그리드 시스템 초기화
function initializeGrid() {
    const width = svg.attr('width');
    const height = svg.attr('height');
    
    // 그리드 중심점 계산
    const centerX = width / 2;
    const centerY = height / 2;
    
    // 그리드 시작점 계산 (21x21이므로 중심에서 10칸씩)
    const startX = centerX - (GRID_SIZE - 1) / 2 * GRID_SPACING;
    const startY = centerY - (GRID_SIZE - 1) / 2 * GRID_SPACING;
    
    // 그리드 데이터 생성
    gridData = [];
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
            gridData.push({
                x: startX + i * GRID_SPACING,
                y: startY + j * GRID_SPACING,
                occupied: false
            });
        }
    }
    
    // 중심점 그리드 점유
    const centerGridIndex = Math.floor(GRID_SIZE / 2) * GRID_SIZE + Math.floor(GRID_SIZE / 2);
    if (gridData[centerGridIndex]) {
        gridData[centerGridIndex].occupied = true;
    }
    
    // 그리드 그룹 생성 (디버깅용 - 나중에 숨김 처리)
    gridGroup = g.append('g').attr('class', 'grid-group');
    
    console.log('✅ 그리드 시스템 초기화 완료:', GRID_SIZE + 'x' + GRID_SIZE, '간격:', GRID_SPACING + 'px');
}

// 가장 가까운 그리드 포인트 찾기
function snapToGrid(x, y) {
    // 그리드 데이터가 없으면 원래 위치 반환
    if (!gridData || gridData.length === 0) {
        console.warn('⚠️ 그리드 데이터가 없어 스냅 불가');
        return { x: x, y: y };
    }
    
    let minDistance = Infinity;
    let closestPoint = { x: x, y: y };
    
    for (const point of gridData) {
        if (!point.occupied) {
            const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = { x: point.x, y: point.y };
            }
        }
    }
    
    return closestPoint;
}

// 그리드 점유 상태 업데이트
function updateGridOccupancy() {
    // 모든 그리드 점을 비점유로 초기화 (중심점 제외)
    const centerGridIndex = Math.floor(GRID_SIZE / 2) * GRID_SIZE + Math.floor(GRID_SIZE / 2);
    gridData.forEach((point, index) => {
        point.occupied = (index === centerGridIndex); // 중심점만 점유
    });
    
    // 현재 노드들이 점유하는 그리드 점 표시
    networkData.nodes.forEach(node => {
        const closestGrid = findClosestGrid(node.x, node.y);
        if (closestGrid) {
            closestGrid.occupied = true;
        }
    });
}

// 가장 가까운 그리드 포인트 찾기 (점유 상관없이)
function findClosestGrid(x, y) {
    // 그리드 데이터가 없으면 null 반환
    if (!gridData || gridData.length === 0) {
        console.warn('⚠️ 그리드 데이터가 없습니다.');
        return null;
    }
    
    let minDistance = Infinity;
    let closestGrid = null;
    
    for (const point of gridData) {
        const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
        if (distance < minDistance) {
            minDistance = distance;
            closestGrid = point;
        }
    }
    
    return closestGrid;
}

// 그리드 표시 토글 (디버깅용)
function toggleGrid() {
    showGrid = !showGrid;
    if (showGrid) {
        showGridPoints();
    } else {
        hideGridPoints();
    }
}

// 그리드 포인트 표시 (디버깅용)
function showGridPoints() {
    gridGroup.selectAll('.grid-point').remove();
    
    gridGroup.selectAll('.grid-point')
        .data(gridData)
        .enter()
        .append('circle')
        .attr('class', 'grid-point')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', 2)
        .attr('fill', d => d.occupied ? '#ff4444' : '#cccccc')
        .attr('opacity', 0.3);
}

// 그리드 포인트 숨기기
function hideGridPoints() {
    gridGroup.selectAll('.grid-point').remove();
}

// 드래그 시작
function dragStart(event, d) {
    isDragging = true;
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
    
    // 그리드 점유 상태 업데이트
    updateGridOccupancy();
}

// 드래그 중
function dragging(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

// 드래그 종료 (그리드에 스냅)
function dragEnd(event, d) {
    isDragging = false;
    if (!event.active) simulation.alphaTarget(0);
    
    // 그리드에 스냅
    const snapPoint = snapToGrid(d.x, d.y);
    d.fx = snapPoint.x;
    d.fy = snapPoint.y;
    
    // 그리드 점유 상태 업데이트
    updateGridOccupancy();
    
    console.log(`📍 ${d.name} 노드가 그리드 포인트 (${snapPoint.x}, ${snapPoint.y})에 스냅됨`);
}

// 노드 클릭 핸들러
function nodeClick(event, d) {
    if (isDragging) return; // 드래그 중이면 클릭 무시
    
    event.stopPropagation();
    selectedNode = d;
    
    // 모든 노드 선택 해제 후 현재 노드만 선택
    g.selectAll('.company-node').classed('selected', false);
    d3.select(this).classed('selected', true);
    
    // 관계 추가 폼 업데이트
    updateRelationshipForm();
    
    console.log('노드 선택됨:', d.name);
}

// 노드 더블클릭 핸들러
function nodeDoubleClick(event, d) {
    if (d.type === 'center') return; // 중심 업체는 삭제 불가
    
    if (confirm(`"${d.name}" 노드를 삭제하시겠습니까?`)) {
        // 관련 링크들 제거
        networkData.links = networkData.links.filter(
            link => link.source.id !== d.id && link.target.id !== d.id
        );
        
        // 노드 제거
        networkData.nodes = networkData.nodes.filter(node => node.id !== d.id);
        
        updateChart();
        showToast(`"${d.name}" 노드가 삭제되었습니다.`, 'success');
        
        // 그리드 점유 상태 업데이트
        updateGridOccupancy();
    }
}

// 줌 핸들러
function handleZoom(event) {
    g.attr('transform', event.transform);
}

// 차트 업데이트
function updateChart() {
    console.log('🔄 차트 업데이트 시작');
    
    // 링크 업데이트
    const linkSelection = g.selectAll('.company-link')
        .data(networkData.links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);
    
    linkSelection.exit().remove();
    
    const linkEnter = linkSelection.enter()
        .append('path')
        .attr('class', 'company-link')
        .attr('stroke', '#666')
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('marker-end', 'url(#arrowhead)');
    
    const linkUpdate = linkEnter.merge(linkSelection);
    
    // 링크 레이블 업데이트
    const linkLabelSelection = g.selectAll('.link-label')
        .data(networkData.links.filter(d => d.label), d => `${d.source.id || d.source}-${d.target.id || d.target}-label`);
    
    linkLabelSelection.exit().remove();
    
    const linkLabelEnter = linkLabelSelection.enter()
        .append('text')
        .attr('class', 'link-label')
        .attr('font-size', '12px')
        .attr('fill', '#2c3e50')
        .attr('text-anchor', 'middle')
        .text(d => d.label);
    
    const linkLabelUpdate = linkLabelEnter.merge(linkLabelSelection);
    
    // 노드 업데이트
    const nodeSelection = g.selectAll('.company-node')
        .data(networkData.nodes, d => d.id);
    
    nodeSelection.exit().remove();
    
    const nodeEnter = nodeSelection.enter()
        .append('g')
        .attr('class', 'company-node')
        .call(d3.drag()
            .on('start', dragStart)
            .on('drag', dragging)
            .on('end', dragEnd))
        .on('click', nodeClick)
        .on('dblclick', nodeDoubleClick);
    
    // 노드 원 추가
    nodeEnter.append('circle')
        .attr('r', d => getNodeRadius(d.size))
        .attr('fill', d => d.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
    
    // 노드 텍스트 추가
    nodeEnter.append('text')
        .attr('class', 'node-text')
        .attr('dy', '0.35em')
        .attr('font-size', d => getNodeFontSize(d.size))
        .attr('fill', d => getTextColor(d.color))
        .text(d => d.name.length > 8 ? d.name.substring(0, 8) + '...' : d.name);
    
    const nodeUpdate = nodeEnter.merge(nodeSelection);
    
    // 노드 업데이트 적용
    nodeUpdate.select('circle')
        .attr('r', d => getNodeRadius(d.size))
        .attr('fill', d => d.color);
    
    nodeUpdate.select('text')
        .attr('font-size', d => getNodeFontSize(d.size))
        .attr('fill', d => getTextColor(d.color))
        .text(d => d.name.length > 8 ? d.name.substring(0, 8) + '...' : d.name);
    
    // 시뮬레이션 업데이트
    simulation.nodes(networkData.nodes);
    simulation.force('link').links(networkData.links);
    
    // 틱 이벤트 핸들러
    simulation.on('tick', () => {
        linkUpdate.attr('d', d => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            
            // 곡선 경로 생성 (화살표가 겹치지 않도록)
            return `M ${d.source.x} ${d.source.y} Q ${d.source.x + dx/2 + dy/4} ${d.source.y + dy/2 - dx/4} ${d.target.x} ${d.target.y}`;
        });
        
        linkLabelUpdate
            .attr('x', d => (d.source.x + d.target.x) / 2)
            .attr('y', d => (d.source.y + d.target.y) / 2 - 10);
        
        nodeUpdate.attr('transform', d => `translate(${d.x}, ${d.y})`);
    });
    
    simulation.alpha(0.3).restart();
    
    // 드롭다운 업데이트
    updateRelationshipDropdowns();
    
    console.log('✅ 차트 업데이트 완료');
}

// 노드 크기 계산
function getNodeRadius(size) {
    const sizeMap = {
        'small': 20,
        'medium': 30,
        'large': 40
    };
    return sizeMap[size] || 30;
}

// 노드 폰트 크기 계산
function getNodeFontSize(size) {
    const fontMap = {
        'small': '10px',
        'medium': '12px',
        'large': '14px'
    };
    return fontMap[size] || '12px';
}

// 텍스트 색상 계산
function getTextColor(backgroundColor) {
    // RGB 값 추출
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // 밝기 계산
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    return brightness > 128 ? '#000000' : '#ffffff';
}

// 드래그 이벤트 핸들러는 위에서 이미 정의됨 (그리드 스냅 기능 포함)

// 드롭다운 업데이트 함수
function updateRelationshipDropdowns() {
    const fromSelect = document.getElementById('fromCompany');
    const toSelect = document.getElementById('toCompany');
    
    // 기존 옵션 제거 (첫 번째 옵션 제외)
    fromSelect.innerHTML = '<option value="">시작 업체 선택</option>';
    toSelect.innerHTML = '<option value="">대상 업체 선택</option>';
    
    // 현재 노드들로 옵션 추가
    networkData.nodes.forEach(node => {
        const option1 = document.createElement('option');
        option1.value = node.name;
        option1.textContent = node.name;
        fromSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = node.name;
        option2.textContent = node.name;
        toSelect.appendChild(option2);
    });
}

// 노드 클릭 핸들러 (드롭다운 자동 설정)
function nodeClick(event, d) {
    if (isDragging) return;
    
    const fromSelect = document.getElementById('fromCompany');
    const toSelect = document.getElementById('toCompany');
    
    // 선택된 노드 표시
    if (selectedNode) {
        // 이미 선택된 노드가 있으면 관계 설정
        fromSelect.value = selectedNode.name;
        toSelect.value = d.name;
        selectedNode = null; // 선택 해제
        showToast(`${fromSelect.value} → ${toSelect.value} 관계를 설정하세요`, 'success');
    } else {
        // 새로 선택
        selectedNode = d;
        fromSelect.value = d.name;
        toSelect.value = '';
        showToast(`${d.name} 선택됨 (대상 업체를 선택하세요)`, 'success');
    }
    
    // 노드 강조 효과
    g.selectAll('.company-node').classed('selected', false);
    if (selectedNode) {
        d3.select(this).classed('selected', true);
    }
}

// 노드 더블클릭 핸들러 (중심으로 이동)
function nodeDoubleClick(event, d) {
    if (d.isRegistered && d.companyId && d.companyId !== centerCompany.id) {
        if (confirm(`${d.name}을 중심으로 하는 관계도로 이동하시겠습니까?`)) {
            window.location.href = `company-network.html?id=${d.companyId}&name=${encodeURIComponent(d.name)}`;
        }
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    console.log('🎯 이벤트 리스너 설정');
    
    // 뒤로가기 버튼
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = `company-detail.html?id=${centerCompany.id}`;
    });
    
    // 저장 버튼
    document.getElementById('saveNetworkBtn').addEventListener('click', saveNetwork);
    
    // 업체 검색
    const searchInput = document.getElementById('companySearchInput');
    searchInput.addEventListener('input', handleCompanySearch);
    searchInput.addEventListener('keydown', handleSearchKeydown);
    
    // 관계 추가 버튼
    document.getElementById('addRelationshipBtn').addEventListener('click', addRelationship);
    
    // 컨트롤 버튼들
    document.getElementById('resetZoomBtn').addEventListener('click', resetZoom);
    document.getElementById('toggleGridBtn').addEventListener('click', () => {
        toggleGrid();
        const btn = document.getElementById('toggleGridBtn');
        btn.textContent = showGrid ? '그리드 숨김' : '그리드 표시';
    });
    document.getElementById('clearAllBtn').addEventListener('click', clearAll);
    
    // 존재하는 경우에만 이벤트 리스너 추가
    const addCompanyBtn = document.getElementById('addCompanyBtn');
    if (addCompanyBtn) addCompanyBtn.addEventListener('click', addCompanyPrompt);
    
    const autoLayoutBtn = document.getElementById('autoLayoutBtn');
    if (autoLayoutBtn) autoLayoutBtn.addEventListener('click', autoLayout);
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportToImage);
    
    // 검색 결과 클릭 외부 영역 클릭 시 닫기
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.company-search')) {
            document.getElementById('searchResults').style.display = 'none';
        }
    });
}

// 업체 검색 핸들러
function handleCompanySearch(event) {
    const query = event.target.value.trim().toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    
    if (query.length < 1) {
        resultsDiv.style.display = 'none';
        return;
    }
    
    // 등록된 업체에서 검색
    const matches = allCompanies.filter(company => 
        company.company_name.toLowerCase().includes(query)
    );
    
    resultsDiv.innerHTML = '';
    
    if (matches.length > 0) {
        matches.forEach(company => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.textContent = company.company_name;
            item.dataset.companyId = company.id;
            item.dataset.companyName = company.company_name;
            item.dataset.isRegistered = 'true';
            
            item.addEventListener('click', () => {
                addCompanyFromSearch(company.company_name, true, company.id, company.color_code);
                resultsDiv.style.display = 'none';
                event.target.value = '';
            });
            
            resultsDiv.appendChild(item);
        });
    }
    
    // 직접 입력 옵션
    const directItem = document.createElement('div');
    directItem.className = 'search-result-item';
    directItem.innerHTML = `<strong>"${query}" 직접 추가</strong>`;
    directItem.addEventListener('click', () => {
        addCompanyFromSearch(query, false);
        resultsDiv.style.display = 'none';
        event.target.value = '';
    });
    resultsDiv.appendChild(directItem);
    
    resultsDiv.style.display = 'block';
}

// 검색 키다운 핸들러
function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (query) {
            addCompanyFromSearch(query, false);
            event.target.value = '';
            document.getElementById('searchResults').style.display = 'none';
        }
    }
}

// 검색에서 업체 추가
function addCompanyFromSearch(companyName, isRegistered, companyId = null, colorCode = null) {
    // 이미 존재하는지 확인
    const existingNode = networkData.nodes.find(node => node.name === companyName);
    if (existingNode) {
        showToast('이미 추가된 업체입니다.', 'error');
        return;
    }
    
    // 색상 결정
    let color = '#95a5a6'; // 기본값 (임시 업체)
    if (isRegistered) {
        color = getCompanyColor(colorCode) || '#3498db';
    }
    
    // 사용 가능한 그리드 포인트 찾기
    updateGridOccupancy();
    const availableGridPoints = gridData.filter(point => !point.occupied);
    let gridPosition;
    
    if (availableGridPoints.length > 0) {
        // 중심에서 가까운 순서로 정렬해서 첫 번째 사용
        const centerX = svg.attr('width') / 2;
        const centerY = svg.attr('height') / 2;
        
        availableGridPoints.sort((a, b) => {
            const distA = Math.sqrt((a.x - centerX) ** 2 + (a.y - centerY) ** 2);
            const distB = Math.sqrt((b.x - centerX) ** 2 + (b.y - centerY) ** 2);
            return distA - distB;
        });
        
        gridPosition = availableGridPoints[0];
    } else {
        // 모든 그리드가 점유된 경우 중심 근처 임의 위치
        gridPosition = { x: svg.attr('width') / 2 + Math.random() * 200 - 100, y: svg.attr('height') / 2 + Math.random() * 200 - 100 };
    }
    
    // 새 노드 생성
    const newNode = {
        id: companyId ? `company_${companyId}` : `temp_${Date.now()}`,
        name: companyName,
        type: isRegistered ? 'registered' : 'temporary',
        color: color,
        size: 'medium',
        isRegistered: isRegistered,
        companyId: companyId,
        x: gridPosition.x,
        y: gridPosition.y
    };
    
    networkData.nodes.push(newNode);
    updateChart();
    
    // 그리드 점유 상태 업데이트
    updateGridOccupancy();
    
    showToast(`${companyName} 업체가 추가되었습니다.`, 'success');
}

// 업체 색상 가져오기
function getCompanyColor(colorCode) {
    const colorMap = {
        'red': '#e74c3c',
        'orange': '#f39c12',
        'yellow': '#f1c40f',
        'green': '#27ae60',
        'blue': '#3498db',
        'purple': '#9b59b6',
        'gray': '#95a5a6',
        '빨강': '#e74c3c',
        '주황': '#f39c12',
        '노랑': '#f1c40f',
        '초록': '#27ae60',
        '파랑': '#3498db',
        '보라': '#9b59b6',
        '회색': '#95a5a6'
    };
    
    return colorMap[colorCode] || null;
}

// 관계 추가
function addRelationship() {
    const fromCompany = document.getElementById('fromCompany').value;
    const toCompany = document.getElementById('toCompany').value;
    const relationshipType = document.getElementById('relationshipType').value;
    
    if (!fromCompany || !toCompany) {
        showToast('시작 업체와 대상 업체를 선택해주세요.', 'error');
        return;
    }
    
    if (!relationshipType) {
        showToast('관계 유형을 선택해주세요.', 'error');
        return;
    }
    
    if (fromCompany === toCompany) {
        showToast('같은 업체끼리는 관계를 설정할 수 없습니다.', 'error');
        return;
    }
    
    // 시작, 대상 노드 찾기
    const fromNode = networkData.nodes.find(node => node.name === fromCompany);
    const toNode = networkData.nodes.find(node => node.name === toCompany);
    
    if (!fromNode || !toNode) {
        showToast('업체를 찾을 수 없습니다. 먼저 업체를 추가해주세요.', 'error');
        return;
    }
    
    // 이미 존재하는 관계인지 확인
    const existingLink = networkData.links.find(link => 
        (link.source.id === fromNode.id && link.target.id === toNode.id) ||
        (link.source.id === toNode.id && link.target.id === fromNode.id)
    );
    
    if (existingLink) {
        showToast('이미 관계가 설정된 업체입니다.', 'error');
        return;
    }
    
    // 새 링크 생성
    const newLink = {
        source: fromNode.id,
        target: toNode.id,
        type: relationshipType,
        label: relationshipType
    };
    
    networkData.links.push(newLink);
    updateChart();
    
    // 폼 초기화
    document.getElementById('fromCompany').selectedIndex = 0;
    document.getElementById('toCompany').selectedIndex = 0;
    document.getElementById('relationshipType').selectedIndex = 0;
    selectedNode = null;
    
    // 노드 선택 해제
    g.selectAll('.company-node').classed('selected', false);
    
    showToast(`${relationshipType} 관계가 추가되었습니다.`, 'success');
}

// 줌 리셋
function resetZoom() {
    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
    );
}

// 모두 삭제
function clearAll() {
    if (confirm('모든 관계도를 삭제하시겠습니까? (중심 업체는 제외)')) {
        // 중심 업체만 남기고 모두 삭제
        networkData.nodes = networkData.nodes.filter(node => node.type === 'center');
        networkData.links = [];
        
        updateChart();
        showToast('관계도가 초기화되었습니다.', 'success');
    }
}

// 업체 추가 프롬프트
function addCompanyPrompt() {
    const companyName = prompt('추가할 업체명을 입력하세요:');
    if (companyName && companyName.trim()) {
        addCompanyFromSearch(companyName.trim(), false);
    }
}

// 자동 배치
function autoLayout() {
    // 중심 업체 제외한 노드들의 고정 해제
    networkData.nodes.forEach(node => {
        if (node.type !== 'center') {
            node.fx = null;
            node.fy = null;
        }
    });
    
    // 시뮬레이션 재시작
    simulation.alpha(1).restart();
    showToast('자동 배치가 적용되었습니다.', 'success');
}

// 이미지 내보내기
function exportToImage() {
    showToast('이미지 내보내기 기능은 준비 중입니다.', 'info');
}

// 네트워크 저장 (캐시 무효화 포함)
async function saveNetwork() {
    try {
        console.log('💾 네트워크 저장 시작');
        
        // 네트워크 데이터 준비
        const networkToSave = {
            center_company_id: centerCompany.id,
            center_company_name: centerCompany.name,
            nodes: networkData.nodes.map(node => ({
                id: node.id,
                name: node.name,
                type: node.type,
                color: node.color,
                size: node.size,
                isRegistered: node.isRegistered,
                companyId: node.companyId,
                x: node.x,
                y: node.y
            })),
            links: networkData.links.map(link => ({
                source: typeof link.source === 'object' ? link.source.id : link.source,
                target: typeof link.target === 'object' ? link.target.id : link.target,
                type: link.type,
                label: link.label
            }))
        };
        
        // 데이터베이스에 저장
        const result = await window.db.saveCompanyNetwork(
            currentUser.id,
            centerCompany.id,
            centerCompany.name,
            networkToSave
        );
        
        if (result.success) {
            // 네트워크 캐시 무효화
            if (window.dataChangeManager) {
                window.dataChangeManager.notifyChange(currentUser.id, 'network_save');
            }
            
            showToast('네트워크가 성공적으로 저장되었습니다.', 'success');
        } else {
            throw new Error('저장 실패');
        }
        
    } catch (error) {
        console.error('❌ 네트워크 저장 오류:', error);
        showToast('네트워크 저장 중 오류가 발생했습니다.', 'error');
    }
}

// 기존 네트워크 로드 (캐시 활용)
async function loadExistingNetwork() {
    try {
        console.log('📊 기존 네트워크 로드 시도 (현재 비활성화)');
        
        // 기존 네트워크 로드 기능은 현재 비활성화됨
        // TODO: 향후 네트워크 저장/로드 기능 구현 시 활성화
        console.log('ℹ️ 기존 네트워크 로드 기능 비활성화 - 새로운 네트워크로 시작');
        return;
        
        // 아래 코드는 향후 구현을 위해 보관
        /*
        const existingNetwork = await window.DataCache.getNetworks(currentUser.id);
        
        // 현재 중심 업체의 네트워크 찾기
        const networkForCenter = existingNetwork.find(net => 
            net.center_company_id === centerCompany.id
        );
        
        if (networkForCenter && networkForCenter.network_data) {
            const networkInfo = networkForCenter.network_data;
            
            // 기존 노드와 링크 로드
            if (networkInfo.nodes && networkInfo.nodes.length > 0) {
                // 중심 업체 제외하고 다른 노드들 추가
                const otherNodes = networkInfo.nodes.filter(node => node.type !== 'center');
                networkData.nodes.push(...otherNodes);
            }
            
            if (networkInfo.links && networkInfo.links.length > 0) {
                networkData.links.push(...networkInfo.links);
            }
            
            updateChart();
            showToast('기존 관계도가 로드되었습니다.', 'success');
            console.log('✅ 기존 네트워크 캐시 로드 완료');
        }
        */
        
    } catch (error) {
        console.error('❌ 기존 네트워크 로드 오류:', error);
        // 오류가 발생해도 페이지는 정상 동작하도록 함
    }
}

// 토스트 메시지 표시
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 윈도우 리사이즈 핸들러
window.addEventListener('resize', () => {
    const container = document.querySelector('.network-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    svg.attr('width', width).attr('height', height);
    
    // 화면 크기에 따른 시뮬레이션 재조정
    const isMobile = width < 768;
    const linkDistance = isMobile ? 150 : 250;
    const chargeStrength = isMobile ? -300 : -500;
    const collisionRadius = isMobile ? 60 : 90;
    
    simulation
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('link', d3.forceLink().id(d => d.id).distance(linkDistance))
        .force('charge', d3.forceManyBody().strength(chargeStrength))
        .force('collision', d3.forceCollide().radius(collisionRadius))
        .alpha(0.3)
        .restart();
        
    console.log('📱 화면 크기 변경에 따른 차트 재조정:', { width, height, isMobile });
});