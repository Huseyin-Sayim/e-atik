const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildWasteRequestLabel } = require('../services/wasteRequestLabels');

describe('wasteRequestLabels', () => {
  it('buildWasteRequestLabel returns parent and child name', () => {
    assert.equal(
      buildWasteRequestLabel({
        name: 'Atık yağ',
        parent: { name: 'Evsel atık' },
      }),
      'Evsel atık — Atık yağ'
    );
  });

  it('buildWasteRequestLabel handles missing data', () => {
    assert.equal(buildWasteRequestLabel(null), 'Atık talebi');
  });
});
