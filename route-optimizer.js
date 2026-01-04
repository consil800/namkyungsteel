/**
 * 영업사원 경로 최적화 모듈
 * ChatGPT + Claude 협업 설계 (2026-01-03)
 * 카카오맵 API 전환 (2026-01-04)
 *
 * 핵심 알고리즘:
 * 1. 카카오 Local API: 주소 → 좌표 변환 (캐시 적용)
 * 2. Haversine: 직선거리로 후보 K개 필터링
 * 3. 카카오 Mobility API: 실제 주행거리 계산 (선택)
 * 4. Nearest Neighbor + 2-opt: 경로 최적화
 * 5. Sweep 알고리즘: 날짜별 분할
 */

// ===== 설정 =====
const ROUTE_OPTIMIZER_CONFIG = {
  // 카카오 REST API 키 (카카오 개발자 콘솔에서 발급)
  // https://developers.kakao.com/console/app → 앱 선택 → 앱 키 → REST API 키
  KAKAO_REST_API_KEY: 'da89fd9f40b0afa12377c726eef8bbfc',

  // 카카오 Mobility API 사용 여부 (false면 Haversine 사용)
  USE_KAKAO_MOBILITY: false,

  // Haversine 프리필터 후보 수
  CANDIDATE_K: 20,

  // 거리 캐시 만료 시간 (30일, 밀리초)
  CACHE_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000,

  // API 호출 지연 (rate limit 대응, 밀리초)
  // 카카오 API는 초당 10회까지 허용하지만 안전하게 200ms
  API_DELAY_MS: 200,

  // 2-opt 최대 반복 횟수
  TWO_OPT_MAX_ITERATIONS: 100,
};

// ===== Supabase 참조 (전역 window.db.client 사용) =====
function getSupabase() {
  if (window.db && window.db.client) {
    return window.db.client;
  }
  throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
}

// ===== 유틸리티 함수 =====

/**
 * 지연 함수 (API rate limit 대응)
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Haversine 공식으로 두 좌표 간 직선거리 계산 (km)
 * @param {number} lat1 - 시작점 위도
 * @param {number} lng1 - 시작점 경도
 * @param {number} lat2 - 도착점 위도
 * @param {number} lng2 - 도착점 경도
 * @returns {number} 거리 (km)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 각도 계산 (Sweep 알고리즘용)
 * @param {Object} depot - 기준점 {lat, lng}
 * @param {Object} point - 대상점 {lat, lng}
 * @returns {number} 각도 (0~360)
 */
function calculateAngle(depot, point) {
  const dLng = point.lng - depot.lng;
  const dLat = point.lat - depot.lat;
  let angle = Math.atan2(dLng, dLat) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
}

// ===== 지오코딩 (주소 → 좌표) =====

/**
 * localStorage 기반 지오코드 캐시 (주소 → 좌표)
 * API 호출 최소화를 위해 결과를 로컬에 저장
 */
const GeoCodeCache = {
  KEY: 'route_optimizer_geocode_cache',

  get(address) {
    try {
      const cache = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      const entry = cache[address];

      if (entry && Date.now() - entry.updatedAt < ROUTE_OPTIMIZER_CONFIG.CACHE_EXPIRY_MS) {
        return entry.geo;
      }
      return null;
    } catch (e) {
      console.warn('지오코드 캐시 읽기 실패:', e);
      return null;
    }
  },

  set(address, geo) {
    try {
      const cache = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      cache[address] = {
        geo,
        updatedAt: Date.now()
      };
      localStorage.setItem(this.KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('지오코드 캐시 저장 실패:', e);
    }
  },

  clear() {
    localStorage.removeItem(this.KEY);
  }
};

/**
 * localStorage 기반 거리 캐시
 */
const DistanceCache = {
  KEY: 'route_optimizer_distance_cache',

  get(originId, destId) {
    try {
      const cache = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      const key = `${originId}_${destId}`;
      const entry = cache[key];

      if (entry && Date.now() - entry.updatedAt < ROUTE_OPTIMIZER_CONFIG.CACHE_EXPIRY_MS) {
        return entry;
      }
      return null;
    } catch (e) {
      console.warn('거리 캐시 읽기 실패:', e);
      return null;
    }
  },

  set(originId, destId, durationSec, distanceM) {
    try {
      const cache = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      const key = `${originId}_${destId}`;
      cache[key] = {
        durationSec,
        distanceM,
        updatedAt: Date.now()
      };
      localStorage.setItem(this.KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('거리 캐시 저장 실패:', e);
    }
  },

  clear() {
    localStorage.removeItem(this.KEY);
  }
};

/**
 * 카카오 API fetch 헬퍼 (429 rate limit 재시도 포함)
 * ★ ChatGPT Ultra Think 검증 반영: 429 에러 시 지수 백오프 재시도
 * @param {string} url - API URL
 * @param {number} maxRetries - 최대 재시도 횟수
 * @returns {Promise<Object>} JSON 응답
 */
async function fetchKakaoJson(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${ROUTE_OPTIMIZER_CONFIG.KAKAO_REST_API_KEY}`
      }
    });

    if (response.ok) {
      return await response.json();
    }

    // 429 Too Many Requests: 지수 백오프 후 재시도
    if (response.status === 429 && attempt < maxRetries - 1) {
      const backoffMs = Math.pow(2, attempt) * 1000; // 1초, 2초, 4초...
      console.warn(`⚠️ 카카오 API rate limit (429), ${backoffMs}ms 후 재시도...`);
      await delay(backoffMs);
      continue;
    }

    throw new Error(`HTTP ${response.status}`);
  }
}

/**
 * 주소를 좌표로 변환 (카카오 Local API 사용)
 * 카카오맵은 한국 주소 인식률이 매우 높음
 *
 * ★ ChatGPT Ultra Think 검증 반영:
 * - NaN 좌표 검증 추가
 * - placeId 형식 개선 (좌표 기반으로 충돌 방지)
 * - 429 rate limit 재시도 로직 추가
 *
 * @param {string} address - 주소
 * @returns {Promise<{lat: number, lng: number, placeId: string} | null>}
 */
async function geocodeAddress(address) {
  // 1. 캐시 확인
  const cached = GeoCodeCache.get(address);
  if (cached) {
    return cached;
  }

  // 2. 카카오 Local API 사용 (키가 있는 경우)
  if (ROUTE_OPTIMIZER_CONFIG.KAKAO_REST_API_KEY) {
    try {
      // 주소 검색 API 사용
      const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;

      const data = await fetchKakaoJson(url);

      if (data.documents && data.documents.length > 0) {
        const result = data.documents[0];
        const lat = parseFloat(result.y); // 카카오는 y가 위도
        const lng = parseFloat(result.x); // 카카오는 x가 경도

        // ★ ChatGPT 검증 반영: NaN 좌표 검증
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          console.warn(`카카오 좌표 파싱 실패 (NaN): ${address}`);
          return null;
        }

        const geo = {
          lat,
          lng,
          // ★ ChatGPT 검증 반영: 좌표 기반 placeId로 충돌 방지
          placeId: `kakao_addr_${result.x}_${result.y}`
        };
        GeoCodeCache.set(address, geo);
        console.log(`✅ 카카오 지오코딩 성공: ${address}`);
        return geo;
      }

      // 주소 검색 실패 시 키워드 검색으로 재시도
      const keywordUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`;
      const keywordData = await fetchKakaoJson(keywordUrl);

      if (keywordData.documents && keywordData.documents.length > 0) {
        const result = keywordData.documents[0];
        const lat = parseFloat(result.y);
        const lng = parseFloat(result.x);

        // ★ ChatGPT 검증 반영: NaN 좌표 검증
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          console.warn(`카카오 키워드 좌표 파싱 실패 (NaN): ${address}`);
          return null;
        }

        const geo = {
          lat,
          lng,
          // ★ ChatGPT 검증 반영: 좌표 기반 placeId로 충돌 방지
          placeId: `kakao_keyword_${result.x}_${result.y}`
        };
        GeoCodeCache.set(address, geo);
        console.log(`✅ 카카오 키워드 검색 성공: ${address} → ${result.place_name}`);
        return geo;
      }

      console.warn(`카카오 지오코딩 결과 없음: ${address}`);
      return null;
    } catch (e) {
      console.error(`카카오 지오코딩 오류 (${address}):`, e);
    }
  }

  // 3. API 키 없는 경우 Nominatim fallback (무료)
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=kr&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NamkyungSteel-ScheduleGenerator/1.0 (schedule optimization)',
        'Accept-Language': 'ko'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);

      // ★ ChatGPT 검증 반영: NaN 좌표 검증
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.warn(`Nominatim 좌표 파싱 실패 (NaN): ${address}`);
        return null;
      }

      const geo = {
        lat,
        lng,
        placeId: `nominatim_${data[0].place_id}`
      };
      GeoCodeCache.set(address, geo);
      console.log(`✅ Nominatim 지오코딩 성공: ${address}`);
      return geo;
    } else {
      console.warn(`Nominatim 결과 없음: ${address}`);
      return null;
    }
  } catch (e) {
    console.error(`Nominatim 지오코딩 오류 (${address}):`, e);
    return null;
  }
}

/**
 * 모든 업체의 좌표를 확보 (localStorage 캐시 우선, 없으면 카카오 API 호출)
 * @param {Array} companies - 업체 목록 [{id, address, ...}]
 * @returns {Promise<Array>} 좌표가 추가된 업체 목록
 */
async function ensureGeocoded(companies) {
  const results = [];
  let geocodedCount = 0;
  let cachedCount = 0;

  const apiName = ROUTE_OPTIMIZER_CONFIG.KAKAO_REST_API_KEY ? '카카오 Local' : 'Nominatim';
  console.log(`📍 지오코딩 시작: ${companies.length}개 업체`);
  console.log(`   (${apiName} API 사용)`);

  for (const company of companies) {
    // 주소가 없는 경우 스킵
    if (!company.address) {
      console.warn(`주소 없음: ${company.company_name}`);
      results.push(company);
      continue;
    }

    // 캐시 확인 (geocodeAddress 내부에서도 확인하지만, 진행률 표시용)
    const cachedGeo = GeoCodeCache.get(company.address);
    if (cachedGeo) {
      cachedCount++;
      results.push({
        ...company,
        geo: cachedGeo
      });
      continue;
    }

    // API 호출로 좌표 획득 (rate limit 대응 지연)
    await delay(ROUTE_OPTIMIZER_CONFIG.API_DELAY_MS);
    const geo = await geocodeAddress(company.address);

    if (geo) {
      geocodedCount++;
      results.push({
        ...company,
        geo: { lat: geo.lat, lng: geo.lng }
      });

      // 진행률 로그 (10개마다)
      if (geocodedCount % 10 === 0) {
        console.log(`  지오코딩 진행: ${geocodedCount}개 완료`);
      }
    } else {
      results.push(company);
    }
  }

  console.log(`📍 지오코딩 완료: 캐시 ${cachedCount}개, 신규 ${geocodedCount}개`);
  return results;
}

// ===== 거리 계산 =====

/**
 * Haversine 거리 기준 상위 K개 후보 선택
 * @param {Object} current - 현재 위치 {lat, lng}
 * @param {Array} candidates - 후보 업체 목록
 * @param {number} k - 선택할 개수
 * @returns {Array} 상위 K개 업체
 */
function topKByHaversine(current, candidates, k = ROUTE_OPTIMIZER_CONFIG.CANDIDATE_K) {
  return candidates
    .filter(c => c.geo && c.geo.lat && c.geo.lng)
    .map(c => ({
      ...c,
      _haversine: haversineDistance(current.lat, current.lng, c.geo.lat, c.geo.lng)
    }))
    .sort((a, b) => a._haversine - b._haversine)
    .slice(0, k);
}

/**
 * 카카오 Mobility API 또는 Haversine으로 주행거리/시간 조회 (1:N)
 * 카카오 Mobility API는 유료 플랜이 필요할 수 있어 기본은 Haversine 사용
 * @param {Object} origin - 출발지 {lat, lng}
 * @param {Array} destinations - 도착지 목록 [{id, geo: {lat, lng}}]
 * @returns {Promise<Object>} {id: {durationSec, distanceM}}
 */
async function fetchRouteMatrix(origin, destinations) {
  const result = {};

  // 캐시 확인
  const uncached = [];
  for (const dest of destinations) {
    const cached = DistanceCache.get('current', dest.id);
    if (cached) {
      result[dest.id] = cached;
    } else {
      uncached.push(dest);
    }
  }

  if (uncached.length === 0) {
    return result;
  }

  // 카카오 Mobility API 사용 설정이 있고 API 키가 있는 경우
  if (ROUTE_OPTIMIZER_CONFIG.USE_KAKAO_MOBILITY && ROUTE_OPTIMIZER_CONFIG.KAKAO_REST_API_KEY) {
    try {
      // 카카오 길찾기 API (1:1 요청이므로 순차 호출)
      for (const dest of uncached) {
        if (!dest.geo) continue;

        await delay(ROUTE_OPTIMIZER_CONFIG.API_DELAY_MS);

        const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${dest.geo.lng},${dest.geo.lat}&priority=RECOMMEND`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `KakaoAK ${ROUTE_OPTIMIZER_CONFIG.KAKAO_REST_API_KEY}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.routes && data.routes.length > 0 && data.routes[0].summary) {
            const summary = data.routes[0].summary;
            const durationSec = summary.duration; // 초 단위
            const distanceM = summary.distance; // 미터 단위

            result[dest.id] = { durationSec, distanceM };
            DistanceCache.set('current', dest.id, durationSec, distanceM);
            continue;
          }
        }

        // API 실패 시 Haversine fallback
        const distKm = haversineDistance(origin.lat, origin.lng, dest.geo.lat, dest.geo.lng);
        result[dest.id] = {
          durationSec: Math.round(distKm / 40 * 3600),
          distanceM: Math.round(distKm * 1000)
        };
      }

      return result;
    } catch (e) {
      console.warn('카카오 Mobility API 호출 실패, Haversine fallback:', e);
    }
  }

  // Haversine 기반 추정치 반환 (기본값)
  // 한국 도로 환경 고려: 평균 40km/h 가정 (시내 도로 많음)
  for (const dest of uncached) {
    if (dest.geo) {
      const distKm = haversineDistance(origin.lat, origin.lng, dest.geo.lat, dest.geo.lng);
      // 도로 우회 계수 1.3 적용 (직선거리 대비 실제 도로는 약 30% 더 김)
      const adjustedDistKm = distKm * 1.3;
      result[dest.id] = {
        durationSec: Math.round(adjustedDistKm / 40 * 3600), // 평균 40km/h 가정
        distanceM: Math.round(adjustedDistKm * 1000)
      };
      DistanceCache.set('current', dest.id, result[dest.id].durationSec, result[dest.id].distanceM);
    }
  }

  return result;
}

// ===== Nearest Neighbor 알고리즘 =====

/**
 * Nearest Neighbor 알고리즘으로 경로 생성
 * @param {Object} depot - 시작점 {lat, lng}
 * @param {Array} stops - 방문할 업체 목록
 * @param {number} candidateK - Haversine 필터 후보 수
 * @returns {Promise<Array>} 최적 순서로 정렬된 업체 목록
 */
async function buildRouteNearestNeighbor(depot, stops, candidateK = ROUTE_OPTIMIZER_CONFIG.CANDIDATE_K) {
  if (stops.length === 0) return [];
  if (stops.length === 1) return stops;

  const remaining = new Map(stops.map(s => [s.id, s]));
  const ordered = [];
  let current = depot;

  console.log(`🛣️ Nearest Neighbor 경로 생성: ${stops.length}개 업체`);

  while (remaining.size > 0) {
    // 1) Haversine으로 후보 K개 필터
    const candidates = topKByHaversine(current, [...remaining.values()], candidateK);

    if (candidates.length === 0) {
      // 좌표 없는 업체들 추가
      ordered.push(...remaining.values());
      break;
    }

    // 2) 실제 주행시간 조회
    const durations = await fetchRouteMatrix(current, candidates);

    // 3) 가장 가까운 곳 선택
    // ★ ChatGPT 리뷰 반영: tie-breaker 추가 (동점 시 company_name 순으로 안정적 정렬)
    let minDuration = Infinity;
    let nearest = null;

    for (const cand of candidates) {
      const dur = durations[cand.id]?.durationSec || Infinity;
      if (dur < minDuration) {
        minDuration = dur;
        nearest = cand;
      } else if (dur === minDuration && nearest) {
        // tie-breaker: company_name 가나다순으로 안정적 선택
        const candName = cand.company_name || '';
        const nearestName = nearest.company_name || '';
        if (candName.localeCompare(nearestName, 'ko') < 0) {
          nearest = cand;
        }
      }
    }

    if (nearest) {
      ordered.push(nearest);
      remaining.delete(nearest.id);
      current = nearest.geo;
    } else {
      // Fallback: Haversine 기준 가장 가까운 곳
      const nearest = candidates[0];
      ordered.push(nearest);
      remaining.delete(nearest.id);
      current = nearest.geo;
    }

    // 지연 (API rate limit)
    if (remaining.size > 0) {
      await delay(ROUTE_OPTIMIZER_CONFIG.API_DELAY_MS);
    }
  }

  console.log(`🛣️ NN 경로 완료: ${ordered.length}개 업체`);
  return ordered;
}

// ===== 2-opt 개선 알고리즘 =====

/**
 * 2-opt 알고리즘으로 경로 개선
 * 두 간선을 교환하여 총 거리를 줄임
 *
 * ★ ChatGPT 리뷰 반영:
 * - 현재 Haversine(직선거리) 기반으로 평가
 * - API 호출 비용을 줄이기 위해 직선거리 사용
 * - NN은 Google 거리 기반, 2-opt는 Haversine 기반 (metric 불일치)
 * - 실무에서 큰 차이가 있다면 2-opt도 Google 거리 사용 고려
 *
 * @param {Array} route - 경로 [{geo: {lat, lng}, ...}]
 * @returns {Array} 개선된 경로
 */
function twoOptImprove(route) {
  if (route.length <= 3) return route;

  let improved = [...route];
  let bestDistance = calculateTotalDistance(improved);
  let iterations = 0;
  let didImprove = true;

  console.log(`🔄 2-opt 개선 시작: 초기 거리 ${(bestDistance / 1000).toFixed(1)}km`);

  while (didImprove && iterations < ROUTE_OPTIMIZER_CONFIG.TWO_OPT_MAX_ITERATIONS) {
    didImprove = false;
    iterations++;

    for (let i = 0; i < improved.length - 2; i++) {
      for (let j = i + 2; j < improved.length; j++) {
        // i와 j 사이 구간을 뒤집음
        const newRoute = twoOptSwap(improved, i, j);
        const newDistance = calculateTotalDistance(newRoute);

        if (newDistance < bestDistance) {
          improved = newRoute;
          bestDistance = newDistance;
          didImprove = true;
        }
      }
    }
  }

  console.log(`🔄 2-opt 완료: 최종 거리 ${(bestDistance / 1000).toFixed(1)}km (${iterations}회 반복)`);
  return improved;
}

/**
 * 2-opt 교환 수행
 */
function twoOptSwap(route, i, j) {
  const newRoute = route.slice(0, i + 1);
  const reversed = route.slice(i + 1, j + 1).reverse();
  const rest = route.slice(j + 1);
  return [...newRoute, ...reversed, ...rest];
}

/**
 * 경로 총 거리 계산 (Haversine 기반, 미터)
 */
function calculateTotalDistance(route) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    if (route[i].geo && route[i + 1].geo) {
      total += haversineDistance(
        route[i].geo.lat, route[i].geo.lng,
        route[i + 1].geo.lat, route[i + 1].geo.lng
      ) * 1000; // km → m
    }
  }
  return total;
}

// ===== Sweep 알고리즘 (날짜별 분할) =====

/**
 * Sweep 알고리즘으로 업체를 날짜별로 분할
 * 기준점에서 각도순으로 정렬 후 dayCapacity씩 자름
 * @param {Array} companies - 업체 목록 (좌표 포함)
 * @param {Object} depot - 기준점 {lat, lng}
 * @param {number} dayCapacity - 하루 방문 수
 * @returns {Array<Array>} 날짜별 업체 그룹
 */
function partitionBySweep(companies, depot, dayCapacity) {
  // 좌표 있는 업체만 필터
  const withGeo = companies.filter(c => c.geo && c.geo.lat && c.geo.lng);
  const withoutGeo = companies.filter(c => !c.geo || !c.geo.lat || !c.geo.lng);

  if (withGeo.length === 0) {
    // 좌표 없으면 순서대로 분할
    const buckets = [];
    for (let i = 0; i < companies.length; i += dayCapacity) {
      buckets.push(companies.slice(i, i + dayCapacity));
    }
    return buckets;
  }

  // 각도 계산 및 정렬
  const sorted = withGeo
    .map(c => ({
      ...c,
      _angle: calculateAngle(depot, c.geo)
    }))
    .sort((a, b) => a._angle - b._angle);

  // dayCapacity씩 분할
  const buckets = [];
  for (let i = 0; i < sorted.length; i += dayCapacity) {
    buckets.push(sorted.slice(i, i + dayCapacity));
  }

  // 좌표 없는 업체들 마지막 버킷에 추가
  if (withoutGeo.length > 0 && buckets.length > 0) {
    buckets[buckets.length - 1].push(...withoutGeo);
  } else if (withoutGeo.length > 0) {
    buckets.push(withoutGeo);
  }

  console.log(`📅 Sweep 분할 완료: ${buckets.length}일, 평균 ${(companies.length / buckets.length).toFixed(1)}개/일`);
  return buckets;
}

// ===== 메인 오케스트레이터 =====

/**
 * 최적 경로 생성 (메인 함수)
 * @param {Array} companies - 업체 목록
 * @param {Object} startPoint - 시작점 {lat, lng} 또는 null (첫 업체 기준)
 * @param {number} dayCapacity - 하루 방문 수 (기본 9)
 * @returns {Promise<Array<{day: number, route: Array, totalDistanceKm: number}>>}
 */
async function generateOptimalRoutes(companies, startPoint = null, dayCapacity = 9) {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('🚗 경로 최적화 시작');
  console.log(`   업체 수: ${companies.length}개`);
  console.log(`   하루 방문: ${dayCapacity}개`);
  console.log(`   예상 일수: ${Math.ceil(companies.length / dayCapacity)}일`);
  console.log('═══════════════════════════════════════════');
  console.log('');

  const startTime = Date.now();

  // 1) 모든 업체 지오코딩 확보
  const geocoded = await ensureGeocoded(companies);

  // 좌표 있는 업체만 필터
  const withGeo = geocoded.filter(c => c.geo && c.geo.lat && c.geo.lng);

  if (withGeo.length === 0) {
    console.error('좌표가 있는 업체가 없습니다.');
    return [];
  }

  // 2) 시작점 결정
  let depot = startPoint;
  if (!depot) {
    // 첫 번째 업체를 시작점으로
    depot = withGeo[0].geo;
  }

  // 3) Sweep 알고리즘으로 날짜별 분할
  const dayBuckets = partitionBySweep(withGeo, depot, dayCapacity);

  // 4) 각 날짜별 경로 최적화
  const results = [];
  let currentDepot = depot;

  for (let day = 0; day < dayBuckets.length; day++) {
    const bucket = dayBuckets[day];
    console.log(`\n📆 Day ${day + 1}: ${bucket.length}개 업체`);

    // 4-1) Nearest Neighbor
    let route = await buildRouteNearestNeighbor(currentDepot, bucket);

    // 4-2) 2-opt 개선
    route = twoOptImprove(route);

    // 총 거리 계산
    const totalDistanceM = calculateTotalDistance(route);
    const totalDistanceKm = totalDistanceM / 1000;

    results.push({
      day: day + 1,
      route: route,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10
    });

    // 다음 날 시작점 = 오늘 마지막 지점
    if (route.length > 0 && route[route.length - 1].geo) {
      currentDepot = route[route.length - 1].geo;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`🎉 경로 최적화 완료 (${elapsed}초 소요)`);
  console.log(`   총 ${results.length}일 스케줄 생성`);
  console.log('═══════════════════════════════════════════');
  console.log('');

  return results;
}

// ===== API 키 설정 함수 =====

/**
 * 카카오 REST API 키 설정
 * @param {string} apiKey - 카카오 REST API 키
 */
function setKakaoApiKey(apiKey) {
  ROUTE_OPTIMIZER_CONFIG.KAKAO_REST_API_KEY = apiKey;
  console.log('✅ 카카오 REST API 키 설정됨');
}

/**
 * 카카오 Mobility API 사용 설정
 * @param {boolean} enabled - true면 실제 주행거리 사용, false면 Haversine
 */
function setUseMobility(enabled) {
  ROUTE_OPTIMIZER_CONFIG.USE_KAKAO_MOBILITY = enabled;
  console.log(`✅ 카카오 Mobility API: ${enabled ? '사용' : '미사용 (Haversine)'}`);
}

/**
 * API 키 설정 상태 확인
 * @returns {boolean}
 */
function isApiKeySet() {
  return !!ROUTE_OPTIMIZER_CONFIG.KAKAO_REST_API_KEY;
}

/**
 * 지오코드 캐시 초기화
 */
function clearGeoCache() {
  GeoCodeCache.clear();
  console.log('✅ 지오코드 캐시 초기화됨');
}

/**
 * 거리 캐시 초기화
 */
function clearDistanceCache() {
  DistanceCache.clear();
  console.log('✅ 거리 캐시 초기화됨');
}

// ===== Supabase PostGIS 연동 (2026-01-04 추가) =====

/**
 * 업체 좌표를 Supabase에 저장 (PostGIS geo 컬럼 자동 동기화)
 * @param {number} companyId - 업체 ID
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @returns {Promise<boolean>} 성공 여부
 */
async function saveGeoToSupabase(companyId, lat, lng) {
  try {
    const supabase = getSupabase();

    // PostGIS: geo 컬럼은 WKT 형식으로 저장 (POINT(lng lat) 순서!)
    // Supabase는 geography 타입에 EWKT 문자열 직접 저장 가능
    const geoWKT = `SRID=4326;POINT(${lng} ${lat})`;

    const { error } = await supabase
      .from('client_companies')
      .update({
        lat: lat,
        lng: lng,
        geocoded_at: new Date().toISOString(),
        geo: geoWKT
      })
      .eq('id', companyId);

    if (error) {
      console.error(`❌ Supabase 좌표 저장 실패 (ID: ${companyId}):`, error);
      return false;
    }

    console.log(`✅ Supabase 좌표 저장 성공 (ID: ${companyId}): ${lat}, ${lng}`);
    return true;
  } catch (e) {
    console.error(`❌ Supabase 좌표 저장 오류 (ID: ${companyId}):`, e);
    return false;
  }
}

/**
 * 일괄 지오코딩 및 Supabase 저장
 * @param {Array} companies - 업체 목록 [{id, address, lat, lng, ...}]
 * @param {Function} progressCallback - 진행 상태 콜백 (current, total, company)
 * @returns {Promise<{success: number, failed: number, skipped: number}>}
 */
async function batchGeocodeAndSave(companies, progressCallback = null) {
  const result = { success: 0, failed: 0, skipped: 0 };

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`📍 일괄 지오코딩 시작: ${companies.length}개 업체`);
  console.log('═══════════════════════════════════════════');

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];

    // 진행 상태 콜백
    if (progressCallback) {
      progressCallback(i + 1, companies.length, company);
    }

    // 이미 좌표가 있는 경우 스킵
    if (company.lat && company.lng && company.geocoded_at) {
      result.skipped++;
      continue;
    }

    // 주소가 없는 경우 스킵
    if (!company.address) {
      console.warn(`⚠️ 주소 없음: ${company.company_name} (ID: ${company.id})`);
      result.failed++;
      continue;
    }

    // 카카오 API로 지오코딩
    const geo = await geocodeAddress(company.address);

    if (geo) {
      // Supabase에 저장
      const saved = await saveGeoToSupabase(company.id, geo.lat, geo.lng);

      if (saved) {
        result.success++;
      } else {
        result.failed++;
      }
    } else {
      console.warn(`⚠️ 지오코딩 실패: ${company.company_name} (${company.address})`);
      result.failed++;
    }

    // API rate limit 대응 지연
    await delay(ROUTE_OPTIMIZER_CONFIG.API_DELAY_MS);

    // 10개마다 진행 로그
    if ((i + 1) % 10 === 0) {
      console.log(`  진행: ${i + 1}/${companies.length} (성공: ${result.success}, 실패: ${result.failed})`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`📍 일괄 지오코딩 완료`);
  console.log(`   성공: ${result.success}개`);
  console.log(`   실패: ${result.failed}개`);
  console.log(`   스킵(이미 있음): ${result.skipped}개`);
  console.log('═══════════════════════════════════════════');

  return result;
}

/**
 * Supabase에서 좌표 없는 업체 목록 조회
 * @returns {Promise<Array>} 좌표 없는 업체 목록
 */
async function getCompaniesWithoutGeo() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('client_companies')
      .select('id, company_name, address, region, lat, lng, geocoded_at')
      .or('lat.is.null,lng.is.null,geocoded_at.is.null')
      .not('address', 'is', null)
      .order('id');

    if (error) throw error;

    console.log(`📍 좌표 없는 업체: ${data.length}개`);
    return data || [];
  } catch (e) {
    console.error('❌ 좌표 없는 업체 조회 실패:', e);
    return [];
  }
}

/**
 * Supabase PostGIS RPC로 가장 가까운 업체 조회
 * @param {number} originId - 기준 업체 ID
 * @param {number} k - 조회할 개수 (기본 10)
 * @returns {Promise<Array>} 가까운 업체 목록 [{id, company_name, address, region, lat, lng, dist_m}]
 */
async function findNearestCompanies(originId, k = 10) {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .rpc('nearest_companies', {
        origin_id: originId,
        k: k
      });

    if (error) throw error;

    console.log(`📍 가장 가까운 ${k}개 업체 (기준 ID: ${originId}):`, data);
    return data || [];
  } catch (e) {
    console.error('❌ 근접 업체 조회 실패:', e);
    return [];
  }
}

/**
 * 좌표 기준으로 가장 가까운 업체 조회 (PostGIS RPC)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} k - 조회할 개수 (기본 10)
 * @returns {Promise<Array>} 가까운 업체 목록
 */
async function findNearestCompaniesByCoords(lat, lng, k = 10) {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .rpc('nearest_companies_by_coords', {
        origin_lat: lat,
        origin_lng: lng,
        k: k
      });

    if (error) throw error;

    console.log(`📍 좌표 (${lat}, ${lng}) 기준 가장 가까운 ${k}개 업체:`, data);
    return data || [];
  } catch (e) {
    console.error('❌ 좌표 기준 근접 업체 조회 실패:', e);
    return [];
  }
}

// ===== PostGIS 기반 경로 최적화 (2026-01-04 추가) =====

/**
 * PostGIS RPC를 사용한 Nearest Neighbor 경로 생성
 * 카카오 API 호출 없이 DB에서 직접 거리 계산 (빠름)
 *
 * @param {Object} startCoord - 시작 좌표 {lat, lng}
 * @param {Array} companies - 방문할 업체 목록 [{id, company_name, lat, lng, ...}]
 * @returns {Promise<Array>} 정렬된 업체 목록
 */
async function buildRoutePostGIS(startCoord, companies) {
  if (companies.length === 0) return [];
  if (companies.length === 1) return companies;

  const remaining = new Map(companies.map(c => [c.id, c]));
  const ordered = [];
  let currentLat = startCoord.lat;
  let currentLng = startCoord.lng;

  console.log(`🗄️ PostGIS Nearest Neighbor 경로 생성: ${companies.length}개 업체`);

  while (remaining.size > 0) {
    // PostGIS RPC로 가장 가까운 업체 조회
    const nearestList = await findNearestCompaniesByCoords(
      currentLat,
      currentLng,
      remaining.size // 남은 전체에서 검색
    );

    // remaining에 있는 업체 중 가장 가까운 것 선택
    let nearest = null;
    for (const n of nearestList) {
      if (remaining.has(n.id)) {
        nearest = remaining.get(n.id);
        // dist_m 정보 추가
        nearest.dist_m = n.dist_m;
        break;
      }
    }

    if (nearest) {
      ordered.push(nearest);
      remaining.delete(nearest.id);
      currentLat = nearest.lat || nearest.geo?.lat;
      currentLng = nearest.lng || nearest.geo?.lng;
    } else {
      // Fallback: 남은 업체 그대로 추가
      ordered.push(...remaining.values());
      break;
    }
  }

  console.log(`🗄️ PostGIS NN 경로 완료: ${ordered.length}개 업체`);
  return ordered;
}

/**
 * PostGIS 기반 전체 경로 최적화
 * API 호출 없이 빠르게 경로 생성
 *
 * @param {Array} companies - 업체 목록
 * @param {Object} startPoint - 시작 좌표 {lat, lng} (선택)
 * @param {number} dayCapacity - 하루 방문 업체 수
 * @returns {Promise<Array>} 날짜별 경로
 */
async function generateOptimalRoutesPostGIS(companies, startPoint = null, dayCapacity = 9) {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('🗄️ PostGIS 경로 최적화 시작 (빠른 모드)');
  console.log(`   업체 수: ${companies.length}개`);
  console.log(`   하루 방문: ${dayCapacity}개`);
  console.log(`   예상 일수: ${Math.ceil(companies.length / dayCapacity)}일`);
  console.log('═══════════════════════════════════════════');
  console.log('');

  const startTime = Date.now();

  // 좌표 있는 업체만 필터
  const withGeo = companies.filter(c =>
    (c.lat && c.lng) || (c.geo && c.geo.lat && c.geo.lng)
  );

  // 좌표 정규화
  const normalized = withGeo.map(c => ({
    ...c,
    lat: c.lat || c.geo?.lat,
    lng: c.lng || c.geo?.lng
  }));

  if (normalized.length === 0) {
    console.error('좌표가 있는 업체가 없습니다.');
    return [];
  }

  console.log(`📍 좌표 보유 업체: ${normalized.length}개`);

  // 시작점 결정
  let depot = startPoint;
  if (!depot) {
    depot = { lat: normalized[0].lat, lng: normalized[0].lng };
  }

  // Sweep 알고리즘으로 날짜별 분할
  const geoForSweep = normalized.map(c => ({
    ...c,
    geo: { lat: c.lat, lng: c.lng }
  }));
  const dayBuckets = partitionBySweep(geoForSweep, depot, dayCapacity);

  // 각 날짜별 경로 최적화
  const results = [];
  let currentDepot = depot;

  for (let day = 0; day < dayBuckets.length; day++) {
    const bucket = dayBuckets[day];
    console.log(`\n📆 Day ${day + 1}: ${bucket.length}개 업체`);

    // PostGIS Nearest Neighbor
    let route = await buildRoutePostGIS(currentDepot, bucket);

    // 2-opt 개선 (Haversine 기반)
    route = twoOptImprove(route.map(c => ({
      ...c,
      geo: { lat: c.lat, lng: c.lng }
    })));

    // 총 거리 계산
    let totalDistanceM = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i].geo || { lat: route[i].lat, lng: route[i].lng };
      const to = route[i + 1].geo || { lat: route[i + 1].lat, lng: route[i + 1].lng };
      totalDistanceM += haversineDistance(from.lat, from.lng, to.lat, to.lng);
    }
    const totalDistanceKm = totalDistanceM / 1000;

    results.push({
      day: day + 1,
      route: route,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10
    });

    // 다음 날 시작점 = 오늘 마지막 지점
    if (route.length > 0) {
      const last = route[route.length - 1];
      currentDepot = { lat: last.lat || last.geo?.lat, lng: last.lng || last.geo?.lng };
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`🗄️ PostGIS 경로 최적화 완료: ${elapsed}초`);
  console.log(`   총 ${results.length}일`);
  console.log('═══════════════════════════════════════════');

  return results;
}

/**
 * 모든 업체의 지오코딩 상태 통계
 * @returns {Promise<{total: number, geocoded: number, pending: number}>}
 */
async function getGeocodingStats() {
  try {
    const supabase = getSupabase();

    // 전체 업체 수
    const { count: total, error: totalError } = await supabase
      .from('client_companies')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // 지오코딩 완료 업체 수
    const { count: geocoded, error: geoError } = await supabase
      .from('client_companies')
      .select('*', { count: 'exact', head: true })
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    if (geoError) throw geoError;

    const stats = {
      total: total || 0,
      geocoded: geocoded || 0,
      pending: (total || 0) - (geocoded || 0)
    };

    console.log(`📊 지오코딩 통계: 전체 ${stats.total}개, 완료 ${stats.geocoded}개, 대기 ${stats.pending}개`);
    return stats;
  } catch (e) {
    console.error('❌ 지오코딩 통계 조회 실패:', e);
    return { total: 0, geocoded: 0, pending: 0 };
  }
}

// ===== 전역 export =====
window.RouteOptimizer = {
  // 설정
  setKakaoApiKey,
  setUseMobility,
  isApiKeySet,
  config: ROUTE_OPTIMIZER_CONFIG,

  // 캐시 관리
  clearGeoCache,
  clearDistanceCache,

  // 핵심 함수
  generateOptimalRoutes,
  ensureGeocoded,

  // 유틸리티
  haversineDistance,
  topKByHaversine,
  calculateAngle,

  // 알고리즘
  buildRouteNearestNeighbor,
  twoOptImprove,
  partitionBySweep,

  // 캐시 객체
  GeoCodeCache,
  DistanceCache,

  // Supabase PostGIS 연동 (2026-01-04 추가)
  saveGeoToSupabase,
  batchGeocodeAndSave,
  getCompaniesWithoutGeo,
  findNearestCompanies,
  findNearestCompaniesByCoords,
  getGeocodingStats,

  // PostGIS 기반 경로 최적화 (2026-01-04 추가)
  buildRoutePostGIS,
  generateOptimalRoutesPostGIS,

  // 지오코딩 함수 export
  geocodeAddress
};

console.log('✅ RouteOptimizer 모듈 로드됨 (카카오맵 API)');
console.log('   설정: RouteOptimizer.setKakaoApiKey("YOUR_KAKAO_REST_API_KEY")');
console.log('   실행: RouteOptimizer.generateOptimalRoutes(companies, startPoint, dayCapacity)');
console.log('   (카카오 개발자 콘솔: https://developers.kakao.com/console/app)');
