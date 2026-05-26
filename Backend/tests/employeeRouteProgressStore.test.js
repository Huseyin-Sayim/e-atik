const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  setEmployeeRouteProgress,
  getEmployeeRouteProgress,
  resetEmployeeRouteProgressForTests,
} = require('../services/employeeRouteProgressStore');

describe('employeeRouteProgressStore', () => {
  before(() => resetEmployeeRouteProgressForTests());
  after(() => resetEmployeeRouteProgressForTests());

  it('stores route progress for employee', () => {
    const result = setEmployeeRouteProgress('emp-1', {
      currentStep: 2,
      completedCount: 2,
      regionParcelId: 'akademik',
    });
    assert.equal(result.ok, true);
    const stored = getEmployeeRouteProgress('emp-1');
    assert.equal(stored.currentStep, 2);
    assert.equal(stored.completedCount, 2);
    assert.equal(stored.regionParcelId, 'akademik');
  });

  it('rejects invalid currentStep', () => {
    const result = setEmployeeRouteProgress('emp-2', { currentStep: -1 });
    assert.equal(result.ok, false);
  });
});
