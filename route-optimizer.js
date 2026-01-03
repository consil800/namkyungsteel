/**
 * 영업사원 경로 최적화 모듈
 * ChatGPT + Claude 협업 설계 (2026-01-03)
 *
 * 핵심 알고리즘:
 * 1. Geocoding API: 주소 → 좌표 변환 (캐시 적용)
 * 2. Haversine: 직선거리로 후보 K개 필터링
 * 3. Routes API: 실제 주행거리 계산
 * 4. Nearest Neighbor + 2-opt: 경로 최적화
 * 5. Sweep 알고리즘: 날짜별 분할
 */

// ===== 설정 =====
const ROUTE_OPTIMIZER_CONFIG = {
  // Google Maps API 키 (별도 설정 필요)
  GOOGLE_MAPS_API_KEY: '', // 사용자가 설정해야 함

  // Haversine 프리필터 후보 수
  CANDIDATE_K: 20,

  // 거리 캐시 만료 시간 (30일, 밀리초)
  CACHE_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000,

  // API 호출 지연 (rate limit 대응, 밀리초)
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
 * Google Geocoding API로 주소를 좌표로 변환
 * @param {string} address - 주소
 * @returns {Promise<{lat: number, lng: number, placeId: string} | null>}
 */
async function geocodeAddress(address) {
  if (!ROUTE_OPTIMIZER_CONFIG.GOOGLE_MAPS_API_KEY) {
    console.error('Google Maps API 키가 설정되지 않았습니다.');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${ROUTE_OPTIMIZER_CONFIG.GOOGLE_MAPS_API_KEY}&language=ko`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        placeId: result.place_id
      };
    } else {
      console.warn(`지오코딩 실패 (${address}):`, data.status);
      return null;
    }
  } catch (e) {
    console.error(`지오코딩 오류 (${address}):`, e);
    return null;
  }
}

/**
 * 모든 업체의 좌표를 확보 (캐시 우선, 없으면 API 호출)
 * @param {Array} companies - 업체 목록 [{id, address, geo_lat, geo_lng, ...}]
 * @returns {Promise<Array>} 좌표가 추가된 업체 목록
 */
async function ensureGeocoded(companies) {
  const supabase = getSupabase();
  const results = [];
  let geocodedCount = 0;

  console.log(`📍 지오코딩 시작: ${companies.length}개 업체`);

  for (const company of companies) {
    // 이미 좌표가 있는 경우 스킵
    if (company.geo_lat && company.geo_lng) {
      results.push({
        ...company,
        geo: { lat: company.geo_lat, lng: company.geo_lng }
      });
      continue;
    }

    // 주소가 없는 경우 스킵
    if (!company.address) {
      console.warn(`주소 없음: ${company.company_name}`);
      results.push(company);
      continue;
    }

    // API 호출로 좌표 획득
    await delay(ROUTE_OPTIMIZER_CONFIG.API_DELAY_MS);
    const geo = await geocodeAddress(company.address);

    if (geo) {
      geocodedCount++;

      // Supabase에 좌표 저장
      try {
        await supabase
          .from('client_companies')
          .update({
            geo_lat: geo.lat,
            geo_lng: geo.lng,
            geo_place_id: geo.placeId,
            geocoded_at: new Date().toISOString()
          })
          .eq('id', company.id);
      } catch (e) {
        console.warn(`좌표 저장 실패 (${company.company_name}):`, e);
      }

      results.push({
        ...company,
        geo_lat: geo.lat,
        geo_lng: geo.lng,
        geo: { lat: geo.lat, lng: geo.lng }
      });
    } else {
      results.push(company);
    }

    // 진행률 로그
    if (geocodedCount % 10 === 0) {
      console.log(`  지오코딩 진행: ${geocodedCount}개 완료`);
    }
  }

  console.log(`📍 지오코딩 완료: ${geocodedCount}개 신규 변환`);
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
 * Google Routes API로 실제 주행거리/시간 조회 (1:N)
 * @param {Object} origin - 출발지 {lat, lng}
 * @param {Array} destinations - 도착지 목록 [{id, geo: {lat, lng}}]
 * @returns {Promise<Object>} {id: {durationSec, distanceM}}
 */
async function fetchRouteMatrix(origin, destinations) {
  if (!ROUTE_OPTIMIZER_CONFIG.GOOGLE_MAPS_API_KEY) {
    // API 키 없으면 Haversine 기반 추정치 반환
    console.warn('API 키 없음: Haversine 거리로 대체');
    const result = {};
    for (const dest of destinations) {
      if (dest.geo) {
        const distKm = haversineDistance(origin.lat, origin.lng, dest.geo.lat, dest.geo.lng);
        result[dest.id] = {
          durationSec: Math.round(distKm / 40 * 3600), // 평균 40km/h 가정
          distanceM: Math.round(distKm * 1000)
        };
      }
    }
    return result;
  }

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

  // Routes API 호출 (Distance Matrix 대신 Routes API 권장되지만,
  // 브라우저에서는 Distance Matrix가 더 쉬움)
  try {
    const originsParam = `${origin.lat},${origin.lng}`;
    const destsParam = uncached.map(d => `${d.geo.lat},${d.geo.lng}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsParam}&destinations=${destsParam}&mode=driving&language=ko&key=${ROUTE_OPTIMIZER_CONFIG.GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.rows && data.rows[0]) {
      const elements = data.rows[0].elements;

      for (let i = 0; i < uncached.length; i++) {
        const el = elements[i];
        if (el.status === 'OK') {
          const durationSec = el.duration.value;
          const distanceM = el.distance.value;

          result[uncached[i].id] = { durationSec, distanceM };
          DistanceCache.set('current', uncached[i].id, durationSec, distanceM);
        }
      }
    }
  } catch (e) {
    console.error('Routes API 호출 실패:', e);

    // Fallback: Haversine
    for (const dest of uncached) {
      if (dest.geo && !result[dest.id]) {
        const distKm = haversineDistance(origin.lat, origin.lng, dest.geo.lat, dest.geo.lng);
        result[dest.id] = {
          durationSec: Math.round(distKm / 40 * 3600),
          distanceM: Math.round(distKm * 1000)
        };
      }
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
 * Google Maps API 키 설정
 * @param {string} apiKey - Google Maps API 키
 */
function setGoogleMapsApiKey(apiKey) {
  ROUTE_OPTIMIZER_CONFIG.GOOGLE_MAPS_API_KEY = apiKey;
  console.log('✅ Google Maps API 키 설정됨');
}

/**
 * API 키 설정 상태 확인
 * @returns {boolean}
 */
function isApiKeySet() {
  return !!ROUTE_OPTIMIZER_CONFIG.GOOGLE_MAPS_API_KEY;
}

// ===== 전역 export =====
window.RouteOptimizer = {
  // 설정
  setGoogleMapsApiKey,
  isApiKeySet,
  config: ROUTE_OPTIMIZER_CONFIG,

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

  // 캐시
  DistanceCache
};

console.log('✅ RouteOptimizer 모듈 로드됨');
console.log('   사용법: RouteOptimizer.setGoogleMapsApiKey("YOUR_API_KEY")');
console.log('   실행: RouteOptimizer.generateOptimalRoutes(companies, startPoint, dayCapacity)');
