const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getHoursToFull,
  calculatePredictedFullness,
  getLastEmptiedAt,
  enrichBinWithFullness,
} = require('../services/binFullness');

const baseBin = {
  type: 'CONTAINER_SMALL',
  capacityVolume: 100,
  createdAt: new Date('2025-01-01T00:00:00Z'),
};

describe('binFullness', () => {
  it('100L container fills in 24 hours', () => {
    assert.equal(getHoursToFull('CONTAINER_SMALL', 100), 24);
    assert.equal(getHoursToFull('CONTAINER_LARGE', 200), 48);
  });

  it('100L waste point fills in 48 hours', () => {
    assert.equal(getHoursToFull('WASTE_POINT', 100), 48);
    assert.equal(getHoursToFull('WASTE_POINT', 50), 24);
  });

  it('returns 0 fullness at last emptied time', () => {
    const now = new Date('2025-01-02T12:00:00Z');
    const last = new Date('2025-01-02T12:00:00Z');
    assert.equal(calculatePredictedFullness(baseBin, last, now), 0);
  });

  it('returns ~1 after full fill duration', () => {
    const last = new Date('2025-01-01T00:00:00Z');
    const now = new Date('2025-01-02T00:00:00Z');
    const fullness = calculatePredictedFullness(baseBin, last, now);
    assert.ok(fullness >= 0.99 && fullness <= 1);
  });

  it('uses createdAt when no collection log', () => {
    const last = getLastEmptiedAt(baseBin, null);
    assert.equal(last.toISOString(), baseBin.createdAt.toISOString());
  });

  it('clamps fullness to 1 when overdue', () => {
    const last = new Date('2020-01-01T00:00:00Z');
    const now = new Date('2025-01-01T00:00:00Z');
    assert.equal(calculatePredictedFullness(baseBin, last, now), 1);
  });

  it('enrichBinWithFullness adds metadata fields', () => {
    const now = new Date('2025-01-01T12:00:00Z');
    const enriched = enrichBinWithFullness(
      { ...baseBin, id: 'x', predictedFullness: 0 },
      baseBin.createdAt,
      now
    );
    assert.equal(enriched.hoursToFull, 24);
    assert.equal(enriched.predictedFullness, 0.5);
    assert.ok(enriched.lastEmptiedAt);
  });
});
