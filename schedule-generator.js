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
  // 경로 최적화 관련
  apiKeySection: document.getElementById('apiKeySection'),
  kakaoApiKey: document.getElementById('kakaoApiKey'),
  // 좌표 관리 관련 (2026-01-04 추가)
  geocodeSection: document.getElementById('geocodeSection'),
  geocodeStats: document.getElementById('geocodeStats'),
  btnBatchGeocode: document.getElementById('btnBatchGeocode'),
  btnRefreshGeoStats: document.getElementById('btnRefreshGeoStats'),
  geocodeProgress: document.getElementById('geocodeProgress'),
  geocodeProgressBar: document.getElementById('geocodeProgressBar'),
  geocodeProgressText: document.getElementById('geocodeProgressText'),
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
        continue;
      }
    }

    // 2. 캐시에 없으면 geocodeAddress로 지오코딩 (최대 maxPerRun개)
    if (geocodedCount < maxPerRun && c.address && typeof geocodeAddress === 'function') {
      try {
        const geo = await geocodeAddress(c.address);
        if (geo && geo.lat && geo.lng) {
          c.geo = geo;
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

  // ★ 알고리즘 선택 확인
  const selectedAlgo = getSelectedAlgorithm();

  // ★★★ 최적 경로 알고리즘 (카카오맵 거리 기반) ★★★
  if (selectedAlgo === 'optimal') {
    await generateScheduleOptimal(companies, days, cap);
    return;
  }

  // ★ 2026-01-04 ChatGPT Ultra Think + Claude 협업: 지역 블록 단위 배정 알고리즘 v4
  // 핵심: "1~3" = 하드 제약(반드시 지켜야 함), "목표 2" = 소프트(선호)
  // 우선순위: 1. 지역 혼합 금지 → 2. 같은 지역은 한 날/연속된 날 → 3. 목표에 가깝게
  let pool = [...companies];

  console.log('📊 지역 블록 단위 알고리즘 v4: ChatGPT Ultra Think + Claude 협업');
  console.log(`  총 업체: ${pool.length}개`);
  console.log(`  옵션: min=${cap.min}, max=${cap.max}, target=${cap.target}`);
  console.log(`  색상 필터: ${state.filterColors.length > 0 ? state.filterColors.join(', ') : '없음'} (필터 역할만!)`);

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

  // ★ Step 3: 지역 그룹들을 우선순위순으로 정렬 (가장 오래된 업체가 있는 지역 먼저)
  const sortedRegions = Array.from(regionGroups.entries()).sort((a, b) => {
    const aOldest = a[1][0]?.last_visit_date ? new Date(a[1][0].last_visit_date) : new Date(0);
    const bOldest = b[1][0]?.last_visit_date ? new Date(b[1][0].last_visit_date) : new Date(0);
    return aOldest - bOldest;
  });

  console.log(`  지역 그룹 수: ${sortedRegions.length}개`);
  sortedRegions.slice(0, 3).forEach(([region, comps]) => {
    console.log(`    - ${region}: ${comps.length}개 업체`);
  });

  // ★ Step 4: 지역 블록 단위로 날짜에 배정
  // 핵심: N ≤ max면 한 날에 모두 배정 (지역 혼합 금지)
  let workdayIdx = 0;

  for (const [region, regionCompanies] of sortedRegions) {
    if (regionCompanies.length === 0) continue;

    let remaining = [...regionCompanies];

    while (remaining.length > 0 && workdayIdx < workdays.length) {
      const day = workdays[workdayIdx];

      // ★ 핵심 로직: N ≤ max면 한 날에 모두 배정
      let assignCount;
      if (remaining.length <= cap.max) {
        // 남은 업체가 max 이하면 모두 한 날에 배정 (목표 2 깨는 게 맞음)
        assignCount = remaining.length;
      } else {
        // max 초과면 max개씩 배정 (또는 target에 가깝게)
        assignCount = Math.min(cap.max, remaining.length);
      }

      const dayCompanies = remaining.slice(0, assignCount);
      day.companies = dayCompanies;
      totalAssigned += dayCompanies.length;

      // 배정된 업체 제거
      remaining = remaining.slice(assignCount);

      // 디버그 로그
      if (totalAssigned <= cap.max * 5) {
        console.log(`  ${day.date}: ${region} ${dayCompanies.length}개 배정 (남은: ${remaining.length}개)`);
      }

      workdayIdx++;
    }

    // 이 지역에서 배정 못한 업체가 있으면 미배정으로
    if (remaining.length > 0) {
      console.log(`  ⚠️ ${region}: ${remaining.length}개 미배정 (근무일 부족)`);
    }
  }

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
          ${day.companies.map(c => renderCompanyItem(c)).join('')}
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

// ===== 업체 아이템 HTML (방문횟수, 최근방문일 표시) =====
function renderCompanyItem(company) {
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

  return `
    <li class="company-item" data-id="${company.id}" title="색상: ${colorInfo.name} | 마지막방문: ${company.last_visit_date || '없음'} | 횟수: ${visitCount}회">
      <span class="dot ${colorInfo.cssClass}"></span>
      <span>${company.company_name}</span>
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

  // TODO: Supabase에 저장 구현
  // visit_schedule_plans 테이블 생성 필요

  toast('저장 기능은 준비 중입니다.');
  state.isDirty = false;
  updateDirtyState();
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

function toggleApiKeySection() {
  const algo = getSelectedAlgorithm();
  if (el.apiKeySection) {
    el.apiKeySection.style.display = (algo === 'optimal') ? 'block' : 'none';
  }
}

// ===== 이벤트 바인딩 =====
function bindEvents() {
  // 알고리즘 선택 변경 (API 키 섹션 표시/숨김)
  document.querySelectorAll('input[name="algorithm"]').forEach(radio => {
    radio.addEventListener('change', toggleApiKeySection);
  });

  // 카카오 API 키 입력 시 RouteOptimizer에 설정
  if (el.kakaoApiKey) {
    el.kakaoApiKey.addEventListener('change', () => {
      const key = el.kakaoApiKey.value.trim();
      if (key && window.RouteOptimizer) {
        window.RouteOptimizer.setKakaoApiKey(key);
      }
    });
  }

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

  // 좌표 미등록 업체 필터링 (좌표는 geo.lat, geo.lng에 저장됨)
  const pending = companies.filter(c => !c.geo?.lat || !c.geo?.lng);
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

    const address = c.address || '주소 없음';
    const statusClass = !c.address ? 'error' : 'pending';
    const statusText = !c.address ? '주소 없음' : '좌표 없음';

    item.innerHTML = `
      <div class="name">${c.company_name || '이름 없음'}</div>
      <div class="address">${address}</div>
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

  // 좌표 미등록 업체 재계산 (좌표는 geo.lat, geo.lng에 저장됨)
  const pending = companies.filter(c => !c.geo?.lat || !c.geo?.lng);

  preflightState.filterCompanies = companies;
  preflightState.pendingCompanies = pending;

  updatePreflightModal();
  await refreshGeoStats();

  toast('데이터 새로고침 완료');
}

/**
 * Pre-flight: 제외하고 생성
 */
function preflightSkipAndGenerate() {
  const pendingIds = new Set(preflightState.pendingCompanies.map(c => c.id));
  const pendingCount = pendingIds.size;

  console.log(`⚠️ ${pendingCount}개 업체 제외하고 스케줄 생성`);

  // 모달 닫기
  closePreflightModal();

  // generateSchedule 호출 (내부에서 좌표 없는 업체는 자동 제외됨)
  generateSchedule();

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

    // 알고리즘 선택 섹션 초기화
    toggleApiKeySection();

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
