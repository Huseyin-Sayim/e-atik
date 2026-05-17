const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  findParcelKeyForPoint,
  assertPointInCampus,
  assertPointInParcel,
  listParcelKeys,
} = require('../services/campusParcels');

describe('campusParcels', () => {
  it('lists campus parcel keys', () => {
    const keys = listParcelKeys();
    assert.ok(keys.length >= 1);
    assert.ok(keys.includes('akademik'));
  });

  it('findParcelKeyForPoint returns parcel inside akademik', () => {
    const key = findParcelKeyForPoint(38.461, 27.22);
    assert.ok(key);
    assert.equal(assertPointInParcel(38.461, 27.22, key).ok, true);
  });

  it('assertPointInCampus rejects point outside campus', () => {
    const result = assertPointInCampus(41.0, 29.0);
    assert.equal(result.ok, false);
  });

  it('assertPointInCampus accepts point inside campus', () => {
    const key = findParcelKeyForPoint(38.461, 27.22);
    assert.ok(key);
    const result = assertPointInCampus(38.461, 27.22);
    assert.equal(result.ok, true);
    assert.equal(result.parcelKey, key);
  });
});
