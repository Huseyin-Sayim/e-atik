const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  setEmployeeLocation,
  getAllEmployeeLocations,
  removeEmployee,
  resetLocationStoreForTests,
  THROTTLE_MS,
} = require('../services/locationStore');

describe('locationStore', () => {
  before(() => resetLocationStoreForTests());
  after(() => resetLocationStoreForTests());

  it('stores employee location', () => {
    const result = setEmployeeLocation('emp-1', {
      latitude: 38.461,
      longitude: 27.22,
      name: 'Test Employee',
      role: 'EMPLOYEE',
    });
    assert.equal(result.accepted, true);
    const all = getAllEmployeeLocations();
    assert.equal(all.length, 1);
    assert.equal(all[0].userId, 'emp-1');
  });

  it('throttles rapid updates', () => {
    resetLocationStoreForTests();
    setEmployeeLocation('emp-2', {
      latitude: 38.46,
      longitude: 27.21,
      role: 'EMPLOYEE',
    });
    const second = setEmployeeLocation('emp-2', {
      latitude: 38.47,
      longitude: 27.22,
      role: 'EMPLOYEE',
    });
    assert.equal(second.accepted, false);
    assert.equal(second.reason, 'throttled');
  });

  it('removes employee on disconnect', () => {
    resetLocationStoreForTests();
    setEmployeeLocation('emp-3', {
      latitude: 38.46,
      longitude: 27.21,
      role: 'EMPLOYEE',
    });
    removeEmployee('emp-3');
    assert.equal(getAllEmployeeLocations().length, 0);
  });

  it('rejects invalid coordinates', () => {
    resetLocationStoreForTests();
    const result = setEmployeeLocation('emp-4', {
      latitude: 999,
      longitude: 27.21,
      role: 'EMPLOYEE',
    });
    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'invalid_coordinates');
  });
});
