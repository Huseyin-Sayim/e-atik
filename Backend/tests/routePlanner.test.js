const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  haversineKm,
  scoreBin,
  selectRouteCandidates,
  buildGreedyRoute,
  buildSummary,
  DEFAULT_WEIGHTS,
  ROUTE_MIN_FULLNESS,
} = require('../services/routePlanner');

describe('routePlanner', () => {
  it('haversineKm returns ~0 for same point', () => {
    const d = haversineKm(38.458919, 27.227533, 38.458919, 27.227533);
    assert.ok(d < 0.001);
  });

  it('haversineKm returns positive distance for distinct points', () => {
    const d = haversineKm(38.458919, 27.227533, 38.46, 27.23);
    assert.ok(d > 0);
    assert.ok(d < 2);
  });

  it('scoreBin prefers higher fullness when distance is equal', () => {
    const current = { lat: 38.45, lng: 27.22 };
    const nearFull = {
      latitude: 38.451,
      longitude: 27.221,
      predictedFullness: 0.9,
    };
    const nearEmpty = {
      latitude: 38.451,
      longitude: 27.221,
      predictedFullness: 0.55,
    };
    const sFull = scoreBin(nearFull, current.lat, current.lng, DEFAULT_WEIGHTS);
    const sEmpty = scoreBin(nearEmpty, current.lat, current.lng, DEFAULT_WEIGHTS);
    assert.ok(sFull > sEmpty);
  });

  it('buildGreedyRoute visits higher fullness bin first when colocated candidates differ', () => {
    const startLat = 38.458919;
    const startLng = 27.227533;
    const bins = [
      {
        id: 'a',
        type: 'CONTAINER_SMALL',
        wasteCategory: 'GENERAL',
        latitude: 38.4595,
        longitude: 27.228,
        predictedFullness: 0.55,
      },
      {
        id: 'b',
        type: 'CONTAINER_SMALL',
        wasteCategory: 'GENERAL',
        latitude: 38.4596,
        longitude: 27.2281,
        predictedFullness: 0.92,
      },
    ];

    const { stops } = buildGreedyRoute({
      startLat,
      startLng,
      bins,
      minFullness: 0,
      maxStops: 10,
    });

    assert.equal(stops.length, 2);
    assert.equal(stops[0].binId, 'b');
    assert.equal(stops[0].order, 1);
    assert.equal(stops[1].binId, 'a');
  });

  it('buildGreedyRoute respects maxStops', () => {
    const bins = [
      { id: '1', type: 'CONTAINER_SMALL', wasteCategory: 'GENERAL', latitude: 38.46, longitude: 27.23, predictedFullness: 0.9 },
      { id: '2', type: 'CONTAINER_SMALL', wasteCategory: 'GENERAL', latitude: 38.461, longitude: 27.231, predictedFullness: 0.85 },
      { id: '3', type: 'CONTAINER_SMALL', wasteCategory: 'GENERAL', latitude: 38.462, longitude: 27.232, predictedFullness: 0.8 },
    ];

    const { stops } = buildGreedyRoute({
      startLat: 38.458919,
      startLng: 27.227533,
      bins,
      maxStops: 2,
    });

    assert.equal(stops.length, 2);
  });

  it('buildSummary computes averages', () => {
    const summary = buildSummary(
      [
        { fullnessPercent: 80, isCritical: true },
        { fullnessPercent: 60, isCritical: false },
      ],
      1.5
    );
    assert.equal(summary.stopCount, 2);
    assert.equal(summary.totalDistanceKm, 1.5);
    assert.equal(summary.avgFullnessPercent, 70);
    assert.equal(summary.criticalCount, 1);
  });

  it('selectRouteCandidates returns empty when all bins below relative min', () => {
    const bins = [
      { id: '1', predictedFullness: 0 },
      { id: '2', predictedFullness: 0.01 },
    ];
    const { candidates, selectionMode } = selectRouteCandidates(bins, {
      routeMinFullness: 0.05,
      relativeMin: 0.02,
    });
    assert.equal(candidates.length, 0);
    assert.equal(selectionMode, 'none');
  });

  it('selectRouteCandidates uses threshold when any bin meets ROUTE_MIN', () => {
    const bins = [
      { id: 'low', predictedFullness: 0.02 },
      { id: 'ok', predictedFullness: 0.1 },
    ];
    const { candidates, selectionMode } = selectRouteCandidates(bins, {
      routeMinFullness: ROUTE_MIN_FULLNESS,
      relativeMin: 0.02,
    });
    assert.equal(selectionMode, 'threshold');
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].id, 'ok');
  });

  it('selectRouteCandidates falls back to relative top N', () => {
    const bins = [
      { id: 'a', predictedFullness: 0.03 },
      { id: 'b', predictedFullness: 0.04 },
      { id: 'c', predictedFullness: 0.01 },
    ];
    const { candidates, selectionMode } = selectRouteCandidates(bins, {
      routeMinFullness: 0.05,
      relativeTopN: 2,
      relativeMin: 0.02,
    });
    assert.equal(selectionMode, 'relative_top_n');
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].id, 'b');
    assert.equal(candidates[1].id, 'a');
  });

  it('buildSummary includes road routing fields from extras', () => {
    const summary = buildSummary(
      [{ fullnessPercent: 50, isCritical: false }],
      3.2,
      { onRoads: true, estimatedDriveMin: 12, routeWarning: null }
    );
    assert.equal(summary.onRoads, true);
    assert.equal(summary.estimatedDriveMin, 12);
  });
});
