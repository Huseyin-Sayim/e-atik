const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  applyEmployeeLocationUpdate,
  setEmployeeUserResolverForTests,
  resetEmployeeUserResolverForTests,
} = require('../services/employeeLocationService');
const { resetLocationStoreForTests } = require('../services/locationStore');

describe('employeeLocationService', () => {
  before(() => {
    resetLocationStoreForTests();
    setEmployeeUserResolverForTests(async () => ({
      name: 'Test Collector',
      role: 'EMPLOYEE',
    }));
  });

  after(() => {
    resetLocationStoreForTests();
    resetEmployeeUserResolverForTests();
  });

  it('accepts location inside campus with parcelKey', async () => {
    const result = await applyEmployeeLocationUpdate('emp-svc-1', {
      latitude: 38.461,
      longitude: 27.22,
      accuracy: 12,
    });
    assert.equal(result.ok, true);
    assert.equal(result.entry.parcelKey, 'akademik');
    assert.ok(result.entry.parcelLabel);
    assert.equal(result.entry.online, true);
  });

  it('rejects location outside campus', async () => {
    const result = await applyEmployeeLocationUpdate('emp-svc-2', {
      latitude: 41.0,
      longitude: 29.0,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'outside_campus');
  });

  it('rejects non-employee role', async () => {
    setEmployeeUserResolverForTests(async () => ({
      name: 'Admin User',
      role: 'ADMIN',
    }));
    const result = await applyEmployeeLocationUpdate('admin-1', {
      latitude: 38.461,
      longitude: 27.22,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unauthorized');
    setEmployeeUserResolverForTests(async () => ({
      name: 'Test Collector',
      role: 'EMPLOYEE',
    }));
  });
});
