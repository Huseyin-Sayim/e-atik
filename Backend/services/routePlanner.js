const { PrismaClient } = require('@prisma/client');
const { enrichBinsReadOnly, buildBinLabel, FULLNESS_ALERT_THRESHOLD } = require('./employeeRegionAlerts');
const { fetchRoadRoute } = require('./roadRouting');
const { assertPointInParcel } = require('./campusParcels');
const { buildWasteRequestLabel } = require('./wasteRequestLabels');

const prisma = new PrismaClient();

const DEFAULT_DEMO_START = {
  lat: parseFloat(process.env.ROUTE_DEMO_START_LAT) || 38.458919,
  lng: parseFloat(process.env.ROUTE_DEMO_START_LNG) || 27.227533,
};

const DEFAULT_WEIGHTS = { fullness: 0.7, distance: 0.3 };
const DEFAULT_MIN_FULLNESS = 0;
const DEFAULT_MAX_STOPS = 20;

const ROUTE_MIN_FULLNESS =
  parseFloat(process.env.ROUTE_MIN_FULLNESS) || 0.05;
const ROUTE_RELATIVE_TOP_N = parseInt(process.env.ROUTE_RELATIVE_TOP_N || '5', 10);
const ROUTE_RELATIVE_MIN = parseFloat(process.env.ROUTE_RELATIVE_MIN) || 0.02;

const ROUTE_WASTE_WEIGHT_DISTANCE =
  parseFloat(process.env.ROUTE_WASTE_WEIGHT_DISTANCE) || 0.75;
const ROUTE_WASTE_WEIGHT_AGE = parseFloat(process.env.ROUTE_WASTE_WEIGHT_AGE) || 0.25;
const ROUTE_WASTE_MAX_STOPS =
  parseInt(process.env.ROUTE_WASTE_MAX_STOPS || '20', 10);

const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function scoreBin(bin, currentLat, currentLng, weights = DEFAULT_WEIGHTS) {
  const fullness = bin.predictedFullness ?? 0;
  const distKm = haversineKm(currentLat, currentLng, bin.latitude, bin.longitude);
  return weights.fullness * fullness + weights.distance * (1 / (1 + distKm));
}

function compareBinsForGreedy(a, b, currentLat, currentLng, weights) {
  const scoreA = scoreBin(a, currentLat, currentLng, weights);
  const scoreB = scoreBin(b, currentLat, currentLng, weights);
  if (scoreB !== scoreA) return scoreB - scoreA;

  const fullA = a.predictedFullness ?? 0;
  const fullB = b.predictedFullness ?? 0;
  if (fullB !== fullA) return fullB - fullA;

  const distA = haversineKm(currentLat, currentLng, a.latitude, a.longitude);
  const distB = haversineKm(currentLat, currentLng, b.latitude, b.longitude);
  if (distA !== distB) return distA - distB;

  return String(a.id).localeCompare(String(b.id));
}

/**
 * Rota adayları: önce sabit eşik, yoksa bölgedeki en dolu üst-N (göreli).
 */
function selectRouteCandidates(enrichedBins, options = {}) {
  const routeMin =
    options.routeMinFullness ?? ROUTE_MIN_FULLNESS;
  const relativeTopN = options.relativeTopN ?? ROUTE_RELATIVE_TOP_N;
  const relativeMin = options.relativeMin ?? ROUTE_RELATIVE_MIN;

  const byThreshold = enrichedBins.filter(
    (b) => (b.predictedFullness ?? 0) >= routeMin
  );
  if (byThreshold.length > 0) {
    return { candidates: byThreshold, selectionMode: 'threshold' };
  }

  const sorted = [...enrichedBins].sort(
    (a, b) => (b.predictedFullness ?? 0) - (a.predictedFullness ?? 0)
  );
  const maxFullness = sorted[0]?.predictedFullness ?? 0;
  if (maxFullness < relativeMin) {
    return { candidates: [], selectionMode: 'none' };
  }

  const top = sorted.slice(0, Math.max(1, relativeTopN));
  return { candidates: top, selectionMode: 'relative_top_n' };
}

function scoreWasteRequest(request, currentLat, currentLng, weights) {
  const distKm = haversineKm(currentLat, currentLng, request.latitude, request.longitude);
  const ageHours =
    (Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60);
  const ageFactor = Math.min(ageHours / 24, 1);
  return (
    weights.distance * (1 / (1 + distKm)) + weights.age * ageFactor
  );
}

function compareWasteRequestsForGreedy(a, b, currentLat, currentLng, weights) {
  const scoreA = scoreWasteRequest(a, currentLat, currentLng, weights);
  const scoreB = scoreWasteRequest(b, currentLat, currentLng, weights);
  if (scoreB !== scoreA) return scoreB - scoreA;

  const distA = haversineKm(currentLat, currentLng, a.latitude, a.longitude);
  const distB = haversineKm(currentLat, currentLng, b.latitude, b.longitude);
  if (distA !== distB) return distA - distB;

  return String(a.id).localeCompare(String(b.id));
}

function requestMatchesRegionParcel(request, regionParcelId) {
  if (!regionParcelId) return false;
  if (request.parcelKey === regionParcelId) return true;
  const inParcel = assertPointInParcel(
    request.latitude,
    request.longitude,
    regionParcelId
  );
  return inParcel.ok;
}

function mapWasteRequestToStop(request, order, distanceFromPrevKm) {
  return {
    order,
    stopType: 'waste_request',
    requestId: request.id,
    label: buildWasteRequestLabel(request.wasteType),
    wasteType: request.wasteType,
    addressLine: request.addressLine,
    city: request.city,
    district: request.district,
    latitude: request.latitude,
    longitude: request.longitude,
    status: request.status,
    distanceFromPrevKm: Math.round(distanceFromPrevKm * 1000) / 1000,
    fullnessPercent: 0,
    isCritical: false,
  };
}

function buildGreedyWasteRequestRoute({
  startLat,
  startLng,
  requests,
  weights = { distance: ROUTE_WASTE_WEIGHT_DISTANCE, age: ROUTE_WASTE_WEIGHT_AGE },
  maxStops = ROUTE_WASTE_MAX_STOPS,
}) {
  const unvisited = [...requests];
  const stops = [];
  let currentLat = startLat;
  let currentLng = startLng;
  let totalDistanceKm = 0;

  while (unvisited.length > 0 && stops.length < maxStops) {
    unvisited.sort((a, b) =>
      compareWasteRequestsForGreedy(a, b, currentLat, currentLng, weights)
    );
    const next = unvisited.shift();
    if (!next) break;
    const legKm = haversineKm(currentLat, currentLng, next.latitude, next.longitude);
    totalDistanceKm += legKm;
    stops.push(mapWasteRequestToStop(next, stops.length + 1, legKm));
    currentLat = next.latitude;
    currentLng = next.longitude;
  }

  return { stops, totalDistanceKm, selectedIds: stops.map((s) => s.requestId) };
}

function mapBinToStop(bin, order, distanceFromPrevKm) {
  const fullness = bin.predictedFullness ?? 0;
  const fullnessPercent = Math.round(fullness * 100);
  return {
    order,
    stopType: 'bin',
    binId: bin.id,
    label: buildBinLabel(bin.type, bin.wasteCategory),
    type: bin.type,
    wasteCategory: bin.wasteCategory,
    latitude: bin.latitude,
    longitude: bin.longitude,
    predictedFullness: fullness,
    fullnessPercent,
    distanceFromPrevKm: Math.round(distanceFromPrevKm * 1000) / 1000,
    isCritical: fullness >= FULLNESS_ALERT_THRESHOLD,
  };
}

function buildGreedyRoute({
  startLat,
  startLng,
  bins,
  weights = DEFAULT_WEIGHTS,
  minFullness = DEFAULT_MIN_FULLNESS,
  maxStops = DEFAULT_MAX_STOPS,
}) {
  const candidates = bins.filter((b) => (b.predictedFullness ?? 0) >= minFullness);
  const unvisited = [...candidates];
  const stops = [];
  let currentLat = startLat;
  let currentLng = startLng;
  let totalDistanceKm = 0;

  while (unvisited.length > 0 && stops.length < maxStops) {
    unvisited.sort((a, b) =>
      compareBinsForGreedy(a, b, currentLat, currentLng, weights)
    );
    const next = unvisited.shift();
    if (!next) break;
    const legKm = haversineKm(currentLat, currentLng, next.latitude, next.longitude);
    totalDistanceKm += legKm;
    stops.push(mapBinToStop(next, stops.length + 1, legKm));
    currentLat = next.latitude;
    currentLng = next.longitude;
  }

  return { stops, totalDistanceKm };
}

function buildPolyline(start, stops) {
  const line = [{ lat: start.lat, lng: start.lng }];
  stops.forEach((s) => line.push({ lat: s.latitude, lng: s.longitude }));
  return line;
}

function buildSummary(stops, totalDistanceKm, extras = {}) {
  if (!stops.length) {
    return {
      stopCount: 0,
      totalDistanceKm: 0,
      avgFullnessPercent: 0,
      criticalCount: 0,
      wasteRequestCount: 0,
      onRoads: false,
      estimatedDriveMin: 0,
      ...extras,
    };
  }
  const binStops = stops.filter((s) => s.stopType !== 'waste_request');
  const wasteStops = stops.filter((s) => s.stopType === 'waste_request');
  const sumFull = binStops.reduce((acc, s) => acc + (s.fullnessPercent ?? 0), 0);
  return {
    stopCount: stops.length,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    avgFullnessPercent: binStops.length ? Math.round(sumFull / binStops.length) : 0,
    criticalCount: binStops.filter((s) => s.isCritical).length,
    wasteRequestCount: wasteStops.length,
    onRoads: extras.onRoads ?? false,
    estimatedDriveMin: extras.estimatedDriveMin ?? null,
    routeWarning: extras.routeWarning ?? null,
  };
}

async function planWasteCollectorRoute(userId, options = {}) {
  const start = {
    lat: options.startLat ?? DEFAULT_DEMO_START.lat,
    lng: options.startLng ?? DEFAULT_DEMO_START.lng,
  };

  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      regionId: true,
      region: {
        select: { id: true, name: true, region_id: true },
      },
    },
  });

  if (!employee?.regionId) {
    return {
      needsRegionSelection: true,
      routeKind: 'waste_requests',
      regionName: null,
      regionParcelId: null,
      start,
      stops: [],
      polyline: [],
      summary: buildSummary([], 0, { noCollectionNeeded: true }),
    };
  }

  const regionParcelId = employee.region?.region_id || null;

  const openRequests = await prisma.wasteRequest.findMany({
    where: {
      status: { in: ['PENDING', 'ON_ROUTE'] },
      OR: [{ assignedEmployeeId: null }, { assignedEmployeeId: userId }],
    },
    orderBy: { createdAt: 'asc' },
  });

  const candidates = openRequests.filter((r) =>
    requestMatchesRegionParcel(r, regionParcelId)
  );

  const noCollectionNeeded = candidates.length === 0;

  const { stops, totalDistanceKm, selectedIds } = buildGreedyWasteRequestRoute({
    startLat: start.lat,
    startLng: start.lng,
    requests: candidates,
    maxStops: options.maxStops ?? ROUTE_WASTE_MAX_STOPS,
  });

  if (selectedIds.length > 0) {
    await prisma.wasteRequest.updateMany({
      where: { id: { in: selectedIds }, status: { in: ['PENDING', 'ON_ROUTE'] } },
      data: { status: 'ON_ROUTE', assignedEmployeeId: userId },
    });
  }

  return {
    needsRegionSelection: false,
    routeKind: 'waste_requests',
    regionName: employee.region?.name || null,
    regionParcelId,
    regionId: employee.regionId,
    start,
    stops,
    navigationMode: 'step-by-step',
    selectionMode: 'waste_requests',
    summary: buildSummary(stops, totalDistanceKm, {
      onRoads: null,
      estimatedDriveMin: null,
      routeWarning: null,
      noCollectionNeeded,
    }),
  };
}

async function planTrashCollectorRoute(userId, options = {}) {
  const start = {
    lat: options.startLat ?? DEFAULT_DEMO_START.lat,
    lng: options.startLng ?? DEFAULT_DEMO_START.lng,
  };

  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      regionId: true,
      region: {
        select: { id: true, name: true, region_id: true },
      },
    },
  });

  if (!employee?.regionId) {
    return {
      needsRegionSelection: true,
      routeKind: 'bins',
      regionName: null,
      regionParcelId: null,
      start,
      stops: [],
      polyline: [],
      summary: buildSummary([], 0),
    };
  }

  const bins = await prisma.bin.findMany({
    where: { regionId: employee.regionId },
    select: {
      id: true,
      type: true,
      wasteCategory: true,
      latitude: true,
      longitude: true,
      capacityVolume: true,
      createdAt: true,
      predictedFullness: true,
    },
  });

  const enriched = await enrichBinsReadOnly(bins);
  const { candidates, selectionMode } = selectRouteCandidates(enriched, options);
  const noCollectionNeeded = candidates.length === 0;

  const { stops, totalDistanceKm: straightDistanceKm } = buildGreedyRoute({
    startLat: start.lat,
    startLng: start.lng,
    bins: candidates,
    weights: options.weights,
    minFullness: DEFAULT_MIN_FULLNESS,
    maxStops: options.maxStops ?? DEFAULT_MAX_STOPS,
  });

  return {
    needsRegionSelection: false,
    routeKind: 'bins',
    regionName: employee.region?.name || null,
    regionParcelId: employee.region?.region_id || null,
    regionId: employee.regionId,
    start,
    stops,
    navigationMode: 'step-by-step',
    selectionMode,
    summary: buildSummary(stops, straightDistanceKm, {
      onRoads: null,
      estimatedDriveMin: null,
      routeWarning: null,
      noCollectionNeeded,
    }),
  };
}

async function planEmployeeRoute(userId, options = {}) {
  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: { employeeType: true },
  });

  if (employee?.employeeType === 'WASTE_COLLECTOR') {
    return planWasteCollectorRoute(userId, options);
  }

  return planTrashCollectorRoute(userId, options);
}

async function planRouteLeg(fromLat, fromLng, toLat, toLng) {
  const road = await fetchRoadRoute([
    { lat: fromLat, lng: fromLng },
    { lat: toLat, lng: toLng },
  ]);
  return {
    polyline: road.polyline,
    distanceKm: road.distanceKm,
    durationMin: road.durationMin,
    onRoads: road.onRoads,
    warning: road.warning ?? null,
  };
}

module.exports = {
  DEFAULT_DEMO_START,
  DEFAULT_WEIGHTS,
  DEFAULT_MIN_FULLNESS,
  DEFAULT_MAX_STOPS,
  ROUTE_MIN_FULLNESS,
  ROUTE_RELATIVE_TOP_N,
  ROUTE_RELATIVE_MIN,
  ROUTE_WASTE_WEIGHT_DISTANCE,
  ROUTE_WASTE_WEIGHT_AGE,
  ROUTE_WASTE_MAX_STOPS,
  FULLNESS_ALERT_THRESHOLD,
  haversineKm,
  scoreBin,
  scoreWasteRequest,
  compareBinsForGreedy,
  compareWasteRequestsForGreedy,
  requestMatchesRegionParcel,
  selectRouteCandidates,
  buildGreedyRoute,
  buildGreedyWasteRequestRoute,
  buildPolyline,
  buildSummary,
  planEmployeeRoute,
  planWasteCollectorRoute,
  planTrashCollectorRoute,
  planRouteLeg,
  mapWasteRequestToStop,
};
