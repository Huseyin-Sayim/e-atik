const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildWasteRequestLabel } = require('../services/wasteRequestLabels');

describe('wasteRequestLabels', () => {
  it('buildWasteRequestLabel returns Turkish label', () => {
    assert.equal(buildWasteRequestLabel('PLASTIC'), 'Evsel atık — Plastik');
    assert.equal(buildWasteRequestLabel('UNKNOWN'), 'Evsel atık — UNKNOWN');
  });
});
