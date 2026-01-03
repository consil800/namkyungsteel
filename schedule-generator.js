/**
 * 업체 방문 스케줄 자동 생성기
 * - 주소 기반 근접 그룹핑
 * - 한국 공휴일 API 연동
 * - SortableJS 드래그 앤 드롭
 */

// ===== Supabase 설정 (database.js 사용) =====
let supabase = null;
let USER_ID = null;

// 데이터베이스 및 사용자 초기화
async function initDatabase() {
  // database.js가 로드될 때까지 대기
  let retries = 0;
  while (retries < 30) {
    if (window.db && window.db.client) {
      supabase = window.db.client;
      console.log('✅ database.js 연결 확인됨');
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  if (!supabase) {
    throw new Error('데이터베이스 연결 실패');
  }

  // 세션에서 사용자 정보 가져오기
  const sessionUser = sessionStorage.getItem('currentUser');
  if (sessionUser) {
    const user = JSON.parse(sessionUser);
    USER_ID = user.id?.toString();
    console.log('✅ 사용자 확인:', user.name, 'ID:', USER_ID);
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
};

// ===== 색상 코드 매핑 =====
const COLOR_MAP = {
  green: { name: '녹색', cssClass: 'green', hex: '#2e7d32' },
  gray: { name: '회색', cssClass: 'gray', hex: '#6b7280' },
  blue: { name: '파랑', cssClass: 'blue', hex: '#2563eb' },
  red: { name: '빨강', cssClass: 'red', hex: '#dc2626' },
  yellow: { name: '노랑', cssClass: 'yellow', hex: '#ca8a04' },
  orange: { name: '주황', cssClass: 'orange', hex: '#ea580c' },
  sky: { name: '하늘', cssClass: 'sky', hex: '#0284c7' },
  purple: { name: '보라', cssClass: 'purple', hex: '#7c3aed' },
};

// ===== 하루 방문 수 옵션 =====
const CAP_OPTIONS = {
  '1-3': { min: 1, max: 3, target: 2 },
  '4-5': { min: 4, max: 5, target: 5 },
  '6-8': { min: 6, max: 8, target: 7 },
  '9-11': { min: 9, max: 11, target: 10 },
};

// ===== 유틸리티 함수 =====
function formatDate(date) {
  return date.toISOString().split('T')[0];
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
async function loadCompanies() {
  el.loadState.textContent = '업체 로딩 중...';

  try {
    const { data, error } = await supabase
      .from('client_companies')
      .select('id, company_name, region, address, color_code, visit_count, last_visit_date')
      .eq('user_id', USER_ID)
      .order('region')
      .order('company_name');

    if (error) throw error;

    state.companies = data || [];

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

// ===== 색상 칩 렌더링 =====
function renderColorChips() {
  el.colorChips.innerHTML = state.colors.map(color => {
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

// ===== 스케줄 생성 (주소 기반 그룹핑) =====
function generateSchedule() {
  const startStr = el.startDate.value;
  const endStr = el.endDate.value;

  if (!startStr || !endStr) {
    toast('시작일과 종료일을 선택하세요.');
    return;
  }

  // 필터링된 업체 가져오기
  let companies = getFilteredCompanies();
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

  // 위치 그룹별로 업체 정렬
  const groupedCompanies = groupCompaniesByLocation(companies);

  // 근무일에 순차 배정
  let companyIndex = 0;
  const workdays = days.filter(d => !d.isWeekend && !d.isHoliday && !d.isOff);

  for (const day of workdays) {
    const remaining = groupedCompanies.length - companyIndex;
    if (remaining <= 0) break;

    const toAssign = Math.min(cap.target, remaining);
    day.companies = groupedCompanies.slice(companyIndex, companyIndex + toAssign);
    companyIndex += toAssign;
  }

  // 미배정 업체
  state.unassigned = companyIndex < groupedCompanies.length
    ? groupedCompanies.slice(companyIndex)
    : [];

  state.schedule = days;
  state.isDirty = true;

  renderCalendar();
  renderUnassigned();
  updateDirtyState();

  const assignedCount = companyIndex;
  const unassignedCount = state.unassigned.length;
  toast(`스케줄 생성 완료! 배정: ${assignedCount}개, 미배정: ${unassignedCount}개`);
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

    // 위치 그룹 표시
    const locationGroups = new Set();
    day.companies.forEach(c => {
      const subDistrict = extractSubDistrict(c.address);
      if (subDistrict !== '기타') {
        locationGroups.add(subDistrict);
      }
    });
    if (locationGroups.size > 0) {
      badges.push(`<span class="badge location">${Array.from(locationGroups).join(', ')}</span>`);
    }

    const isDisabled = day.isWeekend || day.isHoliday || day.isOff;

    return `
      <div class="day-card" data-idx="${idx}">
        <div class="day-hd">
          <div class="leftline">
            <span>${day.date} (${day.dayName})</span>
            ${badges.join('')}
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

// ===== 업체 아이템 HTML =====
function renderCompanyItem(company) {
  const colorInfo = COLOR_MAP[company.color_code] || { cssClass: 'gray' };
  const subDistrict = extractSubDistrict(company.address);

  return `
    <li class="company-item" data-id="${company.id}">
      <span class="dot ${colorInfo.cssClass}"></span>
      <span>${company.company_name}</span>
      <span class="sub">${company.region || ''} ${subDistrict !== '기타' ? subDistrict : ''}</span>
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

  // 미리보기 생성
  el.btnPreview.addEventListener('click', generateSchedule);

  // 저장
  el.btnSave.addEventListener('click', saveSchedule);

  // 초기화
  el.btnReset.addEventListener('click', resetAll);
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
