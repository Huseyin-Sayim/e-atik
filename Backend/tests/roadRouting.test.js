const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildWaypointList, straightPolyline } = require('../services/roadRouting');

describe('roadRouting', () => {
  it('buildWaypointList orders start then stops', () => {
    const start = { lat: 38.45, lng: 27.22 };
    const stops = [
      { latitude: 38.46, longitude: 27.23 },
      { latitude: 38.47, longitude: 27.24 },
    ];
    const waypoints = buildWaypointList(start, stops);
    assert.equal(waypoints.length, 3);
    assert.deepEqual(waypoints[0], start);
    assert.equal(waypoints[1].lat, 38.46);
    assert.equal(waypoints[2].lng, 27.24);
  });

  it('straightPolyline mirrors waypoint coordinates', () => {
    const waypoints = [
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
    ];
    assert.deepEqual(straightPolyline(waypoints), waypoints);
  });
});
