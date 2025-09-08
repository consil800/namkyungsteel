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

// 등록된 모든 업체 목록 로드
async function loadAllCompanies() {
    try {
        const companies = await window.db.getClientCompanies(currentUser.id);
        allCompanies = companies || [];
        console.log('✅ 업체 목록 로드 완료:', allCompanies.length, '개');
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
    
    // 시뮬레이션 초기화
    simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(150))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(50));
    
    // 중심 업체 노드 추가
    addCenterCompany();
    
    // 로딩 메시지 숨기기
    document.getElementById('loadingMessage').style.display = 'none';
    
    console.log('✅ 네트워크 차트 초기화 완료');
}

// 중심 업체 노드 추가
function addCenterCompany() {
    const centerNode = {
        id: `company_${centerCompany.id}`,
        name: centerCompany.name,
        type: 'center',
        color: '#e74c3c',
        size: 'large',
        isRegistered: true,
        companyId: centerCompany.id,
        x: svg.attr('width') / 2,
        y: svg.attr('height') / 2,
        fx: svg.attr('width') / 2, // 중심 고정
        fy: svg.attr('height') / 2  // 중심 고정
    };
    
    networkData.nodes.push(centerNode);
    updateChart();
    
    console.log('✅ 중심 업체 노드 추가:', centerNode.name);
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

// 드래그 이벤트 핸들러
function dragStart(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
    isDragging = true;
    
    d3.select(this).classed('dragging', true);
}

function dragging(event, d) {
    // 중심 업체는 드래그하지 않음
    if (d.type === 'center') return;
    
    d.fx = event.x;
    d.fy = event.y;
}

function dragEnd(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    
    // 중심 업체가 아닌 경우만 고정 해제
    if (d.type !== 'center') {
        d.fx = null;
        d.fy = null;
    }
    
    isDragging = false;
    d3.select(this).classed('dragging', false);
}

// 노드 클릭 핸들러
function nodeClick(event, d) {
    if (isDragging) return;
    
    // 선택된 노드 표시
    if (selectedNode) {
        document.getElementById('fromCompany').value = selectedNode.name;
        document.getElementById('toCompany').value = d.name;
    } else {
        selectedNode = d;
        document.getElementById('fromCompany').value = d.name;
        showToast(`${d.name} 선택됨 (관계를 추가할 대상 업체를 선택하세요)`, 'success');
    }
    
    // 노드 강조 효과
    g.selectAll('.company-node').classed('selected', false);
    d3.select(this).classed('selected', true);
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
    document.getElementById('clearAllBtn').addEventListener('click', clearAll);
    document.getElementById('addCompanyBtn').addEventListener('click', addCompanyPrompt);
    document.getElementById('autoLayoutBtn').addEventListener('click', autoLayout);
    document.getElementById('exportBtn').addEventListener('click', exportToImage);
    
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
    
    // 새 노드 생성
    const newNode = {
        id: companyId ? `company_${companyId}` : `temp_${Date.now()}`,
        name: companyName,
        type: isRegistered ? 'registered' : 'temporary',
        color: color,
        size: 'medium',
        isRegistered: isRegistered,
        companyId: companyId,
        x: Math.random() * 400 + 200,
        y: Math.random() * 300 + 150
    };
    
    networkData.nodes.push(newNode);
    updateChart();
    
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
    const fromCompany = document.getElementById('fromCompany').value.trim();
    const toCompany = document.getElementById('toCompany').value.trim();
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
    document.getElementById('fromCompany').value = '';
    document.getElementById('toCompany').value = '';
    document.getElementById('relationshipType').value = '';
    selectedNode = null;
    
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

// 네트워크 저장
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
            showToast('네트워크가 성공적으로 저장되었습니다.', 'success');
        } else {
            throw new Error('저장 실패');
        }
        
    } catch (error) {
        console.error('❌ 네트워크 저장 오류:', error);
        showToast('네트워크 저장 중 오류가 발생했습니다.', 'error');
    }
}

// 기존 네트워크 로드
async function loadExistingNetwork() {
    try {
        console.log('📊 기존 네트워크 로드 시도');
        
        const existingNetwork = await window.db.getCompanyNetwork(
            currentUser.id,
            centerCompany.id
        );
        
        if (existingNetwork && existingNetwork.network_data) {
            const networkInfo = existingNetwork.network_data;
            
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
            console.log('✅ 기존 네트워크 로드 완료');
        }
        
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
    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.1).restart();
});