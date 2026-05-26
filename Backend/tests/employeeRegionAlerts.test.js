const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  FULLNESS_ALERT_THRESHOLD,
  buildBinLabel,
  filterAndSortAlerts,
} = require('../services/employeeRegionAlerts');

describe('employeeRegionAlerts', () => {
  it('buildBinLabel for waste point includes category', () => {
    const label = buildBinLabel('WASTE_POINT', 'PLASTIC');
    assert.match(label, /Atık noktası/);
    assert.match(label, /Plastik/);
  });

  it('buildBinLabel for container uses type only', () => {
    assert.equal(buildBinLabel('CONTAINER_SMALL', 'GENERAL'), 'Küçük konteyner');
  });

  it('filterAndSortAlerts keeps only bins at or above threshold', () => {
    const bins = [
      { id: 'a', type: 'CONTAINER_SMALL', wasteCategory: 'GENERAL', predictedFullness: 0.5, latitude: 1, longitude: 2 },
      { id: 'b', type: 'CONTAINER_LARGE', wasteCategory: 'GENERAL', predictedFullness: 0.85, latitude: 1, longitude: 2 },
      { id: 'c', type: 'WASTE_POINT', wasteCategory: 'GLASS', predictedFullness: 0.95, latitude: 1, longitude: 2 },
    ];

    const alerts = filterAndSortAlerts(bins, FULLNESS_ALERT_THRESHOLD);
    assert.equal(alerts.length, 2);
    assert.equal(alerts[0].id, 'c');
    assert.equal(alerts[0].fullnessPercent, 95);
    assert.equal(alerts[1].id, 'b');
    assert.equal(alerts[1].fullnessPercent, 85);
  });

  it('filterAndSortAlerts returns empty when none qualify', () => {
    const bins = [
      { id: 'a', type: 'CONTAINER_SMALL', wasteCategory: 'GENERAL', predictedFullness: 0.2, latitude: 0, longitude: 0 },
    ];
    assert.equal(filterAndSortAlerts(bins).length, 0);
  });
});
