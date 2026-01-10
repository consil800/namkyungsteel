/**
 * 업체 방문 스케줄 자동 생성기
 * - 주소 기반 근접 그룹핑
 * - 한국 공휴일 API 연동
 * - SortableJS 드래그 앤 드롭
 */

// ===== Supabase 설정 (database.js 사용) =====
// 주의: 전역 supabase 변수와 충돌 방지를 위해 supabaseDB 사용
let supabaseDB = null;
let USER_ID = null;

// 데이터베이스 및 사용자 초기화
async function initDatabase() {
  // database.js가 로드될 때까지 대기
  let retries = 0;
  while (retries < 30) {
    if (window.db && window.db.client) {
      supabaseDB = window.db.client;
      console.log('✅ database.js 연결 확인됨');
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  if (!supabaseDB) {
    throw new Error('데이터베이스 연결 실패');
  }

  // 세션에서 사용자 정보 가져오기
  let user = null;
  const sessionUser = sessionStorage.getItem('currentUser');
  if (sessionUser) {
    user = JSON.parse(sessionUser);
    console.log('✅ sessionStorage에서 사용자 확인:', user.name);
  } else if (window.AuthManager && window.AuthManager.getCurrentUser) {
    // AuthManager 폴백
    user = window.AuthManager.getCurrentUser();
    if (user) {
      console.log('✅ AuthManager에서 사용자 확인:', user.name);
      // sessionStorage에도 저장
      sessionStorage.setItem('currentUser', JSON.stringify(user));
    }
  }

  if (user) {
    USER_ID = user.id?.toString();
    console.log('✅ 사용자 ID:', USER_ID);
  } else {
    // 로그인 페이지로 리다이렉트
    console.error('❌ 로그인 필요');
    alert('로그인이 필요합니다.');
    window.location.href = 'login.html';
    return false;
  }

  return true;
}

// ===== 상태 관리 =====
const state = {
  companies: [],           // 전체 업체 목록
  selectedCompanies: [],   // 선택된 업체 ID 목록
  holidays: new Map(),     // 공휴일 맵 (YYYY-MM-DD -> name)
  schedule: [],            // 생성된 스케줄 [{date, companies:[], isOff, isWeekend, isHoliday}]
  unassigned: [],          // 미배정 업체
  colors: [],              // 색상 목록
  regions: [],             // 지역 목록
  locationGroups: new Map(), // 주소 그룹 (region+subDistrict -> companies)
  filterColors: [],        // 선택된 색상 필터
  filterRegions: [],       // 선택된 지역 필터
  searchKeyword: '',       // 검색 키워드
  isDirty: false,          // 변경 여부
  excludedIds: [],         // Pre-flight에서 제외할 업체 ID 목록 (2026-01-04 추가)
  // ===== v5.1 상태 변수 (2026-01-05 ChatGPT + Claude 협업) =====
  regionCooldown: new Map(),  // 지역별 마지막 배정일 (region -> dateIdx)
  monthlyVisits: new Map(),   // 업체별 월간 방문 횟수 (companyId -> count)
  // ===== v6.2 고정 업체 기능 (2026-01-10 ChatGPT + Claude Ultra Think 협업) =====
  pinnedMode: false,              // 고정 모드 활성화 여부
  pinnedCompanies: [],            // [{companyId, date, companyName}]
  pinnedByCompany: new Map(),     // companyId -> date (빠른 조회용)
  pinnedByDate: new Map(),        // date -> Set<companyId> (날짜별 고정 업체)
  pinDirty: false,                // 고정 데이터 변경 여부
};

// ===== DOM 요소 =====
const el = {
  loadState: document.getElementById('loadState'),
  startDate: document.getElementById('startDate'),
  endDate: document.getElementById('endDate'),
  workdayCount: document.getElementById('workdayCount'),
  selectedCount: document.getElementById('selectedCount'),
  rangeHint: document.getElementById('rangeHint'),
  colorChips: document.getElementById('colorChips'),
  regionList: document.getElementById('regionList'),
  companySearch: document.getElementById('companySearch'),
  estimateBox: document.getElementById('estimateBox'),
  calendar: document.getElementById('calendar'),
  calendarMeta: document.getElementById('calendarMeta'),
  unassignedList: document.getElementById('unassignedList'),
  offDropList: document.getElementById('offDropList'),
  saveStatePill: document.getElementById('saveStatePill'),
  btnPreview: document.getElementById('btnPreview'),
  btnSave: document.getElementById('btnSave'),
  btnReset: document.getElementById('btnReset'),
  btnRegionAll: document.getElementById('btnRegionAll'),
  btnRegionNone: document.getElementById('btnRegionNone'),
  btnSelectAllFiltered: document.getElementById('btnSelectAllFiltered'),
  btnClearSelected: document.getElementById('btnClearSelected'),
  // 좌표 관리 관련 (2026-01-04 추가)
  geocodeSection: document.getElementById('geocodeSection'),
  geocodeStats: document.getElementById('geocodeStats'),
  btnBatchGeocode: document.getElementById('btnBatchGeocode'),
  btnRefreshGeoStats: document.getElementById('btnRefreshGeoStats'),
  geocodeProgress: document.getElementById('geocodeProgress'),
  geocodeProgressBar: document.getElementById('geocodeProgressBar'),
  geocodeProgressText: document.getElementById('geocodeProgressText'),
  // 불러오기 관련 (2026-01-05 추가)
  btnLoad: document.getElementById('btnLoad'),
  loadScheduleOverlay: document.getElementById('loadScheduleOverlay'),
  loadScheduleList: document.getElementById('loadScheduleList'),
  loadScheduleEmpty: document.getElementById('loadScheduleEmpty'),
  loadScheduleLoading: document.getElementById('loadScheduleLoading'),
  loadScheduleCancel: document.getElementById('loadScheduleCancel'),
  loadScheduleDelete: document.getElementById('loadScheduleDelete'),
};

// ===== 색상 우선순위 (빨강→주황→노랑→초록→하늘→파랑→보라→회색) =====
const COLOR_PRIORITY = ['red', 'orange', 'yellow', 'green', 'sky', 'blue', 'purple', 'gray'];
const colorRank = new Map(COLOR_PRIORITY.map((c, i) => [c, i]));

// ===== 색상 코드 매핑 =====
const COLOR_MAP = {
  red: { name: '빨강', cssClass: 'red', hex: '#dc2626', priority: 0 },
  orange: { name: '주황', cssClass: 'orange', hex: '#ea580c', priority: 1 },
  yellow: { name: '노랑', cssClass: 'yellow', hex: '#ca8a04', priority: 2 },
  green: { name: '녹색', cssClass: 'green', hex: '#2e7d32', priority: 3 },
  sky: { name: '하늘', cssClass: 'sky', hex: '#0284c7', priority: 4 },
  blue: { name: '파랑', cssClass: 'blue', hex: '#2563eb', priority: 5 },
  purple: { name: '보라', cssClass: 'purple', hex: '#7c3aed', priority: 6 },
  gray: { name: '회색', cssClass: 'gray', hex: '#6b7280', priority: 7 },
};

// ===== 업체 정렬 함수 (ChatGPT Ultra Think 설계) =====
// 우선순위: 1) 색상 우선순위 2) 최근방문일(NULL/오래된 순) 3) 방문횟수(적은 순)
function compareCompanies(a, b) {
  // 1) 색상 우선순위 (빨강=0 → 회색=7, 없으면 999)
  const ra = colorRank.get(a.color_code) ?? 999;
  const rb = colorRank.get(b.color_code) ?? 999;
  if (ra !== rb) return ra - rb;

  // 2) last_visit_date ASC, NULL이면 최우선 (-Infinity)
  const da = a.last_visit_date ? new Date(a.last_visit_date).getTime() : -Infinity;
  const db = b.last_visit_date ? new Date(b.last_visit_date).getTime() : -Infinity;
  if (da !== db) return da - db;

  // 3) visit_count ASC (방문 적은 것 우선)
  const va = Number.isFinite(a.visit_count) ? a.visit_count : 0;
  const vb = Number.isFinite(b.visit_count) ? b.visit_count : 0;
  if (va !== vb) return va - vb;

  // 4) 최종: 업체명 가나다순
  return (a.company_name || '').localeCompare(b.company_name || '', 'ko');
}

// ===== 인접 지역 맵 (ChatGPT + Claude 협업 설계) =====
// 같은 생활권 내 지역들을 정의 (이동 효율을 위한 권역 설정)
const REGION_ADJACENCY = {
  '김해': ['부산', '양산', '창원', '밀양'],
  '부산': ['김해', '양산', '울산'],
  '양산': ['부산', '김해', '울산', '밀양'],
  '창원': ['김해', '함안', '밀양', '진주', '고성'],
  '울산': ['부산', '양산', '경주'],
  '밀양': ['김해', '양산', '창원', '창녕'],
  '함안': ['창원', '의령', '창녕'],
  '경주': ['울산', '영천', '포항'],
  '진주': ['창원', '사천', '고성', '의령'],
  '고성': ['창원', '진주', '사천'],
};

// ===== v6.0 통합 알고리즘 상수 (2026-01-05 ChatGPT + Claude Ultra Think 협업) =====
// 거리 기반 최적 경로 + v5.1 제약조건 통합
const V6_CONFIG = {
  // ===== 본사 위치 (부산광역시 사상구) =====
  BASE_LAT: 35.1547,
  BASE_LNG: 128.9914,

  // ===== Hard 제약 (절대 위반 금지) =====
  MONTHLY_VISIT_HARD_CAP: 3,   // 월 3회 초과 절대 금지

  // ===== Soft 제약: 지역 쿨다운 (ChatGPT 추천: 더 세분화) =====
  REGION_COOLDOWN_TIERS: [
    { days: 3, penalty: 120 },   // 3일 미만: 120점
    { days: 4, penalty: 60 },    // 3~4일: 60점
    { days: 6, penalty: 20 },    // 4~6일: 20점
    // 6일 이상: 0점
  ],

  // ===== Soft 제약: 월간 방문 제한 =====
  MONTHLY_VISIT_CAP: 2,          // 월 2회까지 권장
  MONTHLY_PENALTY_TIERS: [
    { count: 2, penalty: 40 },   // 2회째: 40점 (가급적 피함)
    { count: 3, penalty: 120 },  // 3회째: 120점 (거의 금지)
  ],

  // ===== Soft 제약: 월/금 근거리 선호 (ChatGPT 추천: 거리 기반) =====
  // 2026-01-05: 지역명 리스트 대신 거리 기반 연속 보너스로 변경
  // 2026-01-05 v6.1: 보너스 5배 상향 (ChatGPT + Claude 협업 검증)
  MON_FRI_DISTANCE_THRESHOLD: 60,  // 근거리 기준 (km) - 울산까지
  MON_FRI_BONUS_MAX: 100,          // 최대 보너스 (20→100, 5배 상향)

  // ===== Hard 제약: 월/금 거리 제한 (2026-01-05 신규) =====
  // 월/금에 본사 기준 일정 거리 초과 업체 배제
  MON_FRI_HARD_LIMITS: [80, 100, 120],  // 단계별 완화: 80km → 100km → 120km

  // ===== Soft 제약: 지역 전환 패널티 (2026-01-05 신규) =====
  // 하루 내 다른 지역으로 이동 시 페널티
  REGION_SWITCH_PENALTY: 30,       // 지역 전환 1회당 30점 페널티

  // ===== Soft 제약: 이동비용 페널티 (ChatGPT 추천) =====
  // 후보 선정 단계에서 먼 업체 약하게 억제
  // 2026-01-05 v6.1: 페널티 5배 상향 (ChatGPT + Claude 협업 검증)
  TRAVEL_PENALTY_SCALE: 60,        // 정규화 기준 (km)
  TRAVEL_PENALTY_WEIGHT: 15,       // 가중치 (3→15, 5배 상향)

  // ===== 희소성 보너스 (그리디가 미래 망치는 것 방지) =====
  SCARCITY_BONUS_ZERO_VISIT: 30, // 이번 달 0회 방문 업체 보너스

  // ===== Stale 보너스 (ChatGPT 추천: 정규화/클리핑) =====
  STALE_DAYS_CAP: 30,              // 30일 이상은 동일 취급
  STALE_BONUS_WEIGHT: 10,          // 정규화 후 가중치 (0~1 → 0~10)

  // ===== Top-N 후보 추출 (API 호출량 절감) =====
  TOP_N_MULTIPLIER: 8,           // 하루 방문수 × 8배로 후보 제한

  // ===== 단계적 완화 (Relaxation Ladder) =====
  RELAXATION_LEVELS: [
    { name: 'Level 1', monthlyPenaltyMult: 1.0, cooldownPenaltyMult: 1.0 },
    { name: 'Level 2', monthlyPenaltyMult: 0.5, cooldownPenaltyMult: 0.7 },
    { name: 'Level 3', monthlyPenaltyMult: 0.2, cooldownPenaltyMult: 0.4 },
    { name: 'Level 4 (Emergency)', monthlyPenaltyMult: 0, cooldownPenaltyMult: 0 },
  ],
};

// ===== v5.1 레거시 상수 (하위 호환용) =====
const V5_CONFIG = {
  // 지역 쿨다운 (soft constraint)
  REGION_COOLDOWN_MIN: 3,      // 최소 쿨다운 일수
  REGION_COOLDOWN_MAX: 4,      // 최대 쿨다운 일수
  REGION_COOLDOWN_PENALTY: 50, // 쿨다운 위반 시 페널티 점수

  // 월간 방문 제한 (soft constraint)
  MONTHLY_VISIT_CAP: 2,        // 월 2회까지 방문 권장
  MONTHLY_VISIT_PENALTY: 100,  // 3회 이상 방문 시 페널티

  // 월/금 근거리 선호 (weak constraint)
  MONDAY_FRIDAY_NEARBY_BONUS: 15, // 월/금에 근거리 지역 보너스
  NEARBY_REGIONS: ['부산', '김해', '양산', '밀양', '창원'], // 근거리 지역 목록
};

// ===== v5.1 헬퍼 함수 =====

/**
 * 지역이 쿨다운 상태인지 확인 (3~4일 이내 배정됐으면 true)
 * @param {string} region - 지역명
 * @param {number} currentDayIdx - 현재 날짜 인덱스
 * @returns {boolean} - 쿨다운 상태 여부
 */
function isRegionInCooldown(region, currentDayIdx) {
  const lastAssigned = state.regionCooldown.get(region);
  if (lastAssigned === undefined) return false;

  const daysSince = currentDayIdx - lastAssigned;
  return daysSince < V5_CONFIG.REGION_COOLDOWN_MIN;
}

/**
 * 지역 쿨다운 페널티 점수 계산 (연속 배정 시 페널티)
 * @param {string} region - 지역명
 * @param {number} currentDayIdx - 현재 날짜 인덱스
 * @returns {number} - 페널티 점수 (0 = 페널티 없음)
 */
function getRegionCooldownPenalty(region, currentDayIdx) {
  const lastAssigned = state.regionCooldown.get(region);
  if (lastAssigned === undefined) return 0;

  const daysSince = currentDayIdx - lastAssigned;
  if (daysSince >= V5_CONFIG.REGION_COOLDOWN_MAX) return 0;
  if (daysSince >= V5_CONFIG.REGION_COOLDOWN_MIN) return V5_CONFIG.REGION_COOLDOWN_PENALTY / 2;
  return V5_CONFIG.REGION_COOLDOWN_PENALTY;
}

/**
 * 업체의 월간 방문 횟수 확인 (해당 월 기준)
 * @param {number} companyId - 업체 ID
 * @param {string} monthKey - 월 키 (YYYY-MM)
 * @returns {number} - 방문 횟수
 */
function getMonthlyVisitCount(companyId, monthKey) {
  const key = `${companyId}-${monthKey}`;
  return state.monthlyVisits.get(key) || 0;
}

/**
 * 업체 월간 방문 횟수 증가
 * @param {number} companyId - 업체 ID
 * @param {string} monthKey - 월 키 (YYYY-MM)
 */
function incrementMonthlyVisit(companyId, monthKey) {
  const key = `${companyId}-${monthKey}`;
  const current = state.monthlyVisits.get(key) || 0;
  state.monthlyVisits.set(key, current + 1);
}

/**
 * 월간 방문 제한 페널티 계산
 * @param {number} companyId - 업체 ID
 * @param {string} monthKey - 월 키 (YYYY-MM)
 * @returns {number} - 페널티 점수
 */
function getMonthlyVisitPenalty(companyId, monthKey) {
  const count = getMonthlyVisitCount(companyId, monthKey);
  if (count < V5_CONFIG.MONTHLY_VISIT_CAP) return 0;
  if (count === V5_CONFIG.MONTHLY_VISIT_CAP) return V5_CONFIG.MONTHLY_VISIT_PENALTY / 2; // 2회째는 약한 페널티
  return V5_CONFIG.MONTHLY_VISIT_PENALTY; // 3회 이상은 강한 페널티
}

/**
 * 월/금 여부 확인 + 근거리 지역 보너스 계산
 * @param {Date} date - 날짜
 * @param {string} region - 지역명
 * @returns {number} - 보너스 (음수 = 우선순위 높음)
 */
function getMondayFridayNearbyBonus(date, region) {
  const dayOfWeek = date.getDay();
  const isMonOrFri = (dayOfWeek === 1 || dayOfWeek === 5); // 1=월, 5=금

  if (!isMonOrFri) return 0;

  const isNearby = V5_CONFIG.NEARBY_REGIONS.includes(region);
  return isNearby ? -V5_CONFIG.MONDAY_FRIDAY_NEARBY_BONUS : 0; // 음수 = 우선순위 높음
}

/**
 * 월 키 추출 (YYYY-MM 형식)
 * @param {string} dateStr - 날짜 문자열 (YYYY-MM-DD)
 * @returns {string} - 월 키 (YYYY-MM)
 */
function getMonthKey(dateStr) {
  return dateStr.substring(0, 7); // "2026-01-15" -> "2026-01"
}

// ===== v6.2 고정 업체 헬퍼 함수 (ChatGPT + Claude Ultra Think 협업 2026-01-10) =====

/**
 * 고정 업체 인덱스 재구성 (pinnedCompanies 배열 → Map 변환)
 * 스케줄 생성 전 호출하여 빠른 조회 가능하게 함
 */
function rebuildPinIndex() {
  state.pinnedByCompany.clear();
  state.pinnedByDate.clear();

  for (const pin of state.pinnedCompanies) {
    // companyId -> date 매핑
    state.pinnedByCompany.set(pin.companyId, pin.date);

    // date -> Set<companyId> 매핑
    if (!state.pinnedByDate.has(pin.date)) {
      state.pinnedByDate.set(pin.date, new Set());
    }
    state.pinnedByDate.get(pin.date).add(pin.companyId);
  }

  console.log(`📌 고정 인덱스 구축: ${state.pinnedCompanies.length}개 업체`);
}

/**
 * 고정 업체를 스케줄에 먼저 배정하고 후보에서 제외
 * @param {Array} schedule - 스케줄 배열 [{date, companies, ...}]
 * @param {Array} remainingPool - 남은 업체 풀
 * @param {Map} companyMap - companyId -> company 객체 맵
 * @returns {Array} - 고정 업체가 제외된 업체 풀
 */
function applyPinsToSchedule(schedule, remainingPool, companyMap) {
  if (state.pinnedCompanies.length === 0) {
    console.log('📌 고정 업체 없음 - 일반 알고리즘 진행');
    return remainingPool;
  }

  console.log('');
  console.log('📌 ===== 고정 업체 배정 시작 =====');

  const pinnedIds = new Set();
  let appliedCount = 0;

  // 날짜별로 고정 업체 배정
  for (const day of schedule) {
    const pinnedForDate = state.pinnedByDate.get(day.date);
    if (!pinnedForDate || pinnedForDate.size === 0) continue;

    for (const companyId of pinnedForDate) {
      const company = companyMap.get(companyId);
      if (!company) {
        console.warn(`  ⚠️ 고정 업체 ID ${companyId}를 찾을 수 없음 (필터에서 제외됨?)`);
        continue;
      }

      // 이미 companies 배열이 없으면 초기화
      if (!day.companies) {
        day.companies = [];
      }

      // 중복 방지
      if (!day.companies.find(c => c.id === companyId)) {
        day.companies.push({
          ...company,
          _isPinned: true  // 고정 표시
        });
        pinnedIds.add(companyId);
        appliedCount++;
        console.log(`  📍 ${day.date}: ${company.company_name} (고정)`);
      }
    }
  }

  console.log(`📌 고정 업체 ${appliedCount}개 배정 완료`);
  console.log('');

  // 고정된 업체를 후보에서 제외
  return remainingPool.filter(c => !pinnedIds.has(c.id));
}

/**
 * 업체를 특정 날짜에 고정
 * @param {number} companyId - 업체 ID
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @param {string} companyName - 업체명 (UI 표시용)
 */
function setPinned(companyId, date, companyName) {
  // 이미 고정된 경우 날짜만 변경
  const existingIdx = state.pinnedCompanies.findIndex(p => p.companyId === companyId);
  if (existingIdx !== -1) {
    state.pinnedCompanies[existingIdx].date = date;
  } else {
    state.pinnedCompanies.push({ companyId, date, companyName });
  }

  rebuildPinIndex();
  state.pinDirty = true;
  renderPinnedList();
  updatePinBadge();

  console.log(`📌 고정 설정: ${companyName} → ${date}`);
  toast(`${companyName}을(를) ${date}에 고정했습니다.`);
}

/**
 * 업체 고정 해제
 * @param {number} companyId - 업체 ID
 */
function removePinned(companyId) {
  const idx = state.pinnedCompanies.findIndex(p => p.companyId === companyId);
  if (idx === -1) return;

  const removed = state.pinnedCompanies.splice(idx, 1)[0];
  rebuildPinIndex();
  state.pinDirty = true;
  renderPinnedList();
  updatePinBadge();

  console.log(`📌 고정 해제: ${removed.companyName}`);
  toast(`${removed.companyName} 고정이 해제되었습니다.`);
}

/**
 * 모든 고정 해제
 */
function clearAllPins() {
  if (state.pinnedCompanies.length === 0) return;

  const count = state.pinnedCompanies.length;
  state.pinnedCompanies = [];
  rebuildPinIndex();
  state.pinDirty = true;
  renderPinnedList();
  updatePinBadge();

  console.log(`📌 모든 고정 해제: ${count}개`);
  toast(`${count}개 업체 고정이 해제되었습니다.`);
}

/**
 * 고정 업체 목록 UI 렌더링
 */
function renderPinnedList() {
  const container = document.getElementById('pinnedList');
  if (!container) return;

  if (state.pinnedCompanies.length === 0) {
    container.innerHTML = '<div class="hint">고정된 업체가 없습니다.</div>';
    return;
  }

  // 날짜순 정렬
  const sorted = [...state.pinnedCompanies].sort((a, b) => a.date.localeCompare(b.date));

  container.innerHTML = sorted.map(pin => `
    <div class="pinned-item" data-company-id="${pin.companyId}">
      <span class="pinned-date">${pin.date}</span>
      <span class="pinned-name">${pin.companyName}</span>
      <button class="btn-remove-pin" onclick="removePinned(${pin.companyId})" title="고정 해제">×</button>
    </div>
  `).join('');
}

/**
 * 고정 개수 배지 업데이트
 */
function updatePinBadge() {
  const badge = document.getElementById('pinBadge');
  if (!badge) return;

  const count = state.pinnedCompanies.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-block' : 'none';
}

/**
 * 고정 모드 토글
 */
function togglePinMode() {
  state.pinnedMode = !state.pinnedMode;

  const btn = document.getElementById('btnPinMode');
  if (btn) {
    btn.classList.toggle('active', state.pinnedMode);
    btn.textContent = state.pinnedMode ? '📌 고정 모드 ON' : '📌 고정 모드';
  }

  // 고정 모드일 때 날짜 선택 UI 표시
  const dateSelector = document.getElementById('pinDateSelector');
  if (dateSelector) {
    dateSelector.style.display = state.pinnedMode ? 'block' : 'none';
  }

  // 업체 목록 표시/숨김
  const companyList = document.getElementById('pinCompanyList');
  if (companyList) {
    companyList.style.display = state.pinnedMode ? 'block' : 'none';
    if (state.pinnedMode) {
      renderPinCompanyList();
    }
  }

  console.log(`📌 고정 모드: ${state.pinnedMode ? 'ON' : 'OFF'}`);
}

/**
 * 고정용 업체 목록 렌더링
 */
function renderPinCompanyList() {
  const container = document.getElementById('pinCompanyList');
  if (!container) return;

  // 검색어 가져오기
  const searchInput = document.getElementById('pinCompanySearch');
  const keyword = (searchInput?.value || '').toLowerCase().trim();

  // 필터링된 업체 가져오기 (현재 필터 기준 + 좌표 있는 업체)
  let companies = state.companies.filter(c => c.latitude && c.longitude);

  // 검색어 필터
  if (keyword) {
    companies = companies.filter(c =>
      (c.company_name || '').toLowerCase().includes(keyword)
    );
  }

  // 최대 50개만 표시
  companies = companies.slice(0, 50);

  if (companies.length === 0) {
    container.innerHTML = '<div class="hint" style="padding:10px;">검색 결과가 없습니다.</div>';
    return;
  }

  container.innerHTML = companies.map(c => {
    const isPinned = state.pinnedByCompany.has(c.id);
    const pinnedDate = state.pinnedByCompany.get(c.id);
    const colorInfo = COLOR_MAP[c.color_code] || { cssClass: 'gray' };

    return `
      <div class="pin-company-item ${isPinned ? 'is-pinned' : ''}"
           data-id="${c.id}"
           data-name="${c.company_name}"
           onclick="handlePinCompanyClick(${c.id}, '${(c.company_name || '').replace(/'/g, "\\'")}')">
        <span class="dot ${colorInfo.cssClass}"></span>
        <span class="company-name">${c.company_name}</span>
        <span class="company-region">${c.region || ''}</span>
        ${isPinned ? `<span style="color:#f59e0b;">📌 ${pinnedDate}</span>` : ''}
      </div>
    `;
  }).join('');
}

/**
 * 고정용 업체 클릭 핸들러
 */
function handlePinCompanyClick(companyId, companyName) {
  const pinDate = document.getElementById('pinDateInput')?.value;

  if (!pinDate) {
    toast('먼저 고정할 날짜를 선택하세요.');
    return;
  }

  // 이미 해당 날짜에 고정되어 있으면 해제
  const existing = state.pinnedCompanies.find(p => p.companyId === companyId);
  if (existing && existing.date === pinDate) {
    removePinned(companyId);
  } else {
    setPinned(companyId, pinDate, companyName);
  }

  // 목록 다시 렌더링
  renderPinCompanyList();
}

/**
 * 업체 카드 클릭 시 고정 처리 (고정 모드일 때만)
 * @param {number} companyId - 업체 ID
 * @param {string} companyName - 업체명
 */
function handleCompanyCardClick(companyId, companyName) {
  if (!state.pinnedMode) return false;

  const pinDate = document.getElementById('pinDateInput')?.value;
  if (!pinDate) {
    toast('먼저 고정할 날짜를 선택하세요.');
    return true;  // 이벤트 처리됨
  }

  // 이미 해당 날짜에 고정되어 있으면 해제
  const existing = state.pinnedCompanies.find(p => p.companyId === companyId);
  if (existing && existing.date === pinDate) {
    removePinned(companyId);
  } else {
    setPinned(companyId, pinDate, companyName);
  }

  return true;  // 이벤트 처리됨
}

// ===== v6.0 헬퍼 함수 (ChatGPT + Claude Ultra Think 협업 2026-01-05) =====

/**
 * [Hard 제약] 월 3회 초과 여부 확인
 * @param {number} companyId - 업체 ID
 * @param {string} monthKey - 월 키 (YYYY-MM)
 * @returns {boolean} - true면 배정 금지
 */
function isHardCapExceeded(companyId, monthKey) {
  const count = getMonthlyVisitCount(companyId, monthKey);
  return count >= V6_CONFIG.MONTHLY_VISIT_HARD_CAP;
}

/**
 * [Soft 제약] v6.0 쿨다운 페널티 (더 세분화된 티어)
 * @param {string} region - 지역명
 * @param {number} currentDayIdx - 현재 날짜 인덱스
 * @returns {number} - 페널티 점수 (0~120)
 */
function getRegionCooldownPenaltyV6(region, currentDayIdx) {
  const lastAssigned = state.regionCooldown.get(region);
  if (lastAssigned === undefined) return 0;

  const daysSince = currentDayIdx - lastAssigned;

  // 티어별 페널티 적용 (역순으로 체크)
  for (const tier of V6_CONFIG.REGION_COOLDOWN_TIERS) {
    if (daysSince < tier.days) {
      return tier.penalty;
    }
  }
  return 0; // 6일 이상: 페널티 없음
}

/**
 * [Soft 제약] v6.0 월간 방문 페널티 (더 세분화된 티어)
 * @param {number} companyId - 업체 ID
 * @param {string} monthKey - 월 키 (YYYY-MM)
 * @returns {number} - 페널티 점수 (0~120)
 */
function getMonthlyVisitPenaltyV6(companyId, monthKey) {
  const count = getMonthlyVisitCount(companyId, monthKey);

  for (const tier of V6_CONFIG.MONTHLY_PENALTY_TIERS) {
    if (count >= tier.count) {
      return tier.penalty;
    }
  }
  return 0; // 1회 이하: 페널티 없음
}

/**
 * [Soft 제약] 월/금 근거리 선호 (ChatGPT 추천: 거리 기반 연속 보너스)
 * 2026-01-05: 지역명 리스트 대신 본사로부터의 거리 기반으로 변경
 * @param {Date} date - 날짜
 * @param {Object} company - 업체 객체 (latitude, longitude 필요)
 * @returns {number} - 점수 조정 (음수=좋음)
 */
function getMonFriPreferenceV6(date, company) {
  const dayOfWeek = date.getDay();
  const isMonOrFri = (dayOfWeek === 1 || dayOfWeek === 5);

  if (!isMonOrFri) return 0;

  // 좌표 없으면 보너스 없음
  if (!company.latitude || !company.longitude) return 0;

  // 본사로부터의 거리 계산
  const distKm = haversineDistance(
    V6_CONFIG.BASE_LAT, V6_CONFIG.BASE_LNG,
    parseFloat(company.latitude), parseFloat(company.longitude)
  );

  // 거리 기반 연속 보너스: 0~threshold km 구간에서 선형 감소
  // 부산(0km)=+20, 김해(20km)=+13, 양산(25km)=+12, 창원(40km)=+7, 울산(60km)=0
  const threshold = V6_CONFIG.MON_FRI_DISTANCE_THRESHOLD;
  const bonusMax = V6_CONFIG.MON_FRI_BONUS_MAX;
  const bonus = Math.max(0, (threshold - distKm) / threshold) * bonusMax;

  return -bonus; // 음수 = 점수 낮음 = 우선순위 높음
}

/**
 * [희소성 보너스] 이번 달 0회 방문 업체 우선
 * @param {number} companyId - 업체 ID
 * @param {string} monthKey - 월 키 (YYYY-MM)
 * @returns {number} - 보너스 점수 (음수=우선순위 높음)
 */
function getScarcityBonus(companyId, monthKey) {
  const count = getMonthlyVisitCount(companyId, monthKey);
  return count === 0 ? -V6_CONFIG.SCARCITY_BONUS_ZERO_VISIT : 0;
}

/**
 * [Stale 보너스] 오래된 업체 우선 (ChatGPT 추천: 정규화/클리핑)
 * 2026-01-05: staleDays를 0~1로 정규화 후 가중치 적용
 * @param {Object} company - 업체 객체
 * @param {string} todayStr - 오늘 날짜 (YYYY-MM-DD)
 * @returns {number} - 보너스 점수 (음수=우선순위 높음)
 */
function getStaleBonus(company, todayStr) {
  if (!company.last_visit_date) {
    // 방문 기록 없으면 중립 (희소성 보너스가 0회 방문 업체를 우대함)
    return 0;
  }

  const lastVisit = new Date(company.last_visit_date);
  const today = new Date(todayStr);
  const daysSince = Math.floor((today - lastVisit) / (1000 * 60 * 60 * 24));

  // ChatGPT 추천: 정규화/클리핑 (30일 이상은 동일 취급)
  // staleDays: 0~30 → stale: 0~1
  const staleDaysCapped = Math.min(daysSince, V6_CONFIG.STALE_DAYS_CAP);
  const staleNormalized = staleDaysCapped / V6_CONFIG.STALE_DAYS_CAP; // 0~1

  // 가중치 적용: 0~1 → 0~10
  const bonus = staleNormalized * V6_CONFIG.STALE_BONUS_WEIGHT;
  return -bonus; // 음수 = 점수 낮음 = 우선순위 높음
}

/**
 * [v6.0 통합 점수] 업체별 종합 점수 계산 (낮을수록 좋음)
 * 2026-01-05: ChatGPT 추천 - 이동비용 페널티 추가, 월/금 함수 시그니처 변경
 * @param {Object} company - 업체 객체
 * @param {number} dayIdx - 날짜 인덱스
 * @param {Date} date - 날짜 객체
 * @param {string} monthKey - 월 키 (YYYY-MM)
 * @param {number} relaxLevel - 완화 레벨 (0~3)
 * @returns {number} - 종합 점수
 */
function calculateCompanyScoreV6(company, dayIdx, date, monthKey, relaxLevel = 0) {
  const relax = V6_CONFIG.RELAXATION_LEVELS[relaxLevel] || V6_CONFIG.RELAXATION_LEVELS[0];
  const region = company.region || '기타';
  const dateStr = date.toISOString().split('T')[0];

  // Soft 제약 점수 (완화 레벨 적용)
  const cooldownPenalty = getRegionCooldownPenaltyV6(region, dayIdx) * relax.cooldownPenaltyMult;
  const monthlyPenalty = getMonthlyVisitPenaltyV6(company.id, monthKey) * relax.monthlyPenaltyMult;
  const monFriPref = getMonFriPreferenceV6(date, company); // 2026-01-05: company 객체 전달

  // 희소성/Stale 보너스 (완화 레벨과 무관)
  const scarcityBonus = getScarcityBonus(company.id, monthKey);
  const staleBonus = getStaleBonus(company, dateStr);

  // ChatGPT 추천: 이동비용 페널티 (본사 기준 거리)
  // 후보 선정 단계에서 먼 업체를 약하게 억제
  let travelPenalty = 0;
  if (company.latitude && company.longitude) {
    const distFromBase = haversineDistance(
      V6_CONFIG.BASE_LAT, V6_CONFIG.BASE_LNG,
      parseFloat(company.latitude), parseFloat(company.longitude)
    );
    // 정규화: distKm / 60 → 0~1+ (60km 이상도 가능)
    // 가중치: +3점 per 60km
    travelPenalty = (distFromBase / V6_CONFIG.TRAVEL_PENALTY_SCALE) * V6_CONFIG.TRAVEL_PENALTY_WEIGHT;
  }

  return cooldownPenalty + monthlyPenalty + monFriPref + scarcityBonus + staleBonus + travelPenalty;
}

/**
 * [v6.0 Hard 필터] 배정 가능 업체만 필터링
 * 2026-01-05 v6.1: 월/금 거리 하드제약 추가 (ChatGPT + Claude 협업 검증)
 * @param {Array} companies - 전체 업체 배열
 * @param {string} monthKey - 월 키 (YYYY-MM)
 * @param {Set} assignedToday - 오늘 이미 배정된 업체 ID
 * @param {Date} date - 현재 날짜 (월/금 판단용)
 * @param {number} relaxLevel - 완화 레벨 (0~2, 월/금 거리 제한 완화용)
 * @returns {Array} - 배정 가능한 업체 배열
 */
function filterByHardConstraints(companies, monthKey, assignedToday, date = null, relaxLevel = 0) {
  // 월/금 판단
  const dayOfWeek = date ? date.getDay() : -1;
  const isMonOrFri = (dayOfWeek === 1 || dayOfWeek === 5);

  // 월/금 거리 제한 (단계별 완화)
  const monFriLimit = isMonOrFri
    ? (V6_CONFIG.MON_FRI_HARD_LIMITS[Math.min(relaxLevel, V6_CONFIG.MON_FRI_HARD_LIMITS.length - 1)])
    : Infinity;

  return companies.filter(c => {
    // 1. 오늘 이미 배정됨
    if (assignedToday.has(c.id)) return false;

    // 2. 월 3회 초과
    if (isHardCapExceeded(c.id, monthKey)) return false;

    // 3. 좌표 없음 (거리 계산 불가)
    if (!c.latitude || !c.longitude) return false;

    // 4. [v6.1 신규] 월/금 거리 하드제약
    if (isMonOrFri) {
      const distFromHQ = haversineDistance(
        V6_CONFIG.BASE_LAT, V6_CONFIG.BASE_LNG,
        parseFloat(c.latitude), parseFloat(c.longitude)
      );
      if (distFromHQ > monFriLimit) {
        return false;
      }
    }

    return true;
  });
}

/**
 * [v6.0 Top-N 추출] 점수 기반 상위 후보 추출
 * @param {Array} companies - 후보 업체 배열
 * @param {number} dayIdx - 날짜 인덱스
 * @param {Date} date - 날짜 객체
 * @param {string} monthKey - 월 키 (YYYY-MM)
 * @param {number} targetCount - 하루 목표 방문 수
 * @param {number} relaxLevel - 완화 레벨
 * @returns {Array} - 상위 N개 후보
 */
function extractTopNCandidates(companies, dayIdx, date, monthKey, targetCount, relaxLevel = 0) {
  // 점수 계산
  const scored = companies.map(c => ({
    ...c,
    _v6Score: calculateCompanyScoreV6(c, dayIdx, date, monthKey, relaxLevel)
  }));

  // 점수순 정렬 (낮을수록 좋음)
  scored.sort((a, b) => a._v6Score - b._v6Score);

  // Top-N 추출
  const topN = targetCount * V6_CONFIG.TOP_N_MULTIPLIER;
  return scored.slice(0, topN);
}

/**
 * [v6.1 신규] 지역 클러스터링 - 업체를 시/군(region) 기준으로 그룹화
 * 2026-01-05: ChatGPT + Claude 협업 설계
 * @param {Array} companies - 업체 배열
 * @returns {Map} - 지역 → 업체 배열
 */
function clusterByRegion(companies) {
  const clusters = new Map();
  companies.forEach(c => {
    const region = c.region || '기타';
    if (!clusters.has(region)) clusters.set(region, []);
    clusters.get(region).push(c);
  });
  return clusters;
}

/**
 * [v6.1 신규] 클러스터 우선 후보 선택 - 같은 지역 업체를 우선 배정
 * 2026-01-05: ChatGPT 권장 - "지역 클러스터 단위로 날짜에 배정"
 * @param {Array} candidates - 점수 계산된 후보 배열 (_v6Score 포함)
 * @param {number} maxCount - 최대 선택 개수
 * @returns {Array} - 클러스터 우선 정렬된 후보 배열
 */
function selectByClusterPriority(candidates, maxCount) {
  if (candidates.length === 0) return [];

  // 1. 지역별 클러스터 생성
  const clusters = clusterByRegion(candidates);

  // 2. 클러스터를 크기순 정렬 (같은 지역 업체 많은 순)
  const sortedClusters = Array.from(clusters.entries())
    .sort((a, b) => b[1].length - a[1].length);

  // 3. 가장 큰 클러스터의 대표 지역 선택
  const primaryRegion = sortedClusters[0][0];
  const primaryCluster = sortedClusters[0][1];

  // 4. 1순위: 대표 지역 업체 (점수순)
  primaryCluster.sort((a, b) => a._v6Score - b._v6Score);
  const selected = [...primaryCluster];

  // 5. 2순위: 인접 지역 업체 (부족할 경우)
  if (selected.length < maxCount) {
    // 대표 지역 업체의 centroid 계산
    const centroidLat = primaryCluster.reduce((sum, c) => sum + parseFloat(c.latitude), 0) / primaryCluster.length;
    const centroidLng = primaryCluster.reduce((sum, c) => sum + parseFloat(c.longitude), 0) / primaryCluster.length;

    // 다른 클러스터의 업체들을 centroid와의 거리순 정렬
    const otherCandidates = candidates
      .filter(c => c.region !== primaryRegion)
      .map(c => ({
        ...c,
        _distFromCentroid: haversineDistance(centroidLat, centroidLng, parseFloat(c.latitude), parseFloat(c.longitude))
      }))
      .sort((a, b) => a._distFromCentroid - b._distFromCentroid);

    // 부족한 만큼 채우기
    const remaining = maxCount - selected.length;
    selected.push(...otherCandidates.slice(0, remaining));
  }

  // v6.1: 실제 선택된 개수로 로그 출력 (maxCount 제한 반영)
  const finalSelected = selected.slice(0, maxCount);
  const primaryCount = Math.min(primaryCluster.length, maxCount);
  const adjacentCount = finalSelected.length - primaryCount;
  console.log(`    📍 클러스터 선택: ${primaryRegion} ${primaryCount}개 + 인접 ${Math.max(0, adjacentCount)}개`);

  return finalSelected;
}

/**
 * [v6.1 신규] 지역 전환 횟수 계산 - 2-opt 비용 함수에 사용
 * @param {Array} route - 방문 순서 배열
 * @returns {number} - 지역 전환 횟수
 */
function countRegionSwitches(route) {
  let switches = 0;
  for (let i = 1; i < route.length; i++) {
    if (route[i].region !== route[i - 1].region) {
      switches++;
    }
  }
  return switches;
}

// ===== v6.0 통합 알고리즘 (ChatGPT + Claude 교차 검증) =====
// 최적 경로(거리 기반) + v5.1 제약(쿨다운, 월2회) + 희소성/stale 보너스
async function generateScheduleV6() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 v6.0 통합 알고리즘 시작 (ChatGPT + Claude 협업)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const startStr = el.startDate.value;
  const endStr = el.endDate.value;

  if (!startStr || !endStr) {
    toast('시작일과 종료일을 선택하세요.');
    return;
  }

  try {
    // ===== 1. 업체 필터링 =====
    let companies = applyColorFilter(state.companies, state.filterColors);

    // Pre-flight 제외
    if (state.excludedIds.length > 0) {
      const excludedSet = new Set(state.excludedIds);
      companies = companies.filter(c => !excludedSet.has(c.id));
    }

    // 지역 필터
    if (state.filterRegions.length > 0) {
      companies = companies.filter(c => state.filterRegions.includes(c.region));
    }

    // 검색 키워드 필터
    if (state.searchKeyword) {
      const kw = state.searchKeyword.toLowerCase();
      companies = companies.filter(c => (c.company_name || '').toLowerCase().includes(kw));
    }

    // 선택된 업체만 필터
    if (state.selectedCompanies.length > 0) {
      companies = companies.filter(c => state.selectedCompanies.includes(c.id));
    }

    if (companies.length === 0) {
      toast('필터에 해당하는 업체가 없습니다.');
      el.calendar.innerHTML = '<div class="hint">업체가 없습니다.</div>';
      return;
    }

    console.log(`📊 필터 후 업체 수: ${companies.length}개`);

    // 좌표 있는 업체만 (경로 계산용)
    const companiesWithCoords = companies.filter(c => c.latitude && c.longitude);
    console.log(`📍 좌표 있는 업체: ${companiesWithCoords.length}개`);

    if (companiesWithCoords.length === 0) {
      toast('좌표가 있는 업체가 없습니다.');
      el.calendar.innerHTML = '<div class="hint">좌표가 있는 업체가 없습니다.</div>';
      return;
    }

    // ===== 2. 날짜 범위 생성 (buildDays 형식 사용) =====
    const allDays = buildDays(startStr, endStr);
    const workdays = allDays.filter(d => !d.isWeekend && !d.isHoliday && !d.isOff);

    if (workdays.length === 0) {
      toast('선택된 기간에 평일이 없습니다.');
      return;
    }

    console.log(`📅 평일 수: ${workdays.length}일`);

    // ===== 3. 옵션 파싱 =====
    const rangeStr = document.querySelector('input[name="cap"]:checked')?.value || '4-5';
    const [minStr, maxStr] = rangeStr.split('-');
    const min = parseInt(minStr) || 4;
    const max = parseInt(maxStr) || 5;
    const target = Math.floor((min + max) / 2);

    console.log(`🎯 방문 범위: min=${min}, max=${max}, target=${target}`);

    // ===== 4. 상태 초기화 =====
    state.schedule = allDays;  // buildDays 배열 그대로 사용
    state.regionCooldown = new Map();
    state.monthlyVisits = new Map();

    // 날짜 키로 빠르게 day 객체를 찾기 위한 맵
    const dayMap = new Map();
    allDays.forEach(day => dayMap.set(day.date, day));

    // 남은 업체 풀
    let remainingPool = [...companiesWithCoords];
    const assignedIds = new Set();
    let totalAssigned = 0;

    // ===== 4.5 고정 업체 처리 (v6.2 ChatGPT + Claude 협업) =====
    // 고정 인덱스 재구성
    rebuildPinIndex();

    // 업체 ID → 객체 맵 생성 (applyPinsToSchedule에서 사용)
    const companyMap = new Map();
    companiesWithCoords.forEach(c => companyMap.set(c.id, c));

    // 고정 업체를 스케줄에 먼저 배정하고 후보에서 제외
    remainingPool = applyPinsToSchedule(allDays, remainingPool, companyMap);

    // 고정된 업체는 assignedIds에 추가
    for (const pin of state.pinnedCompanies) {
      if (companyMap.has(pin.companyId)) {
        assignedIds.add(pin.companyId);
        totalAssigned++;
      }
    }

    console.log(`📊 고정 후 남은 후보: ${remainingPool.length}개`);

    // ===== 5. 날짜별 배정 루프 =====
    for (let dayIdx = 0; dayIdx < workdays.length; dayIdx++) {
      const currentDay = workdays[dayIdx];  // day 객체
      const dateKey = currentDay.date;      // 'YYYY-MM-DD' 문자열
      const monthKey = dateKey.substring(0, 7); // 'YYYY-MM'

      console.log(`\n📆 Day ${dayIdx + 1}: ${dateKey}`);

      // 오늘 배정할 목록
      const todayAssigned = [];

      // v6.1: 현재 날짜 객체 (월/금 판단용)
      const currentDate = new Date(currentDay.date + 'T00:00:00');
      const dayOfWeek = currentDate.getDay();
      const isMonOrFri = (dayOfWeek === 1 || dayOfWeek === 5);
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][dayOfWeek];

      if (isMonOrFri) {
        console.log(`  📍 ${dayName}요일 - 근거리(${V6_CONFIG.MON_FRI_HARD_LIMITS[0]}km) 우선 모드`);
      }

      // ===== 5.1 단계적 완화 (Relaxation Ladder) =====
      let relaxLevel = 0;
      let candidates = [];

      while (relaxLevel < V6_CONFIG.RELAXATION_LEVELS.length) {
        // Hard 제약 필터 (todayAssigned 배열 → Set 변환)
        // v6.1: 월/금 거리 하드제약 적용 (currentDate, relaxLevel 전달)
        const todayIds = new Set(todayAssigned.map(c => c.id));
        const afterHard = filterByHardConstraints(remainingPool, monthKey, todayIds, currentDate, relaxLevel);

        if (afterHard.length === 0 && relaxLevel < V6_CONFIG.RELAXATION_LEVELS.length - 1) {
          const limitKm = isMonOrFri ? V6_CONFIG.MON_FRI_HARD_LIMITS[Math.min(relaxLevel, 2)] : '∞';
          console.log(`  ⚠️ Level ${relaxLevel}: Hard 필터 후 0개 (거리제한: ${limitKm}km) → 완화 시도`);
          relaxLevel++;
          continue;
        }

        // Top-N 후보 추출 (Soft 점수 기반)
        candidates = extractTopNCandidates(afterHard, dayIdx, currentDate, monthKey, target, relaxLevel);

        if (candidates.length >= min) {
          console.log(`  ✅ Level ${relaxLevel}: 후보 ${candidates.length}개 확보`);
          break;
        }

        if (relaxLevel < V6_CONFIG.RELAXATION_LEVELS.length - 1) {
          console.log(`  ⚠️ Level ${relaxLevel}: 후보 ${candidates.length}개 < min(${min}) → 완화 시도`);
          relaxLevel++;
        } else {
          console.log(`  ⚠️ 최종 Level: 후보 ${candidates.length}개 (부족해도 진행)`);
          break;
        }
      }

      if (candidates.length === 0) {
        console.log(`  ❌ 후보 없음 → 스킵`);
        continue;
      }

      // ===== 5.2 클러스터 우선 선택 + Nearest Neighbor + 2-opt =====
      // v6.2: 고정 업체가 있으면 고정 업체를 seed로 사용하고 그 근처 업체 선택
      const dayObj = dayMap.get(dateKey);
      const pinnedForToday = dayObj?.companies?.filter(c => c._isPinned) || [];

      let clusteredCandidates;
      let seed;

      if (pinnedForToday.length > 0) {
        // 고정 업체가 있는 경우: 고정 업체 중 첫 번째를 seed로 사용
        seed = pinnedForToday[0];
        console.log(`  📌 고정 업체 기준 배정: ${seed.company_name} (${seed.region})`);

        // 후보 업체들을 고정 업체와의 거리 순으로 정렬
        candidates.sort((a, b) => {
          const distA = haversineDistance(
            parseFloat(seed.latitude), parseFloat(seed.longitude),
            parseFloat(a.latitude), parseFloat(a.longitude)
          );
          const distB = haversineDistance(
            parseFloat(seed.latitude), parseFloat(seed.longitude),
            parseFloat(b.latitude), parseFloat(b.longitude)
          );
          return distA - distB;
        });

        // 가까운 업체들만 선택 (max개까지)
        clusteredCandidates = candidates.slice(0, max * 2);
        console.log(`    → 고정 업체 근처 후보: ${clusteredCandidates.slice(0, 3).map(c => `${c.company_name}(${c.region})`).join(', ')}...`);
      } else {
        // 고정 업체가 없는 경우: 기존 로직 (v6.1 클러스터 우선)
        clusteredCandidates = selectByClusterPriority(candidates, max);

        // Seed 선택: 클러스터 우선 후보 중 v6 점수가 가장 낮은 업체
        clusteredCandidates.sort((a, b) => a._v6Score - b._v6Score);
        seed = clusteredCandidates[0];
        todayAssigned.push(seed);
        assignedIds.add(seed.id);
      }

      // Nearest Neighbor로 나머지 채우기 (클러스터 우선 후보에서)
      let remaining = clusteredCandidates.filter(c => c.id !== seed.id);
      let current = seed;

      // v6.2: 고정 업체 수만큼 배정 목표 조정
      const adjustedMax = max - pinnedForToday.length;

      while (todayAssigned.length < adjustedMax && remaining.length > 0) {
        // 거리 + v6 점수를 결합한 effectiveCost 계산
        let bestIdx = 0;
        let bestCost = Infinity;

        for (let i = 0; i < remaining.length; i++) {
          const cand = remaining[i];
          const dist = haversineDistance(
            parseFloat(current.latitude), parseFloat(current.longitude),
            parseFloat(cand.latitude), parseFloat(cand.longitude)
          );
          // effectiveCost = 거리(km) + v6점수 * 가중치
          const effectiveCost = dist + (cand._v6Score * 0.5);
          if (effectiveCost < bestCost) {
            bestCost = effectiveCost;
            bestIdx = i;
          }
        }

        const next = remaining[bestIdx];
        todayAssigned.push(next);
        assignedIds.add(next.id);
        remaining.splice(bestIdx, 1);
        current = next;
      }

      // ===== 5.3 2-opt 개선 + 지역 전환 패널티 (v6.1) =====
      if (todayAssigned.length >= 3) {
        let improved = true;
        let iterations = 0;
        const maxIterations = 100;

        // v6.1: 초기 지역 전환 횟수 로그
        const initialSwitches = countRegionSwitches(todayAssigned);
        console.log(`    🔄 2-opt 시작: 초기 지역 전환 ${initialSwitches}회`);

        while (improved && iterations < maxIterations) {
          improved = false;
          iterations++;

          for (let i = 0; i < todayAssigned.length - 1; i++) {
            for (let j = i + 2; j < todayAssigned.length; j++) {
              const a = todayAssigned[i];
              const b = todayAssigned[i + 1];
              const c = todayAssigned[j];
              const d = todayAssigned[(j + 1) % todayAssigned.length] || todayAssigned[0];

              // v6.1: 거리 + 지역 전환 패널티 통합 비용
              const currentDist = haversineDistance(
                parseFloat(a.latitude), parseFloat(a.longitude),
                parseFloat(b.latitude), parseFloat(b.longitude)
              ) + haversineDistance(
                parseFloat(c.latitude), parseFloat(c.longitude),
                parseFloat(d.latitude), parseFloat(d.longitude)
              );

              // 현재 경로의 지역 전환 패널티
              const currentSwitchPenalty =
                (a.region !== b.region ? V6_CONFIG.REGION_SWITCH_PENALTY : 0) +
                (c.region !== d.region ? V6_CONFIG.REGION_SWITCH_PENALTY : 0);

              const newDist = haversineDistance(
                parseFloat(a.latitude), parseFloat(a.longitude),
                parseFloat(c.latitude), parseFloat(c.longitude)
              ) + haversineDistance(
                parseFloat(b.latitude), parseFloat(b.longitude),
                parseFloat(d.latitude), parseFloat(d.longitude)
              );

              // 새 경로의 지역 전환 패널티
              const newSwitchPenalty =
                (a.region !== c.region ? V6_CONFIG.REGION_SWITCH_PENALTY : 0) +
                (b.region !== d.region ? V6_CONFIG.REGION_SWITCH_PENALTY : 0);

              // v6.1: 거리 + 지역 전환 패널티 합산 비교
              const currentCost = currentDist + currentSwitchPenalty;
              const newCost = newDist + newSwitchPenalty;

              if (newCost < currentCost - 0.1) {
                // Reverse segment [i+1, j]
                const segment = todayAssigned.splice(i + 1, j - i);
                segment.reverse();
                todayAssigned.splice(i + 1, 0, ...segment);
                improved = true;
                break;
              }
            }
            if (improved) break;
          }
        }

        // v6.1: 최종 지역 전환 횟수 계산
        const finalSwitches = countRegionSwitches(todayAssigned);
        if (iterations > 1 || initialSwitches !== finalSwitches) {
          console.log(`  🔄 2-opt: ${iterations}회 반복, 지역 전환 ${initialSwitches}→${finalSwitches}회`);
        }
      }

      // ===== 5.4 순번 및 거리 표시 추가 =====
      todayAssigned.forEach((comp, idx) => {
        comp._orderNum = idx + 1;
        if (idx > 0) {
          const prev = todayAssigned[idx - 1];
          comp._distFromPrev = haversineDistance(
            parseFloat(prev.latitude), parseFloat(prev.longitude),
            parseFloat(comp.latitude), parseFloat(comp.longitude)
          );
        } else {
          comp._distFromPrev = null;
        }
      });

      // ===== 5.5 상태 업데이트 =====
      // dayMap을 통해 해당 날짜의 day 객체를 찾아 companies에 할당
      const dayObj = dayMap.get(dateKey);
      if (dayObj) {
        // v6.2 버그 수정: 고정 업체 보존 (기존 고정 업체 + 새로 배정된 업체)
        const existingPinned = (dayObj.companies || []).filter(c => c._isPinned);
        dayObj.companies = [...existingPinned, ...todayAssigned];
      }

      // 지역 쿨다운 갱신
      const regionsToday = new Set(todayAssigned.map(c => c.region || '기타'));
      regionsToday.forEach(r => state.regionCooldown.set(r, dayIdx));

      // 월간 방문 횟수 갱신 (키 형식: companyId-YYYY-MM)
      todayAssigned.forEach(c => {
        const key = `${c.id}-${monthKey}`;
        const prev = state.monthlyVisits.get(key) || 0;
        state.monthlyVisits.set(key, prev + 1);
      });

      // 남은 풀에서 제거
      remainingPool = remainingPool.filter(c => !assignedIds.has(c.id));
      totalAssigned += todayAssigned.length;

      console.log(`  ✅ 배정: ${todayAssigned.length}개, 지역: [${[...regionsToday].join(', ')}]`);
    }

    // ===== 6. 미배정 처리 =====
    state.unassigned = remainingPool;

    // ===== 7. 렌더링 =====
    renderCalendar();
    renderUnassigned();
    updateDirtyState();

    const unassignedCount = state.unassigned.length;
    toast(`🚀 v6.0 스케줄 생성 완료! 배정: ${totalAssigned}개, 미배정: ${unassignedCount}개`);

    console.log('');
    console.log('🎉🎉🎉 v6.0 통합 알고리즘 완료 🎉🎉🎉');
    console.log(`총 배정: ${totalAssigned}개, 미배정: ${unassignedCount}개`);
    console.log('');

  } catch (e) {
    console.error('v6.0 알고리즘 오류:', e);
    toast('v6.0 오류: ' + e.message);
    el.calendar.innerHTML = `<div class="hint" style="color: red;">오류: ${e.message}</div>`;
  }
}

// ===== 근접성 점수 계산 (ChatGPT + Claude 협업 설계) =====
// 낮을수록 더 가까움 - Seed 기준으로 후보들을 정렬할 때 사용
const PROXIMITY_WEIGHT = {
  sameGroup: 0,        // 같은 groupKey (김해|한림면)
  sameRegionDiffSub: 20, // 같은 region, 다른 읍면동
  adjacentRegion: 40,  // 인접 지역 (REGION_ADJACENCY에 정의)
  diffRegion: 80,      // 완전히 다른 지역
};

// ===== 안정 키 함수 (ChatGPT 리뷰 반영) =====
// c.id가 없거나 undefined일 때를 대비한 고유 키 생성
function getCompanyKey(c) {
  return c.id ?? `${c.region ?? '기타'}|${getLocationGroupKey(c) ?? ''}|${c.address ?? ''}|${c.name ?? ''}`;
}

function proximityScore(seed, candidate) {
  const seedKey = getLocationGroupKey(seed);
  const candKey = getLocationGroupKey(candidate);
  const seedRegion = seed.region || '기타';
  const candRegion = candidate.region || '기타';

  // 1) 같은 groupKey면 최우선 (같은 지역 + 같은 읍면동)
  // ★ ChatGPT 리뷰 반영: null/빈값 방어 (가짜 동일 그룹 버그 수정)
  if (seedKey && candKey && seedKey === candKey) {
    return PROXIMITY_WEIGHT.sameGroup;
  }

  // 2) 같은 region이면 다음 우선
  if (seedRegion === candRegion) {
    return PROXIMITY_WEIGHT.sameRegionDiffSub;
  }

  // 3) 인접 지역이면 중간 우선
  const neighbors = REGION_ADJACENCY[seedRegion] || [];
  if (neighbors.includes(candRegion)) {
    return PROXIMITY_WEIGHT.adjacentRegion;
  }

  // 4) 그 외 먼 지역
  return PROXIMITY_WEIGHT.diffRegion;
}

// ===== 지역별 인덱스 생성 (빠른 후보 탐색용) =====
function buildGeoIndex(companies) {
  const byGroupKey = new Map(); // "김해|한림면" -> [company...]
  const byRegion = new Map();   // "김해" -> [company...]

  for (const c of companies) {
    const gk = getLocationGroupKey(c);
    const region = c.region || '기타';

    if (!byGroupKey.has(gk)) byGroupKey.set(gk, []);
    byGroupKey.get(gk).push(c);

    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push(c);
  }

  return { byGroupKey, byRegion };
}

// ===== 하루 업체 선택 (Seed + 근접순) =====
// Seed는 기존 우선순위로 선택, 나머지는 Seed 근접순으로 채움
function pickDayCompanies(remaining, dailyCapacity, index) {
  if (remaining.length === 0) return [];

  // 1) Seed 선택: 기존 우선순위(색상→방문일→방문횟수) 기준으로 첫 업체
  // ★ ChatGPT 리뷰 반영: 원본 배열 변경 방지 (spread 연산자 사용)
  const sorted = [...remaining].sort(compareCompanies);
  const seed = sorted[0];
  const seedKey = getLocationGroupKey(seed);
  const seedRegion = seed.region || '기타';

  const picked = [seed];
  // ★ ChatGPT 리뷰 반영: 안정 키 사용 (c.id가 undefined일 때 대비)
  const pickedIds = new Set([getCompanyKey(seed)]);

  // 2) 후보 풀을 "가까운 순서로" 확장해서 모으기
  const candidates = [];
  const addedIds = new Set([getCompanyKey(seed)]);

  const addCandidates = (arr) => {
    for (const c of arr || []) {
      const key = getCompanyKey(c);
      if (!addedIds.has(key)) {
        candidates.push(c);
        addedIds.add(key);
      }
    }
  };

  // 같은 groupKey 최우선
  addCandidates(index.byGroupKey.get(seedKey));
  // 같은 region 다음
  addCandidates(index.byRegion.get(seedRegion));
  // 인접 지역
  const neighbors = REGION_ADJACENCY[seedRegion] || [];
  for (const r of neighbors) {
    addCandidates(index.byRegion.get(r));
  }
  // 안전망: 후보가 부족하면 전체 remaining 추가
  if (candidates.length < dailyCapacity * 2) {
    addCandidates(remaining);
  }

  // 3) 후보를 근접성 점수로 정렬 + 동점이면 기존 우선순위로 정렬
  // ★ ChatGPT 리뷰 반영: 안정 키로 필터링 (c.id가 undefined일 때 대비)
  const seedCompanyKey = getCompanyKey(seed);
  const scored = candidates
    .filter(c => getCompanyKey(c) !== seedCompanyKey)
    .map(c => ({
      c,
      score: proximityScore(seed, c)
    }));

  scored.sort((x, y) => {
    // 근접성 점수 우선
    if (x.score !== y.score) return x.score - y.score;
    // 동점이면 기존 우선순위 (색상→방문일→방문횟수)
    return compareCompanies(x.c, y.c);
  });

  // 4) dailyCapacity까지 채우기
  for (const { c } of scored) {
    if (picked.length >= dailyCapacity) break;
    const key = getCompanyKey(c);
    if (pickedIds.has(key)) continue;
    picked.push(c);
    pickedIds.add(key);
  }

  return picked;
}

// ===== 하루 방문 수 옵션 =====
const CAP_OPTIONS = {
  '1-3': { min: 1, max: 3, target: 2 },
  '4-5': { min: 4, max: 5, target: 5 },
  '6-8': { min: 6, max: 8, target: 7 },
  '9-11': { min: 9, max: 11, target: 10 },
};

// ===== 유틸리티 함수 =====
// 🔧 2026-01-04: UTC→로컬 시간대 버그 수정
// 문제: toISOString()은 UTC 기준이라 한국(UTC+9)에서 하루 전 날짜 반환
// 해결: 로컬 시간 기준으로 포맷
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateKey(date) {
  return formatDate(date);
}

function getDayName(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2500);
}

// ===== lastVisitAt 정규화 (ChatGPT 설계) =====
// 다양한 형태의 타임스탬프를 밀리초로 변환
function toMillis(ts) {
  if (ts == null) return null;

  // Firestore Timestamp 형태 {seconds, nanoseconds}
  if (typeof ts === 'object' && ts.seconds != null) {
    return Number(ts.seconds) * 1000 + Math.floor((Number(ts.nanoseconds) || 0) / 1e6);
  }

  // Date 객체
  if (ts instanceof Date) {
    const t = ts.getTime();
    return Number.isFinite(t) ? t : null;
  }

  // number (밀리초)
  if (typeof ts === 'number') {
    return Number.isFinite(ts) ? ts : null;
  }

  // string (ISO 형식 등)
  if (typeof ts === 'string') {
    const t = Date.parse(ts);
    return Number.isFinite(t) ? t : null;
  }

  return null;
}

// ===== Seed 선택: lastVisitAt이 가장 오래된 업체 (ChatGPT 설계) =====
// 클러스터 크기나 거리와 상관없이 오직 lastVisitAt 기준
function chooseSeed(unassignedCompanies) {
  if (!unassignedCompanies || unassignedCompanies.length === 0) return null;

  let seed = null;
  let bestTime = Infinity; // 작을수록 오래된 방문

  for (const c of unassignedCompanies) {
    const t = toMillis(c.last_visit_date);
    // lastVisitAt이 없으면 "미방문"으로 보고 최우선(가장 오래됨) 처리
    const effectiveTime = (t == null) ? -Infinity : t;

    if (effectiveTime < bestTime) {
      bestTime = effectiveTime;
      seed = c;
    }
  }

  return seed;
}

// ===== Seed 지역 주변으로 하루 채우기 (ChatGPT 설계) =====
// 우선순위: 1) 같은 locationGroupKey 2) 같은 region 3) 인접 지역 4) 기타
function buildDayPlan({ unassigned, seed, visitsPerDay = 9 }) {
  const seedKey = getLocationGroupKey(seed);
  const seedRegion = seed.region || '기타';
  const day = [seed];

  // seed 제외한 남은 풀
  const remaining = unassigned.filter(x => x !== seed);

  // 1) 같은 locationGroupKey
  const sameKey = [];
  // 2) 같은 region (단, sameKey 아닌 것)
  const sameRegion = [];
  // 3) 인접 지역
  const adjacentRegions = [];
  // 4) 그 외
  const others = [];

  for (const c of remaining) {
    const k = getLocationGroupKey(c);
    if (k === seedKey) {
      sameKey.push(c);
    } else if (c.region === seedRegion) {
      sameRegion.push(c);
    } else {
      // 인접 지역 체크
      const neighbors = REGION_ADJACENCY[seedRegion] || [];
      if (neighbors.includes(c.region)) {
        adjacentRegions.push(c);
      } else {
        others.push(c);
      }
    }
  }

  // "Seed 주변"을 더 강하게: 같은 키/지역 내에서도 lastVisitAt 오래된 순으로 방문
  const byOldestFirst = (a, b) => {
    const ta = toMillis(a.last_visit_date);
    const tb = toMillis(b.last_visit_date);
    const ea = (ta == null) ? -Infinity : ta;
    const eb = (tb == null) ? -Infinity : tb;
    return ea - eb; // 오래된(작은) 먼저
  };

  sameKey.sort(byOldestFirst);
  sameRegion.sort(byOldestFirst);
  adjacentRegions.sort(byOldestFirst);
  others.sort(byOldestFirst);

  const pushUntil = (arr) => {
    for (const c of arr) {
      if (day.length >= visitsPerDay) break;
      day.push(c);
    }
  };

  pushUntil(sameKey);
  pushUntil(sameRegion);
  pushUntil(adjacentRegions);
  // 옵션: 해당 지역/그룹 물량이 부족하면 남은 오래된 순으로 채움
  pushUntil(others);

  return day;
}

// ===== 거리 기반 Seed 주변 업체 선택 (ChatGPT + Claude 협업 2026-01-04) =====
// 문제: 기존 buildDayPlan은 region 이름으로만 그룹핑하여 김제(전북)와 김해(경남)가 같은 날 배정됨
// 해결: Haversine 거리 기반 + 반경 가드로 실제 가까운 업체만 배정

/**
 * 두 업체 간 직선거리 계산 (km)
 * route-optimizer.js의 haversineDistance 재사용
 */
function getDistanceKm(companyA, companyB) {
  // geo 필드가 없으면 null 반환
  if (!companyA.geo?.lat || !companyA.geo?.lng ||
      !companyB.geo?.lat || !companyB.geo?.lng) {
    return null;
  }

  // route-optimizer.js의 haversineDistance 사용 (전역)
  if (typeof haversineDistance === 'function') {
    return haversineDistance(
      companyA.geo.lat, companyA.geo.lng,
      companyB.geo.lat, companyB.geo.lng
    );
  }

  // fallback: 직접 계산
  const R = 6371; // 지구 반지름 (km)
  const dLat = (companyB.geo.lat - companyA.geo.lat) * Math.PI / 180;
  const dLng = (companyB.geo.lng - companyA.geo.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(companyA.geo.lat * Math.PI / 180) *
            Math.cos(companyB.geo.lat * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * 방문일로부터 경과 일수 계산
 */
function daysSinceLastVisit(company) {
  const t = company.last_visit_date ? Date.parse(company.last_visit_date) : NaN;
  if (!Number.isFinite(t)) return 99999; // 방문 기록 없으면 최우선
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

/**
 * 후보 업체 점수 계산 (낮을수록 우선)
 * - wDist: 거리 가중치 (1.0)
 * - wAge: 오래된 방문일 보너스 (0.15)
 */
function scoreCandidate({ current, candidate, wDist = 1.0, wAge = 0.15 }) {
  const km = getDistanceKm(current, candidate);
  if (km === null) return Number.POSITIVE_INFINITY; // 좌표 없으면 최후순위

  const age = daysSinceLastVisit(candidate);
  // 거리는 가까울수록, 오래됐을수록 점수가 낮아짐 (우선순위 높음)
  return (wDist * km) - (wAge * age);
}

/**
 * 거리 기반 하루 업체 배정 (Nearest Neighbor + 반경 가드)
 * ★ ChatGPT Ultra Think 설계:
 * 1. Seed는 방문한지 가장 오래된 업체
 * 2. 반경을 단계적으로 확장 (20→40→80→150km)하며 가까운 업체 우선 선택
 * 3. 김제-김해 같은 200km 장거리 혼합 방지
 */
function buildDayPlanDistanceFirst({
  unassigned,
  seed,
  visitsPerDay = 9,
  radiusStepsKm = [20, 40, 80, 150], // 반경 확장 단계
  wDist = 1.0,
  wAge = 0.15
}) {
  const day = [seed];
  const remaining = unassigned.filter(x => x !== seed);
  let current = seed;

  // Seed에 좌표가 없으면 기존 region 기반 로직으로 폴백
  if (!seed.geo?.lat || !seed.geo?.lng) {
    console.warn('⚠️ Seed에 좌표 없음, region 기반 폴백:', seed.company_name);
    return buildDayPlan({ unassigned, seed, visitsPerDay });
  }

  while (day.length < visitsPerDay && remaining.length > 0) {
    let pickedIndex = -1;

    // 반경을 단계적으로 확장하며 최적 후보 찾기
    for (const radiusKm of radiusStepsKm) {
      let bestScore = Number.POSITIVE_INFINITY;
      let bestIdx = -1;

      for (let i = 0; i < remaining.length; i++) {
        const c = remaining[i];
        const km = getDistanceKm(current, c);

        if (km === null) continue; // 좌표 없으면 스킵
        if (km > radiusKm) continue; // 반경 밖은 스킵

        const score = scoreCandidate({ current, candidate: c, wDist, wAge });
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        pickedIndex = bestIdx;
        break; // 이 반경에서 찾았으면 확장 중단
      }
    }

    // 반경 내에서 못 찾았으면 fallback: 좌표 있는 후보 중 최선
    if (pickedIndex === -1) {
      let bestScore = Number.POSITIVE_INFINITY;
      let bestIdx = -1;

      for (let i = 0; i < remaining.length; i++) {
        const c = remaining[i];
        const score = scoreCandidate({ current, candidate: c, wDist, wAge });
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) break; // 더 이상 배정 불가
      pickedIndex = bestIdx;
    }

    // 선택된 업체를 day에 추가하고 remaining에서 제거
    const next = remaining.splice(pickedIndex, 1)[0];
    day.push(next);
    current = next;
  }

  return day;
}

// ===== 색상 필터 적용 (필터 역할만!) =====
function applyColorFilter(companies, selectedColors) {
  if (!selectedColors || selectedColors.length === 0) return companies;
  const set = new Set(selectedColors);
  return companies.filter(c => set.has(c.color_code));
}

// ===== 주소에서 동/면/읍 추출 =====
function extractSubDistrict(address) {
  if (!address) return '기타';

  // 패턴: "시/군 + 동/면/읍/리"
  // 예: "경남 김해시 상동면 매리" -> "상동면"
  // 예: "경남 김해시 명법동 1120-7" -> "명법동"

  const patterns = [
    /시\s+([가-힣]+[동면읍])/,      // 김해시 상동면
    /군\s+([가-힣]+[동면읍])/,      // XX군 XX면
    /구\s+([가-힣]+동)/,            // XX구 XX동
  ];

  for (const pattern of patterns) {
    const match = address.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return '기타';
}

// ===== 위치 그룹 키 생성 =====
function getLocationGroupKey(company) {
  const region = company.region || '기타';
  const subDistrict = extractSubDistrict(company.address);
  return `${region}|${subDistrict}`;
}

// ===== 한국 공휴일 API =====
async function loadHolidaysForRange(startStr, endStr) {
  state.holidays.clear();

  const startYear = parseInt(startStr.split('-')[0]);
  const endYear = parseInt(endStr.split('-')[0]);

  // 2024-2026년 한국 공휴일 (하드코딩 - API 대체)
  const KOREAN_HOLIDAYS = {
    '2024': [
      { date: '2024-01-01', name: '신정' },
      { date: '2024-02-09', name: '설날 연휴' },
      { date: '2024-02-10', name: '설날' },
      { date: '2024-02-11', name: '설날 연휴' },
      { date: '2024-02-12', name: '대체공휴일' },
      { date: '2024-03-01', name: '삼일절' },
      { date: '2024-04-10', name: '국회의원선거일' },
      { date: '2024-05-05', name: '어린이날' },
      { date: '2024-05-06', name: '대체공휴일' },
      { date: '2024-05-15', name: '부처님오신날' },
      { date: '2024-06-06', name: '현충일' },
      { date: '2024-08-15', name: '광복절' },
      { date: '2024-09-16', name: '추석 연휴' },
      { date: '2024-09-17', name: '추석' },
      { date: '2024-09-18', name: '추석 연휴' },
      { date: '2024-10-03', name: '개천절' },
      { date: '2024-10-09', name: '한글날' },
      { date: '2024-12-25', name: '크리스마스' },
    ],
    '2025': [
      { date: '2025-01-01', name: '신정' },
      { date: '2025-01-28', name: '설날 연휴' },
      { date: '2025-01-29', name: '설날' },
      { date: '2025-01-30', name: '설날 연휴' },
      { date: '2025-03-01', name: '삼일절' },
      { date: '2025-03-03', name: '대체공휴일' },
      { date: '2025-05-05', name: '어린이날' },
      { date: '2025-05-05', name: '부처님오신날' },
      { date: '2025-05-06', name: '대체공휴일' },
      { date: '2025-06-06', name: '현충일' },
      { date: '2025-08-15', name: '광복절' },
      { date: '2025-10-03', name: '개천절' },
      { date: '2025-10-05', name: '추석 연휴' },
      { date: '2025-10-06', name: '추석' },
      { date: '2025-10-07', name: '추석 연휴' },
      { date: '2025-10-08', name: '대체공휴일' },
      { date: '2025-10-09', name: '한글날' },
      { date: '2025-12-25', name: '크리스마스' },
    ],
    '2026': [
      { date: '2026-01-01', name: '신정' },
      { date: '2026-02-16', name: '설날 연휴' },
      { date: '2026-02-17', name: '설날' },
      { date: '2026-02-18', name: '설날 연휴' },
      { date: '2026-03-01', name: '삼일절' },
      { date: '2026-03-02', name: '대체공휴일' },
      { date: '2026-05-05', name: '어린이날' },
      { date: '2026-05-24', name: '부처님오신날' },
      { date: '2026-05-25', name: '대체공휴일' },
      { date: '2026-06-06', name: '현충일' },
      { date: '2026-08-15', name: '광복절' },
      { date: '2026-08-17', name: '대체공휴일' },
      { date: '2026-09-24', name: '추석 연휴' },
      { date: '2026-09-25', name: '추석' },
      { date: '2026-09-26', name: '추석 연휴' },
      { date: '2026-10-03', name: '개천절' },
      { date: '2026-10-05', name: '대체공휴일' },
      { date: '2026-10-09', name: '한글날' },
      { date: '2026-12-25', name: '크리스마스' },
    ],
  };

  for (let year = startYear; year <= endYear; year++) {
    const yearHolidays = KOREAN_HOLIDAYS[year.toString()] || [];
    yearHolidays.forEach(h => {
      state.holidays.set(h.date, h.name);
    });
  }

  console.log(`공휴일 로드 완료: ${state.holidays.size}개`);
}

// ===== 업체 데이터 로드 =====
// ===== 업체별 좌표 데이터 로딩 (ChatGPT + Claude 협업 2026-01-04) =====
// route-optimizer.js의 GeoCodeCache 및 geocodeAddress 사용
async function loadCompanyGeoData(companies) {
  if (!companies || companies.length === 0) return;

  const maxPerRun = 30; // 한 번에 최대 30개 지오코딩 (API 부하 방지)
  const delayMs = 150; // API 호출 간 딜레이
  let geocodedCount = 0;

  for (const c of companies) {
    // 1. localStorage 캐시에서 geo 확인 (GeoCodeCache)
    if (typeof GeoCodeCache !== 'undefined' && c.address) {
      const cached = GeoCodeCache.get(c.address);
      if (cached && cached.lat && cached.lng) {
        c.geo = cached;
        c.latitude = cached.lat;   // v6.0 호환
        c.longitude = cached.lng;  // v6.0 호환
        continue;
      }
    }

    // 2. 캐시에 없으면 geocodeAddress로 지오코딩 (최대 maxPerRun개)
    if (geocodedCount < maxPerRun && c.address && typeof geocodeAddress === 'function') {
      try {
        const geo = await geocodeAddress(c.address);
        if (geo && geo.lat && geo.lng) {
          c.geo = geo;
          c.latitude = geo.lat;   // v6.0 호환
          c.longitude = geo.lng;  // v6.0 호환
          geocodedCount++;

          // API 호출 간 딜레이
          if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
          }
        }
      } catch (e) {
        console.warn('[loadCompanyGeoData] 지오코딩 실패:', c.company_name, e);
      }
    }
  }

  // 지오코딩 결과 로그
  const withGeo = companies.filter(c => c.geo?.lat && c.geo?.lng).length;
  console.log(`[loadCompanyGeoData] ${withGeo}/${companies.length} 업체 좌표 로딩 완료 (신규 ${geocodedCount}개)`);
}

async function loadCompanies() {
  el.loadState.textContent = '업체 로딩 중...';

  try {
    const { data, error } = await supabaseDB
      .from('client_companies')
      .select('id, company_name, region, address, color_code, visit_count, last_visit_date')
      .eq('user_id', USER_ID)
      .order('region')
      .order('company_name');

    if (error) throw error;

    state.companies = data || [];

    // 거리 기반 스케줄링을 위한 geo 데이터 로딩 (2026-01-04 ChatGPT+Claude 협업)
    // route-optimizer.js의 GeoCodeCache 및 geocodeAddress 사용
    await loadCompanyGeoData(state.companies);

    // 색상 및 지역 목록 추출
    const colorSet = new Set();
    const regionSet = new Set();

    state.companies.forEach(c => {
      if (c.color_code) colorSet.add(c.color_code);
      if (c.region) regionSet.add(c.region);
    });

    state.colors = Array.from(colorSet).sort();
    state.regions = Array.from(regionSet).sort();

    // 위치 그룹 생성
    buildLocationGroups();

    el.loadState.textContent = `${state.companies.length}개 업체`;
    renderColorChips();
    renderRegionList();

  } catch (e) {
    console.error('업체 로드 실패:', e);
    el.loadState.textContent = '오류';
    toast('업체 로드 실패: ' + e.message);
  }
}

// ===== 위치 그룹 빌드 =====
function buildLocationGroups() {
  state.locationGroups.clear();

  state.companies.forEach(company => {
    const key = getLocationGroupKey(company);
    if (!state.locationGroups.has(key)) {
      state.locationGroups.set(key, []);
    }
    state.locationGroups.get(key).push(company);
  });

  console.log(`위치 그룹: ${state.locationGroups.size}개`);

  // 디버그: 그룹별 업체 수 출력
  state.locationGroups.forEach((companies, key) => {
    if (companies.length > 5) {
      console.log(`  ${key}: ${companies.length}개`);
    }
  });
}

// ===== 필터링된 업체 목록 =====
function getFilteredCompanies() {
  return state.companies.filter(c => {
    // 색상 필터
    if (state.filterColors.length > 0) {
      if (!state.filterColors.includes(c.color_code)) return false;
    }

    // 지역 필터
    if (state.filterRegions.length > 0) {
      if (!state.filterRegions.includes(c.region)) return false;
    }

    // 검색 키워드
    if (state.searchKeyword) {
      const kw = state.searchKeyword.toLowerCase();
      const name = (c.company_name || '').toLowerCase();
      if (!name.includes(kw)) return false;
    }

    return true;
  });
}

// ===== 색상 칩 렌더링 (우선순위 순서: 빨강→주황→노랑→초록→하늘→파랑→보라→회색) =====
function renderColorChips() {
  // COLOR_PRIORITY 순서대로 정렬 (데이터에 있는 색상만 표시)
  const sortedColors = COLOR_PRIORITY.filter(c => state.colors.includes(c));

  el.colorChips.innerHTML = sortedColors.map(color => {
    const info = COLOR_MAP[color] || { name: color, cssClass: 'gray' };
    const isOn = state.filterColors.includes(color);
    const count = state.companies.filter(c => c.color_code === color).length;
    return `
      <div class="chip" data-color="${color}" data-on="${isOn ? '1' : '0'}">
        <span class="dot ${info.cssClass}"></span>
        <span>${info.name} (${count})</span>
      </div>
    `;
  }).join('');

  // 이벤트 바인딩
  el.colorChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const color = chip.dataset.color;
      const isOn = chip.dataset.on === '1';

      if (isOn) {
        state.filterColors = state.filterColors.filter(c => c !== color);
        chip.dataset.on = '0';
      } else {
        state.filterColors.push(color);
        chip.dataset.on = '1';
      }

      updateSelectedCount();
      updateEstimate();
    });
  });
}

// ===== 지역 리스트 렌더링 =====
function renderRegionList() {
  const regionCounts = {};
  state.companies.forEach(c => {
    if (c.region) {
      regionCounts[c.region] = (regionCounts[c.region] || 0) + 1;
    }
  });

  el.regionList.innerHTML = state.regions.map(region => {
    const count = regionCounts[region] || 0;
    const isChecked = state.filterRegions.includes(region);
    return `
      <div class="row">
        <input type="checkbox" data-region="${region}" ${isChecked ? 'checked' : ''} />
        <div>${region}</div>
        <div class="meta">${count}개</div>
      </div>
    `;
  }).join('');

  // 이벤트 바인딩
  el.regionList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const region = cb.dataset.region;
      if (cb.checked) {
        if (!state.filterRegions.includes(region)) {
          state.filterRegions.push(region);
        }
      } else {
        state.filterRegions = state.filterRegions.filter(r => r !== region);
      }
      updateSelectedCount();
      updateEstimate();
    });
  });
}

// ===== 선택 업체 수 업데이트 =====
function updateSelectedCount() {
  const filtered = getFilteredCompanies();
  const count = state.selectedCompanies.length > 0
    ? state.selectedCompanies.length
    : filtered.length;
  el.selectedCount.textContent = count;
}

// ===== 근무일 계산 =====
function buildDays(startStr, endStr) {
  const days = [];
  const start = parseDate(startStr);
  const end = parseDate(endStr);

  const current = new Date(start);
  while (current <= end) {
    const key = dateKey(current);
    const weekend = isWeekend(current);
    const holidayName = state.holidays.get(key);

    days.push({
      date: key,
      dayName: getDayName(current),
      isWeekend: weekend,
      isHoliday: !!holidayName,
      holidayName: holidayName || null,
      isOff: false,  // 사용자 지정 휴무
      companies: [],
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}

// ===== 근무일 수 카운트 =====
function countWorkdays(days) {
  return days.filter(d => !d.isWeekend && !d.isHoliday && !d.isOff).length;
}

// ===== 근무일 UI 업데이트 =====
function updateWorkdayCountUI() {
  const startStr = el.startDate.value;
  const endStr = el.endDate.value;

  if (!startStr || !endStr) {
    el.workdayCount.textContent = '-';
    return;
  }

  const days = buildDays(startStr, endStr);
  const workdays = countWorkdays(days);
  el.workdayCount.textContent = workdays;
}

// ===== 추정 일수 계산 =====
function updateEstimate() {
  const startStr = el.startDate.value;
  const endStr = el.endDate.value;

  if (!startStr || !endStr) {
    el.estimateBox.textContent = '기간/필터를 설정하면 "필요 일수 추정"이 표시됩니다.';
    return;
  }

  const filtered = getFilteredCompanies();
  const companyCount = state.selectedCompanies.length > 0
    ? state.selectedCompanies.length
    : filtered.length;

  const capValue = document.querySelector('input[name="cap"]:checked')?.value || '4-5';
  const cap = CAP_OPTIONS[capValue];

  const days = buildDays(startStr, endStr);
  const workdays = countWorkdays(days);
  const neededDays = Math.ceil(companyCount / cap.target);

  if (neededDays > workdays) {
    el.estimateBox.innerHTML = `
      <b>주의!</b> ${companyCount}개 업체 ÷ 하루 ${cap.target}개 = <b>${neededDays}일 필요</b><br/>
      현재 근무일: ${workdays}일 → <span style="color:#b00020;"><b>${neededDays - workdays}일 부족</b></span>
    `;
  } else {
    el.estimateBox.innerHTML = `
      ${companyCount}개 업체 ÷ 하루 ${cap.target}개 = <b>${neededDays}일 필요</b><br/>
      현재 근무일: ${workdays}일 → <span style="color:#0b3;"><b>충분</b></span>
    `;
  }
}

// ===== 최적 경로 스케줄 생성 (카카오맵 거리 기반) =====
// ★ ChatGPT + Claude Ultra Think 설계: Nearest Neighbor + 2-opt 알고리즘
// 실제 주행거리 기반으로 1 → 2 → 3 → 4 → 5... 순서로 가까운 업체 연결
async function generateScheduleOptimal(companies, days, cap) {
  if (!window.RouteOptimizer) {
    toast('경로 최적화 모듈이 로드되지 않았습니다.');
    console.error('RouteOptimizer 모듈 없음');
    return;
  }

  // 로딩 표시
  el.calendar.innerHTML = `
    <div class="hint" style="padding: 40px; text-align: center;">
      <h3>🚗 최적 경로 계산 중...</h3>
      <p>카카오맵 API를 사용하여 실제 주행거리를 계산합니다.</p>
      <p>업체 수에 따라 수 분이 소요될 수 있습니다.</p>
      <p style="margin-top: 20px; font-size: 12px; color: #666;">
        콘솔(F12)에서 진행 상황을 확인할 수 있습니다.
      </p>
    </div>
  `;

  try {
    // 근무일만 필터
    const workdays = days.filter(d => !d.isWeekend && !d.isHoliday && !d.isOff);

    console.log('');
    console.log('🚗🚗🚗 최적 경로 알고리즘 시작 🚗🚗🚗');
    console.log(`업체: ${companies.length}개, 근무일: ${workdays.length}일, 하루 방문: ${cap.target}개`);

    // RouteOptimizer 호출 (시간이 오래 걸릴 수 있음)
    const optimalRoutes = await window.RouteOptimizer.generateOptimalRoutes(
      companies,
      null,        // 시작점 (null = 첫 업체)
      cap.target   // 하루 방문 수
    );

    if (!optimalRoutes || optimalRoutes.length === 0) {
      toast('경로 생성 실패: 좌표가 없는 업체가 많습니다.');
      el.calendar.innerHTML = '<div class="hint">경로 생성 실패. 업체 주소를 확인하세요.</div>';
      return;
    }

    // 결과를 기존 스케줄 형식으로 변환
    let dayIdx = 0;
    let totalAssigned = 0;

    for (const optRoute of optimalRoutes) {
      if (dayIdx >= workdays.length) {
        // 근무일이 부족하면 나머지는 미배정
        console.log(`⚠️ 근무일 부족: ${optimalRoutes.length - optimalRoutes.indexOf(optRoute)}일분 미배정`);
        break;
      }

      // 해당 날짜에 업체 배정 (workdays는 이미 근무일만 필터된 배열)
      workdays[dayIdx].companies = optRoute.route;
      totalAssigned += optRoute.route.length;

      console.log(`📅 ${workdays[dayIdx].date}: ${optRoute.route.length}개 업체, 총 ${optRoute.totalDistanceKm}km`);

      dayIdx++;
    }

    // 미배정 업체 계산
    const assignedIds = new Set();
    days.forEach(d => {
      d.companies.forEach(c => assignedIds.add(c.id));
    });
    state.unassigned = companies.filter(c => !assignedIds.has(c.id));

    state.schedule = days;
    state.isDirty = true;

    // 렌더링
    renderCalendar();
    renderUnassigned();
    updateDirtyState();

    const unassignedCount = state.unassigned.length;
    toast(`🚗 최적 경로 생성 완료! 배정: ${totalAssigned}개, 미배정: ${unassignedCount}개`);

    console.log('');
    console.log('🎉🎉🎉 최적 경로 생성 완료 🎉🎉🎉');
    console.log(`총 배정: ${totalAssigned}개, 미배정: ${unassignedCount}개`);
    console.log('');

  } catch (e) {
    console.error('최적 경로 생성 오류:', e);
    toast('경로 생성 오류: ' + e.message);
    el.calendar.innerHTML = `<div class="hint" style="color: red;">오류: ${e.message}</div>`;
  }
}

// ===== 소수 지역 병합용 헬퍼 함수 (2026-01-04 ChatGPT + Claude) =====

/**
 * 지역 centroid (중심점) 계산
 * @param {Array} companies - 업체 배열
 * @returns {Object|null} - { lat, lng } 또는 null
 */
function calculateRegionCentroid(companies) {
  const validCoords = companies.filter(c => c.latitude && c.longitude);
  if (validCoords.length === 0) return null;

  const sumLat = validCoords.reduce((sum, c) => sum + parseFloat(c.latitude), 0);
  const sumLng = validCoords.reduce((sum, c) => sum + parseFloat(c.longitude), 0);

  return {
    lat: sumLat / validCoords.length,
    lng: sumLng / validCoords.length
  };
}

/**
 * Haversine 공식으로 두 좌표 간 거리 계산 (km)
 * @param {number} lat1 - 위도1
 * @param {number} lng1 - 경도1
 * @param {number} lat2 - 위도2
 * @param {number} lng2 - 경도2
 * @returns {number} - 거리 (km)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 지구 반경 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ===== 스케줄 생성 (ChatGPT + Claude 협업 설계 v3) =====
// ★ 기본 알고리즘: Seed = lastVisitAt 가장 오래된 업체 → 그 지역 주변으로 하루 채움
// 예: 오늘 창원 8~9군데, 내일 김해 8~9군데, 다음날 양산 8~9군데
async function generateSchedule() {
  const startStr = el.startDate.value;
  const endStr = el.endDate.value;

  if (!startStr || !endStr) {
    toast('시작일과 종료일을 선택하세요.');
    return;
  }

  // ★ 색상 필터 적용 (필터 역할만! 우선순위 아님)
  let companies = applyColorFilter(state.companies, state.filterColors);

  // ★ Pre-flight 제외 업체 필터링 (2026-01-04 추가)
  if (state.excludedIds.length > 0) {
    const excludedSet = new Set(state.excludedIds);
    const beforeCount = companies.length;
    companies = companies.filter(c => !excludedSet.has(c.id));
    console.log(`📌 Pre-flight 제외: ${beforeCount}개 → ${companies.length}개 (${state.excludedIds.length}개 제외)`);
  }

  // 지역 필터 적용
  if (state.filterRegions.length > 0) {
    companies = companies.filter(c => state.filterRegions.includes(c.region));
  }

  // 검색 키워드 필터
  if (state.searchKeyword) {
    const kw = state.searchKeyword.toLowerCase();
    companies = companies.filter(c => (c.company_name || '').toLowerCase().includes(kw));
  }

  // 선택된 업체만 필터
  if (state.selectedCompanies.length > 0) {
    companies = companies.filter(c => state.selectedCompanies.includes(c.id));
  }

  if (companies.length === 0) {
    toast('배정할 업체가 없습니다.');
    return;
  }

  // 하루 방문 수 설정
  const capValue = document.querySelector('input[name="cap"]:checked')?.value || '4-5';
  const cap = CAP_OPTIONS[capValue];

  // 날짜 목록 생성
  const days = buildDays(startStr, endStr);

  // ★★★ v6.0 통합 알고리즘 (ChatGPT + Claude 교차 검증) ★★★
  // 거리 기반 최적 경로 + v5.1 제약 (쿨다운, 월2회) + 희소성/stale 보너스
  await generateScheduleV6();
  return;

  // ===== [레거시] v5.1 알고리즘 - v6.0으로 통합됨 =====
  // 핵심: 지역 쿨다운 3~4일 + 월 2회 방문 제한 + 월/금 근거리 약한 선호
  // 우선순위: A.하드(공휴일, 하루 방문 수) → B.소프트(쿨다운, 월 2회) → C.약(월금 근거리)
  let pool = [...companies];

  console.log('📊 v5.1 알고리즘: ChatGPT + Claude Ultra Think 협업 (2026-01-05)');
  console.log(`  총 업체: ${pool.length}개`);
  console.log(`  옵션: min=${cap.min}, max=${cap.max}, target=${cap.target}`);
  console.log(`  v5.1 신규: 쿨다운 ${V5_CONFIG.REGION_COOLDOWN_MIN}~${V5_CONFIG.REGION_COOLDOWN_MAX}일, 월 ${V5_CONFIG.MONTHLY_VISIT_CAP}회 제한`);

  // ★ v5.1: 상태 초기화
  state.regionCooldown.clear();
  state.monthlyVisits.clear();

  // 근무일 필터링
  const workdays = days.filter(d => !d.isWeekend && !d.isHoliday && !d.isOff);
  let totalAssigned = 0;

  // ★ Step 1: 업체를 지역별로 그룹화
  const regionGroups = new Map();
  pool.forEach(c => {
    const region = c.region || '기타';
    if (!regionGroups.has(region)) {
      regionGroups.set(region, []);
    }
    regionGroups.get(region).push(c);
  });

  // ★ Step 2: 각 지역 그룹 내에서 방문 우선순위 정렬 (오래된 것 먼저)
  regionGroups.forEach((companies, region) => {
    companies.sort((a, b) => {
      const aDate = a.last_visit_date ? new Date(a.last_visit_date) : new Date(0);
      const bDate = b.last_visit_date ? new Date(b.last_visit_date) : new Date(0);
      return aDate - bDate; // 오래된 것 먼저
    });
  });

  // ★ Step 2.5: 소수 지역 병합 (2026-01-04 ChatGPT + Claude Ultra Think)
  // 핵심: 업체 수 < min인 지역은 인접 지역에 흡수 (경산 1개 → 대구/영천에 병합)
  const MIN_REGION_SIZE = cap.min; // 최소 지역 크기 (기본: min=3)
  const smallRegions = [];
  const normalRegions = [];

  regionGroups.forEach((companies, region) => {
    if (companies.length < MIN_REGION_SIZE) {
      smallRegions.push({ region, companies });
    } else {
      normalRegions.push({ region, companies });
    }
  });

  if (smallRegions.length > 0) {
    console.log(`  📍 소수 지역 병합: ${smallRegions.length}개 지역 (${smallRegions.map(r => `${r.region}:${r.companies.length}개`).join(', ')})`);

    // 소수 지역 업체를 가장 가까운 일반 지역에 병합
    for (const smallRegion of smallRegions) {
      if (normalRegions.length === 0) {
        // 일반 지역이 없으면 소수 지역끼리 합침
        console.log(`    ⚠️ ${smallRegion.region}: 병합할 일반 지역 없음 - 유지`);
        continue;
      }

      // 좌표 기반 가장 가까운 지역 찾기
      let bestTarget = null;
      let bestDistance = Infinity;

      // 소수 지역의 centroid 계산
      const smallCentroid = calculateRegionCentroid(smallRegion.companies);

      if (smallCentroid) {
        for (const normalRegion of normalRegions) {
          const normalCentroid = calculateRegionCentroid(normalRegion.companies);
          if (normalCentroid) {
            const dist = haversineDistance(smallCentroid.lat, smallCentroid.lng, normalCentroid.lat, normalCentroid.lng);
            if (dist < bestDistance) {
              bestDistance = dist;
              bestTarget = normalRegion;
            }
          }
        }
      }

      // 좌표가 없으면 첫 번째 일반 지역에 병합
      if (!bestTarget) {
        bestTarget = normalRegions[0];
      }

      // 병합 실행
      console.log(`    🔗 ${smallRegion.region}(${smallRegion.companies.length}개) → ${bestTarget.region}에 병합 (거리: ${Math.round(bestDistance)}km)`);
      bestTarget.companies.push(...smallRegion.companies);

      // 원래 그룹에서 제거
      regionGroups.delete(smallRegion.region);
    }
  }

  // ★ Step 3.5: 베이스캠프 좌표 설정 (2026-01-04 ChatGPT + Claude)
  // 부산광역시 사상구 낙동대로 832 (남경철강 본사)
  const BASECAMP = {
    lat: 35.1547,
    lng: 128.9914,
    name: '부산 사상구'
  };

  // ★ v5.1 Step 4: 각 근무일마다 최적 지역 선택 (쿨다운 + 월금 보너스 적용)
  // 기존: 지역별로 연속 배정 → v5.1: 날짜별로 최적 지역 선택 (지역 다양성 확보)
  console.log('  🔄 v5.1: 지역 쿨다운 기반 배정 시작...');

  for (let workdayIdx = 0; workdayIdx < workdays.length; workdayIdx++) {
    const day = workdays[workdayIdx];
    const currentDate = parseDate(day.date);
    const monthKey = getMonthKey(day.date);

    // 배정 가능한 업체가 있는 지역 목록 생성 (+ 점수 계산)
    const availableRegions = [];

    for (const [region, companies] of regionGroups.entries()) {
      // 아직 배정 안 된 업체만 필터
      const unassigned = companies.filter(c => !c._assigned);
      if (unassigned.length === 0) continue;

      // ★ v5.1 점수 계산
      let score = 0;

      // 1. 지역 쿨다운 페널티 (3~4일 이내 배정 시 페널티)
      score += getRegionCooldownPenalty(region, workdayIdx);

      // 2. 월/금 근거리 보너스 (약한 선호)
      score += getMondayFridayNearbyBonus(currentDate, region);

      // 3. 가장 오래된 업체 기준 우선순위 (낮을수록 우선)
      const oldestDate = unassigned[0].last_visit_date
        ? new Date(unassigned[0].last_visit_date).getTime()
        : 0;
      score += oldestDate / (1000 * 60 * 60 * 24 * 365); // 연 단위로 정규화

      availableRegions.push({
        region,
        companies: unassigned,
        score
      });
    }

    // 배정할 지역이 없으면 종료
    if (availableRegions.length === 0) {
      console.log(`  ⚠️ ${day.date}: 배정 가능한 업체 없음`);
      break;
    }

    // ★ v5.1: 모든 지역이 쿨다운 상태일 때 폴백
    const allInCooldown = availableRegions.every(r =>
      isRegionInCooldown(r.region, workdayIdx)
    );
    if (allInCooldown) {
      console.log(`  ⚠️ ${day.date}: 모든 지역 쿨다운 중 - 최우선 지역 강제 배정`);
    }

    // 점수순 정렬 (낮을수록 우선)
    availableRegions.sort((a, b) => a.score - b.score);

    // 최적 지역 선택
    const bestRegion = availableRegions[0];
    const region = bestRegion.region;
    let regionCompanies = bestRegion.companies;

    // ★ 베이스캠프 거리 기반 max 조정
    const regionCentroid = calculateRegionCentroid(regionCompanies);
    let adjustedMax = cap.max;

    if (regionCentroid) {
      const distFromBase = haversineDistance(BASECAMP.lat, BASECAMP.lng, regionCentroid.lat, regionCentroid.lng);

      if (distFromBase > 100) {
        adjustedMax = Math.max(cap.min, cap.max - 2);
      } else if (distFromBase > 50) {
        adjustedMax = Math.max(cap.min, cap.max - 1);
      }
    }

    // ★ v5.1: 월간 방문 제한 적용하여 업체 필터링
    const eligibleCompanies = [];
    const overCapCompanies = []; // 월 2회 초과 업체 (예비)

    for (const c of regionCompanies) {
      const visitCount = getMonthlyVisitCount(c.id, monthKey);
      if (visitCount < V5_CONFIG.MONTHLY_VISIT_CAP) {
        eligibleCompanies.push(c);
      } else {
        overCapCompanies.push(c);
      }
    }

    // 배정할 업체 선택 (월 2회 미만 우선, 부족하면 초과 업체도 허용)
    let toAssign = eligibleCompanies.slice(0, adjustedMax);
    if (toAssign.length < cap.min && overCapCompanies.length > 0) {
      // ★ v5.1: 업체 풀이 부족하면 월 3회도 허용
      const needed = cap.min - toAssign.length;
      const extra = overCapCompanies.slice(0, needed);
      toAssign = [...toAssign, ...extra];
      console.log(`  ⚠️ ${day.date}: 월 2회 초과 업체 ${extra.length}개 예외 허용 (풀 부족)`);
    }

    // 배정 실행
    if (toAssign.length > 0) {
      day.companies = toAssign;
      totalAssigned += toAssign.length;

      // ★ v5.1: 배정된 업체 마킹 + 월간 방문 카운트
      for (const c of toAssign) {
        c._assigned = true;
        incrementMonthlyVisit(c.id, monthKey);
      }

      // ★ v5.1: 지역 쿨다운 업데이트
      state.regionCooldown.set(region, workdayIdx);

      // 로그
      const cooldownStatus = isRegionInCooldown(region, workdayIdx) ? '(쿨다운중!)' : '';
      console.log(`  ${day.date}: ${region} ${toAssign.length}개 배정 ${cooldownStatus}`);
    }
  }

  // 마무리: _assigned 플래그 정리
  pool.forEach(c => delete c._assigned);

  // pool 업데이트 (배정된 업체 제거)
  const assignedIds = new Set();
  workdays.forEach(day => {
    if (day.companies) {
      day.companies.forEach(c => assignedIds.add(c.id));
    }
  });
  pool = pool.filter(c => !assignedIds.has(c.id));

  // 미배정 업체
  state.unassigned = pool;

  state.schedule = days;
  state.isDirty = true;

  renderCalendar();
  renderUnassigned();
  updateDirtyState();

  const unassignedCount = state.unassigned.length;
  console.log(`✅ v5.1 스케줄 생성 완료: 배정 ${totalAssigned}개, 미배정 ${unassignedCount}개`);
  toast(`스케줄 생성 완료! 배정: ${totalAssigned}개, 미배정: ${unassignedCount}개`);
}

// ===== 위치 기반 그룹핑 후 순서 정렬 =====
function groupCompaniesByLocation(companies) {
  // 지역+동면별로 그룹화
  const groups = new Map();

  companies.forEach(company => {
    const key = getLocationGroupKey(company);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(company);
  });

  // 그룹을 크기순으로 정렬 (큰 그룹 먼저)
  const sortedGroups = Array.from(groups.entries())
    .sort((a, b) => b[1].length - a[1].length);

  // 그룹 순서대로 업체 나열
  const result = [];
  sortedGroups.forEach(([key, groupCompanies]) => {
    // 그룹 내에서는 업체명 순으로 정렬
    groupCompanies.sort((a, b) =>
      (a.company_name || '').localeCompare(b.company_name || '')
    );
    result.push(...groupCompanies);
  });

  console.log(`그룹핑 결과: ${sortedGroups.length}개 그룹, ${result.length}개 업체`);

  return result;
}

// ===== 캘린더 렌더링 =====
function renderCalendar() {
  if (state.schedule.length === 0) {
    el.calendar.innerHTML = '<div class="hint">좌측에서 조건 설정 → "미리보기 생성"을 누르세요.</div>';
    el.calendarMeta.textContent = '-';
    return;
  }

  const totalDays = state.schedule.length;
  const workdays = countWorkdays(state.schedule);
  const assignedCompanies = state.schedule.reduce((sum, d) => sum + d.companies.length, 0);

  el.calendarMeta.textContent = `${totalDays}일 중 근무일 ${workdays}일 / 배정 ${assignedCompanies}개`;

  el.calendar.innerHTML = state.schedule.map((day, idx) => {
    const badges = [];
    if (day.isWeekend) badges.push('<span class="badge weekend">주말</span>');
    if (day.isHoliday) badges.push(`<span class="badge holiday">${day.holidayName}</span>`);
    if (day.isOff) badges.push('<span class="badge off">휴무</span>');

    // 색상 분포 표시 (우선순위 순)
    const colorCounts = {};
    day.companies.forEach(c => {
      const color = c.color_code || 'gray';
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    });
    const colorSummary = COLOR_PRIORITY
      .filter(c => colorCounts[c])
      .map(c => {
        const info = COLOR_MAP[c];
        return `<span class="dot ${info.cssClass}" title="${info.name}: ${colorCounts[c]}개"></span>`;
      })
      .join('');

    const isDisabled = day.isWeekend || day.isHoliday || day.isOff;

    // 한국어 날짜 포맷 사용
    const koreanDate = formatKoreanLabel(day.date);

    return `
      <div class="day-card ${isDisabled ? 'day-disabled' : ''}" data-idx="${idx}">
        <div class="day-hd">
          <div class="leftline">
            <span class="day-date">${koreanDate}</span>
            ${badges.join('')}
            <span class="color-dots">${colorSummary}</span>
          </div>
          <div class="day-actions">
            ${!isDisabled ? `<button class="btn-sm" data-action="off" data-idx="${idx}">휴무</button>` : ''}
            ${day.isOff ? `<button class="btn-sm" data-action="unoff" data-idx="${idx}">휴무 해제</button>` : ''}
          </div>
        </div>
        <ul class="day-list ${isDisabled ? 'disabled' : ''}" data-idx="${idx}">
          ${day.companies.map((c, companyIdx) => renderCompanyItem(c, companyIdx, day.companies[companyIdx - 1])).join('')}
        </ul>
        <div class="slotline">
          <span>${day.companies.length}개 업체</span>
        </div>
      </div>
    `;
  }).join('');

  // 휴무 버튼 이벤트
  el.calendar.querySelectorAll('[data-action="off"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      markDayOff(idx);
    });
  });

  el.calendar.querySelectorAll('[data-action="unoff"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      unmarkDayOff(idx);
    });
  });

  // SortableJS 초기화
  initSortable();
}

// ===== 한국어 날짜 포맷 (ChatGPT 설계) =====
function formatKoreanLabel(dateStr) {
  const d = parseDate(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayName = getDayName(d);
  return `${month}월 ${day}일 (${dayName})`;
}

// ===== 업체 아이템 HTML (v5.1: 순번 + 거리 표시 추가) =====
function renderCompanyItem(company, index = 0, prevCompany = null) {
  const colorInfo = COLOR_MAP[company.color_code] || { cssClass: 'gray', name: '미지정' };
  const subDistrict = extractSubDistrict(company.address);

  // 최근 방문일 포맷
  let visitInfo = '';
  if (company.last_visit_date) {
    const lastDate = new Date(company.last_visit_date);
    const month = lastDate.getMonth() + 1;
    const day = lastDate.getDate();
    visitInfo = `${month}/${day}`;
  } else {
    visitInfo = '미방문';
  }

  // 방문 횟수
  const visitCount = company.visit_count || 0;

  // ★ v5.1: 순번 표시 (1, 2, 3...)
  const orderNum = index + 1;

  // ★ v5.1: 이전 업체와의 거리 계산
  let distanceInfo = '';
  if (prevCompany && typeof getDistanceKm === 'function') {
    const km = getDistanceKm(prevCompany, company);
    if (km !== null && Number.isFinite(km)) {
      distanceInfo = `<span class="distance-info" title="이전 업체에서 거리">↑${km.toFixed(1)}km</span>`;
    }
  }

  // v6.2: 고정 업체 표시
  const isPinned = company._isPinned || false;
  const pinnedClass = isPinned ? 'pinned' : '';
  const pinnedIcon = isPinned ? '<span class="pin-icon" title="고정된 업체">📌</span>' : '';

  return `
    <li class="company-item ${pinnedClass}" data-id="${company.id}" title="색상: ${colorInfo.name} | 마지막방문: ${company.last_visit_date || '없음'} | 횟수: ${visitCount}회${isPinned ? ' | 📌 고정' : ''}">
      <span class="order-num">${orderNum}</span>
      <span class="dot ${colorInfo.cssClass}"></span>
      <span>${company.company_name}${pinnedIcon}</span>
      ${distanceInfo}
      <span class="visit-info">${visitInfo} (${visitCount}회)</span>
      <span class="sub">${company.region || ''}</span>
    </li>
  `;
}

// ===== 미배정 목록 렌더링 =====
function renderUnassigned() {
  el.unassignedList.innerHTML = state.unassigned
    .map(c => renderCompanyItem(c))
    .join('');

  initUnassignedSortable();
}

// ===== 휴무 지정 =====
function markDayOff(idx) {
  const day = state.schedule[idx];
  if (!day) return;

  // 해당 날짜의 업체들을 미배정으로 이동
  state.unassigned.push(...day.companies);
  day.companies = [];
  day.isOff = true;

  state.isDirty = true;

  renderCalendar();
  renderUnassigned();
  updateDirtyState();

  toast(`${day.date} 휴무 지정`);
}

// ===== 휴무 해제 =====
function unmarkDayOff(idx) {
  const day = state.schedule[idx];
  if (!day) return;

  day.isOff = false;
  state.isDirty = true;

  renderCalendar();
  updateDirtyState();

  toast(`${day.date} 휴무 해제`);
}

// ===== SortableJS 초기화 =====
let sortableInstances = [];

function initSortable() {
  // 기존 인스턴스 제거
  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];

  // 각 날짜의 리스트에 Sortable 적용
  el.calendar.querySelectorAll('.day-list:not(.disabled)').forEach(list => {
    const sortable = new Sortable(list, {
      group: 'companies',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        handleDragEnd(evt);
      }
    });
    sortableInstances.push(sortable);
  });
}

function initUnassignedSortable() {
  // 미배정 리스트
  const unassignedSortable = new Sortable(el.unassignedList, {
    group: 'companies',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: (evt) => {
      handleDragEnd(evt);
    }
  });
  sortableInstances.push(unassignedSortable);

  // 휴무 드롭존
  const offDropSortable = new Sortable(el.offDropList, {
    group: 'companies',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onAdd: (evt) => {
      handleOffDrop(evt);
    }
  });
  sortableInstances.push(offDropSortable);
}

// ===== 드래그 완료 처리 =====
function handleDragEnd(evt) {
  // 상태 동기화
  syncStateFromDOM();
  state.isDirty = true;
  updateDirtyState();
}

// ===== 휴무 드롭존에 드롭 시 =====
function handleOffDrop(evt) {
  const item = evt.item;
  const companyId = parseInt(item.dataset.id);

  // 드롭존에서 아이템 제거
  item.remove();

  // 어느 날짜에서 왔는지 찾기
  const fromIdx = parseInt(evt.from.dataset.idx);
  if (!isNaN(fromIdx)) {
    // 해당 날짜를 휴무로 지정
    markDayOff(fromIdx);
  }
}

// ===== DOM에서 상태 동기화 =====
function syncStateFromDOM() {
  // 각 날짜의 업체 목록 동기화
  state.schedule.forEach((day, idx) => {
    const list = el.calendar.querySelector(`.day-list[data-idx="${idx}"]`);
    if (list) {
      const ids = Array.from(list.querySelectorAll('.company-item'))
        .map(item => parseInt(item.dataset.id));
      day.companies = ids.map(id =>
        state.companies.find(c => c.id === id)
      ).filter(Boolean);
    }
  });

  // 미배정 목록 동기화
  const unassignedIds = Array.from(el.unassignedList.querySelectorAll('.company-item'))
    .map(item => parseInt(item.dataset.id));
  state.unassigned = unassignedIds.map(id =>
    state.companies.find(c => c.id === id)
  ).filter(Boolean);
}

// ===== 변경 상태 표시 =====
function updateDirtyState() {
  el.saveStatePill.style.display = state.isDirty ? 'block' : 'none';
}

// ===== 저장 =====
async function saveSchedule() {
  if (state.schedule.length === 0) {
    toast('저장할 스케줄이 없습니다.');
    return;
  }

  if (!USER_ID) {
    toast('로그인이 필요합니다.');
    return;
  }

  // 날짜 범위 추출
  const workdays = state.schedule.filter(d => !d.isOff && !d.isWeekend && !d.isHoliday);
  if (workdays.length === 0) {
    toast('저장할 근무일이 없습니다.');
    return;
  }

  const startDate = state.schedule[0].date;
  const endDate = state.schedule[state.schedule.length - 1].date;

  // 저장 확인 (ChatGPT 검증 반영: 방어적 코딩)
  const totalCompanies = state.schedule.reduce((sum, d) => sum + (d.companies ?? []).length, 0);
  const confirmMsg = `스케줄을 저장하시겠습니까?\n\n` +
    `📅 기간: ${startDate} ~ ${endDate}\n` +
    `📊 총 ${workdays.length}일, ${totalCompanies}개 업체`;

  if (!confirm(confirmMsg)) {
    return;
  }

  try {
    // 로딩 표시 (ChatGPT 검증 반영: 옵셔널 체이닝으로 방어)
    if (el?.btnSave) {
      el.btnSave.disabled = true;
      el.btnSave.textContent = '저장 중...';
    }

    // 스케줄 데이터 정리 (필요한 필드만 저장)
    // ChatGPT 검증 반영: || null → ?? null (0 값 보존), day.companies ?? [] (방어적 코딩)
    // v6.2: _isPinned 플래그 추가 (2026-01-10)
    const scheduleData = {
      version: '6.2-pinned',  // 버전 표시
      days: state.schedule.map(day => ({
        date: day.date,
        isOff: day.isOff || false,
        isWeekend: day.isWeekend || false,
        isHoliday: day.isHoliday || false,
        holidayName: day.holidayName ?? null,
        companies: (day.companies ?? []).map(c => ({
          id: c.id,
          name: c.name,
          region: c.region ?? null,
          address: c.address ?? null,
          color: c.color ?? null,
          distance_km: c.distance_km ?? null,
          _isPinned: c._isPinned || false  // v6.2: 고정 여부
        }))
      })),
      pinnedCompanies: state.pinnedCompanies  // v6.2: 고정 업체 목록
    };

    // 플랜 이름 생성 (년-월 형식)
    const planName = `${startDate.substring(0, 7)} 방문 스케줄`;

    // 기존 동일 기간 플랜 확인
    const { data: existingPlan, error: checkError } = await supabaseDB
      .from('visit_schedule_plans')
      .select('id')
      .eq('user_id', parseInt(USER_ID))
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .maybeSingle();

    if (checkError) {
      console.error('❌ 기존 플랜 확인 실패:', checkError);
      // 테이블이 없으면 생성 안내
      if (checkError.code === '42P01') {
        toast('테이블이 없습니다. 관리자에게 문의하세요.');
        return;
      }
      // PGRST116: "The result contains 0 rows" 에러는 무시 (기존 플랜 없음)
      if (checkError.code !== 'PGRST116') {
        throw checkError;
      }
    }

    let result;
    if (existingPlan) {
      // 기존 플랜 업데이트
      result = await supabaseDB
        .from('visit_schedule_plans')
        .update({
          plan_name: planName,
          schedule_data: scheduleData,
          total_days: workdays.length,
          total_companies: totalCompanies,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPlan.id)
        .select()
        .single();

      console.log('📝 스케줄 업데이트:', result);
    } else {
      // 새 플랜 생성
      result = await supabaseDB
        .from('visit_schedule_plans')
        .insert({
          user_id: parseInt(USER_ID),
          plan_name: planName,
          start_date: startDate,
          end_date: endDate,
          schedule_data: scheduleData,
          total_days: workdays.length,
          total_companies: totalCompanies,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      console.log('✅ 새 스케줄 저장:', result);
    }

    if (result.error) {
      throw result.error;
    }

    toast(`✅ 스케줄이 저장되었습니다. (${totalCompanies}개 업체)`);
    state.isDirty = false;
    updateDirtyState();

  } catch (error) {
    console.error('❌ 저장 실패:', error);
    toast(`저장 실패: ${error.message || '알 수 없는 오류'}`);
  } finally {
    // 버튼 복원 (ChatGPT 검증 반영: 옵셔널 체이닝으로 방어)
    if (el?.btnSave) {
      el.btnSave.disabled = false;
      el.btnSave.textContent = '저장';
    }
  }
}

// ===== 불러오기 (2026-01-05 추가) =====
let selectedPlanId = null;  // 선택된 스케줄 ID

// 불러오기 모달 열기
async function openLoadScheduleModal() {
  if (!USER_ID) {
    toast('로그인이 필요합니다.');
    return;
  }

  // 모달 표시
  el.loadScheduleOverlay.classList.add('show');
  el.loadScheduleList.innerHTML = '';
  el.loadScheduleEmpty.style.display = 'none';
  el.loadScheduleLoading.style.display = 'block';
  el.loadScheduleDelete.style.display = 'none';
  selectedPlanId = null;

  try {
    // 저장된 스케줄 목록 조회
    const { data: plans, error } = await supabaseDB
      .from('visit_schedule_plans')
      .select('id, plan_name, start_date, end_date, total_days, total_companies, created_at, updated_at')
      .eq('user_id', parseInt(USER_ID))
      .order('updated_at', { ascending: false });

    el.loadScheduleLoading.style.display = 'none';

    if (error) {
      console.error('❌ 스케줄 목록 조회 실패:', error);
      toast('스케줄 목록을 불러올 수 없습니다.');
      el.loadScheduleEmpty.textContent = '오류가 발생했습니다.';
      el.loadScheduleEmpty.style.display = 'block';
      return;
    }

    if (!plans || plans.length === 0) {
      el.loadScheduleEmpty.style.display = 'block';
      return;
    }

    // 스케줄 목록 렌더링
    plans.forEach(plan => {
      const item = document.createElement('div');
      item.className = 'schedule-load-item';
      item.dataset.planId = plan.id;

      const updatedDate = new Date(plan.updated_at).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      item.innerHTML = `
        <div class="info">
          <div class="plan-name">${escapeHtml(plan.plan_name)}</div>
          <div class="plan-meta">
            <span>📅 ${plan.start_date} ~ ${plan.end_date}</span>
            <span>📊 ${plan.total_days}일, ${plan.total_companies}개 업체</span>
          </div>
          <div class="plan-date">마지막 수정: ${updatedDate}</div>
        </div>
        <div class="check-icon">✓</div>
      `;

      // 클릭 이벤트 - 선택/해제
      item.addEventListener('click', () => {
        // 기존 선택 해제
        el.loadScheduleList.querySelectorAll('.schedule-load-item').forEach(el => {
          el.classList.remove('selected');
        });

        // 선택 토글
        if (selectedPlanId === plan.id) {
          selectedPlanId = null;
          el.loadScheduleDelete.style.display = 'none';
        } else {
          selectedPlanId = plan.id;
          item.classList.add('selected');
          el.loadScheduleDelete.style.display = 'inline-block';
        }
      });

      // 더블클릭 - 바로 불러오기
      item.addEventListener('dblclick', () => {
        selectedPlanId = plan.id;
        loadSelectedSchedule();
      });

      el.loadScheduleList.appendChild(item);
    });

    console.log(`📋 저장된 스케줄 ${plans.length}개 로드됨`);

  } catch (error) {
    console.error('❌ 스케줄 목록 조회 실패:', error);
    el.loadScheduleLoading.style.display = 'none';
    el.loadScheduleEmpty.textContent = '오류가 발생했습니다.';
    el.loadScheduleEmpty.style.display = 'block';
  }
}

// 불러오기 모달 닫기
function closeLoadScheduleModal() {
  el.loadScheduleOverlay.classList.remove('show');
  selectedPlanId = null;
}

// 선택한 스케줄 불러오기
async function loadSelectedSchedule() {
  if (!selectedPlanId) {
    toast('불러올 스케줄을 선택하세요.');
    return;
  }

  try {
    // 스케줄 데이터 조회
    const { data: plan, error } = await supabaseDB
      .from('visit_schedule_plans')
      .select('*')
      .eq('id', selectedPlanId)
      .single();

    if (error) {
      throw error;
    }

    if (!plan || !plan.schedule_data) {
      toast('스케줄 데이터가 없습니다.');
      return;
    }

    // 현재 스케줄이 있으면 확인
    if (state.schedule.length > 0) {
      if (!confirm('현재 스케줄이 있습니다. 덮어쓰시겠습니까?')) {
        return;
      }
    }

    // 스케줄 데이터 적용
    applyLoadedSchedule(plan);

    // 모달 닫기
    closeLoadScheduleModal();

    toast(`✅ "${plan.plan_name}" 스케줄을 불러왔습니다.`);
    console.log('✅ 스케줄 불러오기 완료:', plan.plan_name);

  } catch (error) {
    console.error('❌ 스케줄 불러오기 실패:', error);
    toast(`불러오기 실패: ${error.message || '알 수 없는 오류'}`);
  }
}

// 불러온 스케줄 데이터를 state에 적용
function applyLoadedSchedule(plan) {
  const rawData = plan.schedule_data;

  // v6.2: 신규 형식 (객체) vs 기존 형식 (배열) 호환
  let scheduleData;
  let savedPinnedCompanies = [];

  if (Array.isArray(rawData)) {
    // 기존 형식: 배열 그대로
    scheduleData = rawData;
    console.log('📁 기존 형식 스케줄 로드 (v6.1 이하)');
  } else if (rawData && rawData.days) {
    // v6.2 신규 형식: 객체
    scheduleData = rawData.days;
    savedPinnedCompanies = rawData.pinnedCompanies || [];
    console.log(`📁 v6.2 형식 스케줄 로드 (고정 업체 ${savedPinnedCompanies.length}개)`);
  } else {
    console.error('❌ 알 수 없는 스케줄 형식:', rawData);
    toast('스케줄 형식을 인식할 수 없습니다.');
    return;
  }

  // 날짜 범위 설정
  el.startDate.value = plan.start_date;
  el.endDate.value = plan.end_date;

  // 스케줄 데이터 적용 (업체 정보 보강)
  state.schedule = scheduleData.map(day => {
    // 저장된 업체 ID로 현재 업체 데이터 매칭
    const companies = (day.companies ?? []).map(savedCompany => {
      // 현재 state.companies에서 매칭되는 업체 찾기
      const fullCompany = state.companies.find(c => c.id === savedCompany.id);
      if (fullCompany) {
        // 최신 업체 정보 사용 (좌표 등 포함)
        return {
          ...fullCompany,
          distance_km: savedCompany.distance_km ?? fullCompany.distance_km ?? null,
          _isPinned: savedCompany._isPinned || false  // v6.2: 고정 여부 복원
        };
      }
      // 매칭 안되면 저장된 정보 그대로 사용
      return savedCompany;
    });

    return {
      date: day.date,
      isOff: day.isOff || false,
      isWeekend: day.isWeekend || false,
      isHoliday: day.isHoliday || false,
      holidayName: day.holidayName ?? null,
      companies: companies
    };
  });

  // v6.2: 고정 업체 복원
  state.pinnedCompanies = savedPinnedCompanies;
  rebuildPinIndex();
  renderPinnedList();
  updatePinBadge();
  console.log(`📌 고정 업체 복원: ${savedPinnedCompanies.length}개`);

  // 미배정 업체 계산 (스케줄에 배정된 업체 제외)
  const assignedIds = new Set();
  state.schedule.forEach(day => {
    (day.companies ?? []).forEach(c => assignedIds.add(c.id));
  });

  // 필터링된 업체 중 미배정 업체
  const filteredCompanies = getFilteredCompanies();
  state.unassigned = filteredCompanies.filter(c => !assignedIds.has(c.id));

  // 선택된 업체 목록 업데이트
  state.selectedCompanies = [...assignedIds];

  // UI 업데이트
  renderCalendar();
  renderUnassigned();
  updateSelectedCount();
  updateWorkdayCountUI();
  updateEstimate();

  // 변경 상태 초기화 (방금 불러왔으므로)
  state.isDirty = false;
  updateDirtyState();
}

// 선택한 스케줄 삭제
async function deleteSelectedSchedule() {
  if (!selectedPlanId) {
    toast('삭제할 스케줄을 선택하세요.');
    return;
  }

  if (!confirm('선택한 스케줄을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
    return;
  }

  try {
    const { error } = await supabaseDB
      .from('visit_schedule_plans')
      .delete()
      .eq('id', selectedPlanId);

    if (error) {
      throw error;
    }

    toast('✅ 스케줄이 삭제되었습니다.');
    console.log('🗑️ 스케줄 삭제 완료:', selectedPlanId);

    // 목록 새로고침
    openLoadScheduleModal();

  } catch (error) {
    console.error('❌ 스케줄 삭제 실패:', error);
    toast(`삭제 실패: ${error.message || '알 수 없는 오류'}`);
  }
}

// HTML 이스케이프 헬퍼
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

// ===== 초기화 =====
function resetAll() {
  if (!confirm('모든 설정과 스케줄을 초기화하시겠습니까?')) return;

  state.schedule = [];
  state.unassigned = [];
  state.selectedCompanies = [];
  state.filterColors = [];
  state.filterRegions = [];
  state.searchKeyword = '';
  state.isDirty = false;

  el.startDate.value = '';
  el.endDate.value = '';
  el.companySearch.value = '';

  renderColorChips();
  renderRegionList();
  renderCalendar();
  renderUnassigned();
  updateSelectedCount();
  updateWorkdayCountUI();
  updateEstimate();
  updateDirtyState();

  toast('초기화 완료');
}

// ===== 알고리즘 선택 관련 =====
function getSelectedAlgorithm() {
  const radio = document.querySelector('input[name="algorithm"]:checked');
  return radio ? radio.value : 'basic';
}

// ===== 이벤트 바인딩 =====
function bindEvents() {
  // 날짜 변경
  el.startDate.addEventListener('change', async () => {
    await loadHolidaysForRange(el.startDate.value, el.endDate.value);
    updateWorkdayCountUI();
    updateEstimate();
    el.rangeHint.textContent = '주말/공휴일은 자동 제외(근무일 계산)됩니다.';
  });

  el.endDate.addEventListener('change', async () => {
    await loadHolidaysForRange(el.startDate.value, el.endDate.value);
    updateWorkdayCountUI();
    updateEstimate();
    el.rangeHint.textContent = '주말/공휴일은 자동 제외(근무일 계산)됩니다.';
  });

  // 하루 방문 수 옵션
  document.querySelectorAll('input[name="cap"]').forEach(radio => {
    radio.addEventListener('change', updateEstimate);
  });

  // 검색
  el.companySearch.addEventListener('input', (e) => {
    state.searchKeyword = e.target.value;
    updateSelectedCount();
    updateEstimate();
  });

  // 지역 전체 선택/해제
  el.btnRegionAll.addEventListener('click', () => {
    state.filterRegions = [...state.regions];
    renderRegionList();
    updateSelectedCount();
    updateEstimate();
  });

  el.btnRegionNone.addEventListener('click', () => {
    state.filterRegions = [];
    renderRegionList();
    updateSelectedCount();
    updateEstimate();
  });

  // 필터 결과 전체 선택
  el.btnSelectAllFiltered.addEventListener('click', () => {
    const filtered = getFilteredCompanies();
    state.selectedCompanies = filtered.map(c => c.id);
    updateSelectedCount();
    updateEstimate();
    toast(`${state.selectedCompanies.length}개 업체 선택됨`);
  });

  // 선택 비우기
  el.btnClearSelected.addEventListener('click', () => {
    state.selectedCompanies = [];
    updateSelectedCount();
    updateEstimate();
    toast('선택 업체 비움');
  });

  // 미리보기 생성 (Pre-flight 점검 후 생성)
  el.btnPreview.addEventListener('click', showPreflightCheck);

  // 저장
  el.btnSave.addEventListener('click', saveSchedule);

  // 불러오기 (2026-01-05 추가)
  if (el.btnLoad) {
    el.btnLoad.addEventListener('click', openLoadScheduleModal);
  }
  if (el.loadScheduleCancel) {
    el.loadScheduleCancel.addEventListener('click', closeLoadScheduleModal);
  }
  if (el.loadScheduleDelete) {
    el.loadScheduleDelete.addEventListener('click', deleteSelectedSchedule);
  }
  // 모달 오버레이 클릭 시 닫기
  if (el.loadScheduleOverlay) {
    el.loadScheduleOverlay.addEventListener('click', (e) => {
      if (e.target === el.loadScheduleOverlay) {
        closeLoadScheduleModal();
      }
    });
  }

  // 초기화
  el.btnReset.addEventListener('click', resetAll);

  // 좌표 관리 이벤트 (2026-01-04 추가)
  if (el.btnBatchGeocode) {
    el.btnBatchGeocode.addEventListener('click', runBatchGeocode);
  }
  if (el.btnRefreshGeoStats) {
    el.btnRefreshGeoStats.addEventListener('click', refreshGeoStats);
  }
}

// ===== 좌표 관리 함수 (2026-01-04 추가) =====

/**
 * 지오코딩 통계 새로고침
 */
async function refreshGeoStats() {
  if (!el.geocodeStats) return;

  el.geocodeStats.innerHTML = '통계 로딩 중...';

  try {
    // RouteOptimizer가 로드되어 있는지 확인
    if (!window.RouteOptimizer || !window.RouteOptimizer.getGeocodingStats) {
      el.geocodeStats.innerHTML = '⚠️ RouteOptimizer 모듈이 로드되지 않았습니다.';
      return;
    }

    const stats = await window.RouteOptimizer.getGeocodingStats();

    const pct = stats.total > 0 ? Math.round((stats.geocoded / stats.total) * 100) : 0;
    el.geocodeStats.innerHTML = `
      <b>전체:</b> ${stats.total}개 업체<br/>
      <b>좌표 완료:</b> ${stats.geocoded}개 (${pct}%)<br/>
      <b>좌표 미등록:</b> <span style="color:#dc2626;">${stats.pending}개</span>
    `;
  } catch (e) {
    console.error('지오코딩 통계 로드 실패:', e);
    el.geocodeStats.innerHTML = '⚠️ 통계 로드 실패';
  }
}

/**
 * 일괄 지오코딩 실행
 */
async function runBatchGeocode() {
  if (!window.RouteOptimizer || !window.RouteOptimizer.getCompaniesWithoutGeo) {
    alert('RouteOptimizer 모듈이 로드되지 않았습니다.');
    return;
  }

  // 확인 대화상자
  const companies = await window.RouteOptimizer.getCompaniesWithoutGeo();
  if (companies.length === 0) {
    alert('✅ 모든 업체에 좌표가 등록되어 있습니다.');
    return;
  }

  const confirm = window.confirm(
    `좌표 미등록 업체 ${companies.length}개를 지오코딩하시겠습니까?\n\n` +
    `카카오맵 API를 사용하여 주소→좌표 변환 후 저장합니다.\n` +
    `예상 소요 시간: 약 ${Math.ceil(companies.length * 0.25)}초`
  );

  if (!confirm) return;

  // 진행 상태 UI 표시
  if (el.geocodeProgress) el.geocodeProgress.style.display = 'block';
  if (el.btnBatchGeocode) el.btnBatchGeocode.disabled = true;

  try {
    const result = await window.RouteOptimizer.batchGeocodeAndSave(
      companies,
      (current, total, company) => {
        // 진행 상태 업데이트
        const pct = Math.round((current / total) * 100);
        if (el.geocodeProgressBar) el.geocodeProgressBar.style.width = pct + '%';
        if (el.geocodeProgressText) {
          el.geocodeProgressText.textContent = `${current}/${total} 처리 중: ${company.company_name}`;
        }
      }
    );

    // 완료 메시지
    alert(
      `📍 일괄 지오코딩 완료\n\n` +
      `성공: ${result.success}개\n` +
      `실패: ${result.failed}개\n` +
      `스킵(이미 있음): ${result.skipped}개`
    );

    // 통계 새로고침
    await refreshGeoStats();

    // 업체 목록 다시 로드 (좌표 업데이트 반영)
    await loadCompanies();

  } catch (e) {
    console.error('일괄 지오코딩 실패:', e);
    alert('일괄 지오코딩 실패: ' + (e.message || e));
  } finally {
    // UI 원복
    if (el.geocodeProgress) el.geocodeProgress.style.display = 'none';
    if (el.btnBatchGeocode) el.btnBatchGeocode.disabled = false;
    if (el.geocodeProgressBar) el.geocodeProgressBar.style.width = '0%';
  }
}

// ===== Pre-flight 점검 시스템 (2026-01-04 ChatGPT + Claude 협업) =====

// Pre-flight 상태
const preflightState = {
  pendingCompanies: [],
  filterCompanies: [],  // 현재 필터된 업체 중 좌표 미등록
  isOpen: false
};

// Pre-flight 모달 요소
const pfEl = {
  get overlay() { return document.getElementById('preflightOverlay'); },
  get total() { return document.getElementById('pfTotal'); },
  get ready() { return document.getElementById('pfReady'); },
  get pending() { return document.getElementById('pfPending'); },
  get list() { return document.getElementById('pfList'); },
  get progress() { return document.getElementById('pfProgress'); },
  get progressFill() { return document.getElementById('pfProgressFill'); },
  get progressText() { return document.getElementById('pfProgressText'); },
  get btnRetry() { return document.getElementById('pfRetryGeocode'); },
  get btnRefresh() { return document.getElementById('pfRefresh'); },
  get btnSkip() { return document.getElementById('pfSkip'); },
  get btnGenerate() { return document.getElementById('pfGenerate'); },
  get btnClose() { return document.getElementById('preflightClose'); }
};

/**
 * Pre-flight 점검 화면 표시
 */
async function showPreflightCheck() {
  const startStr = el.startDate.value;
  const endStr = el.endDate.value;

  if (!startStr || !endStr) {
    toast('시작일과 종료일을 선택하세요.');
    return;
  }

  // 현재 필터 적용된 업체 가져오기
  let companies = applyColorFilter(state.companies, state.filterColors);
  if (state.filterRegions.length > 0) {
    companies = companies.filter(c => state.filterRegions.includes(c.region));
  }
  if (state.searchKeyword) {
    const kw = state.searchKeyword.toLowerCase();
    companies = companies.filter(c => (c.company_name || '').toLowerCase().includes(kw));
  }
  if (state.selectedCompanies.length > 0) {
    companies = companies.filter(c => state.selectedCompanies.includes(c.id));
  }

  if (companies.length === 0) {
    toast('배정할 업체가 없습니다.');
    return;
  }

  // Supabase에서 좌표 미등록 업체 목록 가져오기 (RouteOptimizer 사용)
  let pendingFromDB = [];
  if (window.RouteOptimizer && window.RouteOptimizer.getCompaniesWithoutGeo) {
    try {
      pendingFromDB = await window.RouteOptimizer.getCompaniesWithoutGeo();
    } catch (e) {
      console.warn('좌표 미등록 업체 조회 실패:', e);
    }
  }

  // 현재 필터링된 업체 중 좌표 미등록 업체만 추출
  const pendingIds = new Set(pendingFromDB.map(c => c.id));
  const pending = companies.filter(c => pendingIds.has(c.id));
  const ready = companies.length - pending.length;

  // 좌표 미등록 업체가 없으면 바로 스케줄 생성
  if (pending.length === 0) {
    console.log('✅ 모든 업체에 좌표가 있습니다. 스케줄 생성 진행.');
    generateSchedule();
    return;
  }

  // Pre-flight 상태 업데이트
  preflightState.filterCompanies = companies;
  preflightState.pendingCompanies = pending;

  // 모달 업데이트
  updatePreflightModal();

  // 모달 표시
  pfEl.overlay.classList.add('show');
  preflightState.isOpen = true;

  console.log(`⚠️ Pre-flight 점검: ${pending.length}개 업체 좌표 미등록`);
}

/**
 * Pre-flight 모달 업데이트
 */
function updatePreflightModal() {
  const total = preflightState.filterCompanies.length;
  const pending = preflightState.pendingCompanies.length;
  const ready = total - pending;

  // 통계 업데이트
  pfEl.total.textContent = total;
  pfEl.ready.textContent = ready;
  pfEl.pending.textContent = pending;

  // 업체 목록 렌더링
  renderPreflightList();

  // 버튼 상태
  pfEl.btnGenerate.disabled = true;  // 좌표 미등록 있으면 비활성화
  pfEl.btnSkip.textContent = `${pending}개 제외하고 생성`;
}

/**
 * Pre-flight 업체 목록 렌더링
 */
function renderPreflightList() {
  const list = pfEl.list;
  list.innerHTML = '';

  preflightState.pendingCompanies.forEach(c => {
    const item = document.createElement('div');
    item.className = 'preflight-item';

    const address = c.address || '';

    // 상태 결정: 주소 없음 / 지오코딩 실패 원인 분석
    let statusClass = 'pending';
    let statusText = '지오코딩 필요';

    if (!address) {
      statusClass = 'error';
      statusText = '주소 없음';
    } else if (address.includes('산') && /산\d/.test(address)) {
      statusText = '산 주소 (수동 입력 필요)';
    } else if (address.includes('외 ') && address.includes('필지')) {
      statusText = '필지 포함 (주소 정리 필요)';
    } else if (address.includes('번지') && !address.includes('로') && !address.includes('길')) {
      statusText = '지번 주소 (도로명 변환 권장)';
    }

    item.innerHTML = `
      <div class="name">${c.company_name || '이름 없음'}</div>
      <div class="address">${address || '주소 없음'}</div>
      <span class="status ${statusClass}">${statusText}</span>
    `;
    list.appendChild(item);
  });

  if (preflightState.pendingCompanies.length === 0) {
    list.innerHTML = '<div style="padding:20px; text-align:center; color:#16a34a;">✅ 모든 업체에 좌표가 등록되어 있습니다.</div>';
    pfEl.btnGenerate.disabled = false;
  }
}

/**
 * Pre-flight 모달 닫기
 */
function closePreflightModal() {
  pfEl.overlay.classList.remove('show');
  preflightState.isOpen = false;
}

/**
 * Pre-flight: 자동 지오코딩 재시도
 */
async function preflightRetryGeocode() {
  const pending = preflightState.pendingCompanies.filter(c => c.address);

  if (pending.length === 0) {
    toast('지오코딩할 업체가 없습니다. (주소 없음)');
    return;
  }

  if (!window.RouteOptimizer || !window.RouteOptimizer.batchGeocodeAndSave) {
    toast('RouteOptimizer 모듈이 로드되지 않았습니다.');
    return;
  }

  // 진행 표시
  pfEl.progress.classList.add('show');
  pfEl.btnRetry.disabled = true;
  pfEl.progressFill.style.width = '0%';
  pfEl.progressText.textContent = '지오코딩 준비 중...';

  try {
    const result = await window.RouteOptimizer.batchGeocodeAndSave(
      pending,
      (current, total, company) => {
        const pct = Math.round((current / total) * 100);
        pfEl.progressFill.style.width = pct + '%';
        pfEl.progressText.textContent = `${current}/${total}: ${company.company_name}`;
      }
    );

    pfEl.progressText.textContent = `완료! 성공: ${result.success}, 실패: ${result.failed}`;

    // 업체 목록 다시 로드
    await loadCompanies();

    // 필터 다시 적용하여 pending 업데이트
    await refreshPreflightData();

    toast(`지오코딩 완료: 성공 ${result.success}개, 실패 ${result.failed}개`);

  } catch (e) {
    console.error('지오코딩 실패:', e);
    pfEl.progressText.textContent = '❌ 지오코딩 실패: ' + e.message;
  } finally {
    pfEl.btnRetry.disabled = false;
    setTimeout(() => {
      pfEl.progress.classList.remove('show');
    }, 2000);
  }
}

/**
 * Pre-flight 데이터 새로고침
 */
async function refreshPreflightData() {
  // 업체 목록 다시 로드
  await loadCompanies();

  // 필터 재적용
  let companies = applyColorFilter(state.companies, state.filterColors);
  if (state.filterRegions.length > 0) {
    companies = companies.filter(c => state.filterRegions.includes(c.region));
  }
  if (state.searchKeyword) {
    const kw = state.searchKeyword.toLowerCase();
    companies = companies.filter(c => (c.company_name || '').toLowerCase().includes(kw));
  }
  if (state.selectedCompanies.length > 0) {
    companies = companies.filter(c => state.selectedCompanies.includes(c.id));
  }

  // Supabase에서 좌표 미등록 업체 목록 가져오기 (RouteOptimizer 사용)
  let pendingFromDB = [];
  if (window.RouteOptimizer && window.RouteOptimizer.getCompaniesWithoutGeo) {
    try {
      pendingFromDB = await window.RouteOptimizer.getCompaniesWithoutGeo();
    } catch (e) {
      console.warn('좌표 미등록 업체 조회 실패:', e);
    }
  }

  // 현재 필터링된 업체 중 좌표 미등록 업체만 추출
  const pendingIds = new Set(pendingFromDB.map(c => c.id));
  const pending = companies.filter(c => pendingIds.has(c.id));

  preflightState.filterCompanies = companies;
  preflightState.pendingCompanies = pending;

  updatePreflightModal();
  await refreshGeoStats();

  toast('데이터 새로고침 완료');
}

/**
 * Pre-flight: 제외하고 생성
 * - 좌표 미등록 업체를 state.excludedIds에 저장
 * - generateSchedule()에서 해당 업체들 자동 제외
 */
async function preflightSkipAndGenerate() {
  const pendingIds = preflightState.pendingCompanies.map(c => c.id);
  const pendingCount = pendingIds.length;

  console.log(`⚠️ ${pendingCount}개 업체 제외하고 스케줄 생성`);
  console.log(`  제외 업체 ID: ${pendingIds.slice(0, 5).join(', ')}${pendingCount > 5 ? ' ...' : ''}`);

  // ★ 제외할 업체 ID를 state에 저장 (generateSchedule에서 사용)
  state.excludedIds = pendingIds;

  // 모달 닫기
  closePreflightModal();

  // generateSchedule 호출 (state.excludedIds 사용하여 제외)
  await generateSchedule();

  // 생성 완료 후 excludedIds 초기화 (다음 생성에 영향 안 주도록)
  state.excludedIds = [];

  toast(`${pendingCount}개 업체를 제외하고 스케줄 생성`);
}

/**
 * Pre-flight 이벤트 리스너 등록
 */
function initPreflightEvents() {
  // 닫기 버튼
  pfEl.btnClose?.addEventListener('click', closePreflightModal);

  // 오버레이 클릭으로 닫기
  pfEl.overlay?.addEventListener('click', (e) => {
    if (e.target === pfEl.overlay) closePreflightModal();
  });

  // 자동 지오코딩 재시도
  pfEl.btnRetry?.addEventListener('click', preflightRetryGeocode);

  // 새로고침
  pfEl.btnRefresh?.addEventListener('click', refreshPreflightData);

  // 제외하고 생성
  pfEl.btnSkip?.addEventListener('click', preflightSkipAndGenerate);

  // 스케줄 생성 (좌표 모두 있을 때)
  pfEl.btnGenerate?.addEventListener('click', () => {
    closePreflightModal();
    generateSchedule();
  });

  console.log('✅ Pre-flight 이벤트 리스너 등록 완료');
}

// ===== 초기화 실행 =====
async function init() {
  try {
    el.loadState.textContent = '초기화 중...';

    // 데이터베이스 및 사용자 초기화
    const dbReady = await initDatabase();
    if (!dbReady) return;

    // 기본 날짜 설정 (오늘부터 30일)
    const today = new Date();
    const plus30 = new Date(today);
    plus30.setDate(plus30.getDate() + 30);

    el.startDate.value = formatDate(today);
    el.endDate.value = formatDate(plus30);

    // 공휴일 로드
    await loadHolidaysForRange(el.startDate.value, el.endDate.value);

    // 업체 로드
    await loadCompanies();

    // 이벤트 바인딩
    bindEvents();

    // Pre-flight 점검 이벤트 바인딩 (2026-01-04 추가)
    initPreflightEvents();

    // 좌표 통계 로드 (2026-01-04 추가)
    await refreshGeoStats();

    // 초기 range 반영
    updateWorkdayCountUI();
    updateEstimate();
    el.rangeHint.textContent = '주말/공휴일은 자동 제외(근무일 계산)됩니다.';

    toast('준비 완료');

  } catch (e) {
    console.error('초기화 실패:', e);
    el.loadState.textContent = '오류';
    alert(`초기화 실패:\n${e?.message || e}\n\n로그인 후 다시 시도해주세요.`);
  }
}

// 실행
init();
