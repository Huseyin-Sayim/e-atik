/**
 * Yol ağı üzerinden rota geometrisi (OSRM driving profile).
 * Geliştirme: https://router.project-osrm.org — production'da kendi OSRM sunucunuz önerilir.
 */

const OSRM_BASE = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const OSRM_TIMEOUT_MS = parseInt(process.env.OSRM_TIMEOUT_MS || '15000', 10);

function buildWaypointList(start, stops) {
  const waypoints = [{ lat: start.lat, lng: start.lng }];
  stops.forEach((stop) => {
    waypoints.push({ lat: stop.latitude, lng: stop.longitude });
  });
  return waypoints;
}

function straightPolyline(waypoints) {
  return waypoints.map((p) => ({ lat: p.lat, lng: p.lng }));
}

/**
 * @param {{ lat: number, lng: number }[]} waypoints Sıralı duraklar (başlangıç dahil)
 * @returns {Promise<{ polyline: {lat,lng}[], distanceKm: number|null, durationMin: number|null, onRoads: boolean, warning?: string }>}
 */
async function fetchRoadRoute(waypoints) {
  if (!waypoints.length) {
    return { polyline: [], distanceKm: 0, durationMin: 0, onRoads: false };
  }

  if (waypoints.length === 1) {
    return {
      polyline: straightPolyline(waypoints),
      distanceKm: 0,
      durationMin: 0,
      onRoads: false,
    };
  }

  const coordStr = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const url =
    `${OSRM_BASE}/route/v1/driving/${coordStr}` +
    '?overview=full&geometries=geojson&steps=false';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`OSRM yanıtı: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates) {
      throw new Error(data.message || 'Yol rotası hesaplanamadı');
    }

    const route = data.routes[0];
    const polyline = route.geometry.coordinates.map(([lng, lat]) => ({
      lat,
      lng,
    }));

    return {
      polyline,
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      durationMin: Math.round(route.duration / 60),
      onRoads: true,
    };
  } catch (err) {
    const message = err.name === 'AbortError' ? 'OSRM zaman aşımı' : err.message;
    return {
      polyline: straightPolyline(waypoints),
      distanceKm: null,
      durationMin: null,
      onRoads: false,
      warning: `Yol rotası alınamadı, düz çizgi gösteriliyor (${message})`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  OSRM_BASE,
  buildWaypointList,
  fetchRoadRoute,
  straightPolyline,
};
