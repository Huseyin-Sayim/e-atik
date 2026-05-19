const { PrismaClient } = require('@prisma/client');
const { getAllEmployeeLocations, getEmployeeLocation } = require('./locationStore');
const { getEmployeeRouteProgress } = require('./employeeRouteProgressStore');
const { planEmployeeRoute, planRouteLeg } = require('./routePlanner');

const prisma = new PrismaClient();

function countRemainingByType(stops) {
  let remainingContainers = 0;
  let remainingWastePoints = 0;

  for (const stop of stops) {
    if (stop.type === 'CONTAINER_SMALL' || stop.type === 'CONTAINER_LARGE') {
      remainingContainers += 1;
    } else if (stop.type === 'WASTE_POINT') {
      remainingWastePoints += 1;
    }
  }

  return { remainingContainers, remainingWastePoints };
}

function buildProgressSummary(plan, currentStep) {
  const totalStops = plan.stops?.length || 0;
  const remainingStops = plan.stops?.slice(currentStep) || [];
  const { remainingContainers, remainingWastePoints } = countRemainingByType(remainingStops);

  return {
    currentStep,
    totalStops,
    remainingStops: remainingStops.length,
    remainingContainers,
    remainingWastePoints,
    noCollectionNeeded: Boolean(plan.summary?.noCollectionNeeded),
  };
}

function getLegEndpoints(plan, stepIndex) {
  const stops = plan.stops || [];
  if (stepIndex >= stops.length) return null;

  const toStop = stops[stepIndex];
  let from;

  if (stepIndex === 0) {
    from = {
      lat: plan.start.lat,
      lng: plan.start.lng,
      label: 'Başlangıç',
    };
  } else {
    const prev = stops[stepIndex - 1];
    from = {
      lat: prev.latitude,
      lng: prev.longitude,
      label: prev.label,
      stop: prev,
    };
  }

  return {
    from,
    to: {
      lat: toStop.latitude,
      lng: toStop.longitude,
      label: toStop.label,
      stop: toStop,
    },
  };
}

async function buildPlanForEmployee(employeeId, location) {
  const options = {};
  if (location?.latitude != null && location?.longitude != null) {
    options.startLat = location.latitude;
    options.startLng = location.longitude;
  }
  return planEmployeeRoute(employeeId, options);
}

async function listAllEmployeesWithStatus() {
  const [employees, locations] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      select: {
        id: true,
        name: true,
        email: true,
        employeeType: true,
        regionId: true,
        region: { select: { name: true, region_id: true } },
      },
      orderBy: { name: 'asc' },
    }),
    Promise.resolve(getAllEmployeeLocations()),
  ]);

  const locationByUser = new Map(locations.map((entry) => [entry.userId, entry]));

  const rows = [];
  for (const employee of employees) {
    const location = locationByUser.get(employee.id) || null;
    const storedProgress = getEmployeeRouteProgress(employee.id);
    const currentStep = storedProgress?.currentStep ?? 0;

    let progress = null;
    if (!employee.regionId) {
      progress = { needsRegionSelection: true };
    } else {
      const plan = await buildPlanForEmployee(employee.id, location);
      progress = {
        needsRegionSelection: false,
        regionName: plan.regionName,
        ...buildProgressSummary(plan, currentStep),
      };
    }

    rows.push({
      userId: employee.id,
      name: employee.name,
      email: employee.email,
      employeeType: employee.employeeType,
      regionName: employee.region?.name || progress?.regionName || null,
      needsRegionSelection: !employee.regionId,
      online: Boolean(location?.online),
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,
      updatedAt: location?.updatedAt ?? null,
      progress,
    });
  }

  return rows;
}

async function getEmployeeStatusDetail(userId) {
  const employee = await prisma.user.findFirst({
    where: { id: userId, role: 'EMPLOYEE' },
    select: {
      id: true,
      name: true,
      email: true,
      employeeType: true,
      regionId: true,
      region: { select: { id: true, name: true, region_id: true } },
    },
  });

  if (!employee) {
    return null;
  }

  const location = getEmployeeLocation(userId);
  const storedProgress = getEmployeeRouteProgress(userId);
  const currentStep = storedProgress?.currentStep ?? 0;
  const completedCount = storedProgress?.completedCount ?? 0;

  if (!employee.regionId) {
    return {
      userId: employee.id,
      name: employee.name,
      email: employee.email,
      employeeType: employee.employeeType,
      regionName: null,
      needsRegionSelection: true,
      online: Boolean(location?.online),
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,
      updatedAt: location?.updatedAt ?? null,
      progress: { needsRegionSelection: true },
      plan: null,
      nextLeg: null,
      currentStop: null,
    };
  }

  const plan = await buildPlanForEmployee(employee.id, location);
  const progress = buildProgressSummary(plan, currentStep);

  let nextLeg = null;
  let currentStop = null;
  const endpoints = getLegEndpoints(plan, currentStep);

  if (endpoints) {
    currentStop = endpoints.to.stop;
    const leg = await planRouteLeg(
      endpoints.from.lat,
      endpoints.from.lng,
      endpoints.to.lat,
      endpoints.to.lng
    );
    nextLeg = {
      ...leg,
      stepIndex: currentStep,
      from: endpoints.from,
      to: endpoints.to,
    };
  }

  return {
    userId: employee.id,
    name: employee.name,
    email: employee.email,
    employeeType: employee.employeeType,
    regionName: employee.region?.name || plan.regionName,
    regionParcelId: plan.regionParcelId,
    needsRegionSelection: false,
    online: Boolean(location?.online),
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    accuracy: location?.accuracy ?? null,
    updatedAt: location?.updatedAt ?? null,
    progress: {
      ...progress,
      completedCount,
    },
    plan: {
      regionName: plan.regionName,
      regionParcelId: plan.regionParcelId,
      start: plan.start,
      stops: plan.stops,
      summary: plan.summary,
      navigationMode: plan.navigationMode,
    },
    currentStop,
    nextLeg,
  };
}

module.exports = {
  listAllEmployeesWithStatus,
  getEmployeeStatusDetail,
  buildProgressSummary,
  countRemainingByType,
  getLegEndpoints,
};
