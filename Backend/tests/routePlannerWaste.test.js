const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildGreedyWasteRequestRoute,
  scoreWasteRequest,
  requestMatchesRegionParcel,
  mapWasteRequestToStop,
} = require('../services/routePlanner');

describe('routePlanner waste requests', () => {
  it('scoreWasteRequest prefers closer and older requests', () => {
    const near = {
      latitude: 38.459,
      longitude: 27.228,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    };
    const far = {
      latitude: 38.47,
      longitude: 27.24,
      createdAt: new Date(),
    };
    const nearScore = scoreWasteRequest(near, 38.458919, 27.227533, {
      distance: 0.75,
      age: 0.25,
    });
    const farScore = scoreWasteRequest(far, 38.458919, 27.227533, {
      distance: 0.75,
      age: 0.25,
    });
    assert.ok(nearScore > farScore);
  });

  it('buildGreedyWasteRequestRoute orders by proximity from start', () => {
    const requests = [
      {
        id: 'far',
        wasteType: 'PLASTIC',
        latitude: 38.47,
        longitude: 27.24,
        createdAt: new Date(),
        addressLine: 'Uzak',
        status: 'PENDING',
      },
      {
        id: 'near',
        wasteType: 'GLASS',
        latitude: 38.459,
        longitude: 27.228,
        createdAt: new Date(),
        addressLine: 'Yakın',
        status: 'PENDING',
      },
    ];

    const { stops } = buildGreedyWasteRequestRoute({
      startLat: 38.458919,
      startLng: 27.227533,
      requests,
      maxStops: 5,
    });

    assert.equal(stops.length, 2);
    assert.equal(stops[0].requestId, 'near');
    assert.equal(stops[0].stopType, 'waste_request');
    assert.equal(stops[1].requestId, 'far');
  });

  it('requestMatchesRegionParcel uses parcelKey when set', () => {
    const req = { parcelKey: 'kyk', latitude: 0, longitude: 0 };
    assert.equal(requestMatchesRegionParcel(req, 'kyk'), true);
    assert.equal(requestMatchesRegionParcel(req, 'akademik'), false);
  });

  it('requestMatchesRegionParcel falls back to coordinates', () => {
    const req = { parcelKey: null, latitude: 38.461, longitude: 27.22 };
    assert.equal(requestMatchesRegionParcel(req, 'akademik'), true);
    assert.equal(requestMatchesRegionParcel(req, 'kyk'), false);
  });

  it('mapWasteRequestToStop includes address fields', () => {
    const stop = mapWasteRequestToStop(
      {
        id: 'r1',
        wasteType: { name: 'Gazete / kağıt', parent: { name: 'Kağıt' } },
        latitude: 38.46,
        longitude: 27.22,
        addressLine: 'Blok 1',
        city: 'İzmir',
        district: 'Bornova',
        status: 'PENDING',
      },
      1,
      0.1
    );
    assert.equal(stop.stopType, 'waste_request');
    assert.equal(stop.addressLine, 'Blok 1');
    assert.match(stop.label, /Kağıt/);
    assert.equal(stop.wasteType, 'Gazete / kağıt');
  });
});
