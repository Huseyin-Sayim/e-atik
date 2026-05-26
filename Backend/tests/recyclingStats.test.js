const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  emptyTotals,
  formatLiters,
  aggregateFromCollectionLogs,
  WASTE_CATEGORIES,
} = require('../services/recyclingStats');

describe('recyclingStats', () => {
  it('returns zero totals for empty log list', () => {
    const totals = aggregateFromCollectionLogs([]);
    for (const key of WASTE_CATEGORIES) {
      assert.equal(totals[key], 0);
    }
  });

  it('aggregates collected liters by waste category', () => {
    const logs = [
      {
        actualFullness: 0.5,
        bin: { wasteCategory: 'PLASTIC', capacityVolume: 100 },
      },
    ];
    const totals = aggregateFromCollectionLogs(logs);
    assert.equal(totals.PLASTIC, 50);
    assert.equal(totals.GLASS, 0);
    assert.equal(totals.DOMESTIC, 0);
  });

  it('formatLiters uses Turkish locale', () => {
    assert.equal(formatLiters(0), '0 L');
    assert.equal(formatLiters(-1), '0 L');
    assert.equal(formatLiters(1250), '1.250 L');
    assert.equal(formatLiters(50.5), '50,5 L');
  });

  it('emptyTotals initializes all categories', () => {
    const totals = emptyTotals();
    assert.equal(Object.keys(totals).length, WASTE_CATEGORIES.length);
    assert.deepEqual(totals, aggregateFromCollectionLogs([]));
  });
});
