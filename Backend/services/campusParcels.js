const fs = require('fs');
const path = require('path');
const { booleanPointInPolygon } = require('@turf/boolean-point-in-polygon');
const { point } = require('@turf/helpers');

let cachedCollection = null;

function loadCollection() {
  if (cachedCollection) return cachedCollection;
  const filePath = path.join(__dirname, '..', 'public', 'data', 'geojson', 'kampusParsel.geojson');
  const raw = fs.readFileSync(filePath, 'utf8');
  cachedCollection = JSON.parse(raw);
  return cachedCollection;
}

function featureParcelKey(feature) {
  if (feature.id !== undefined && feature.id !== null) return String(feature.id);
  if (feature.properties?.id != null) return String(feature.properties.id);
  return null;
}

function getParcelFeature(parcelKey) {
  const coll = loadCollection();
  return coll.features.find((f) => featureParcelKey(f) === String(parcelKey));
}

function listParcelKeys() {
  const coll = loadCollection();
  return coll.features.map(featureParcelKey).filter(Boolean);
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {string} parcelKey GeoJSON feature id (örn. akademik, hastane, kyk)
 */
function assertPointInParcel(lat, lng, parcelKey) {
  const feature = getParcelFeature(parcelKey);
  if (!feature) {
    return { ok: false, message: 'Geçersiz parsel anahtarı.' };
  }
  const pt = point([lng, lat]);
  if (!booleanPointInPolygon(pt, feature)) {
    return { ok: false, message: 'Konum seçilen parselin dışında.' };
  }
  return { ok: true };
}

module.exports = {
  loadCollection,
  getParcelFeature,
  listParcelKeys,
  assertPointInParcel,
  featureParcelKey,
};
