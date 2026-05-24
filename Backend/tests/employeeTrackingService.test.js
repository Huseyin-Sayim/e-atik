const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildProgressSummary,
  countRemainingByType,
} = require('../services/employeeTrackingService');

describe('employeeTrackingService helpers', () => {
  it('buildProgressSummary counts remaining stops by type', () => {
    const plan = {
      stops: [
        { type: 'CONTAINER_SMALL', fullnessPercent: 50 },
        { type: 'CONTAINER_LARGE', fullnessPercent: 60 },
        { type: 'WASTE_POINT', fullnessPercent: 80 },
        { type: 'WASTE_POINT', fullnessPercent: 40 },
      ],
      summary: { noCollectionNeeded: false },
    };

    const summary = buildProgressSummary(plan, 1);
    assert.equal(summary.totalStops, 4);
    assert.equal(summary.remainingStops, 3);
    assert.equal(summary.remainingContainers, 1);
    assert.equal(summary.remainingWastePoints, 2);
    assert.equal(summary.currentStep, 1);
  });

  it('countRemainingByType aggregates correctly', () => {
    const counts = countRemainingByType([
      { type: 'CONTAINER_SMALL' },
      { type: 'WASTE_POINT' },
    ]);
    assert.equal(counts.remainingContainers, 1);
    assert.equal(counts.remainingWastePoints, 1);
    assert.equal(counts.remainingWasteRequests, 0);
  });

  it('countRemainingByType includes waste_request stops', () => {
    const counts = countRemainingByType([
      { stopType: 'waste_request' },
      { stopType: 'waste_request' },
      { type: 'CONTAINER_SMALL' },
    ]);
    assert.equal(counts.remainingWasteRequests, 2);
    assert.equal(counts.remainingContainers, 1);
  });
});
