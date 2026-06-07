const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldEmitIncrease,
  buildPayload,
  emitToRooms,
  EMIT_DELTA,
  PUBLIC_FULLNESS_ROOM,
  ADMIN_ROOM,
} = require('../services/binFullnessBroadcast');
const { FULLNESS_ALERT_THRESHOLD } = require('../services/employeeRegionAlerts');

describe('binFullnessBroadcast', () => {
  it('shouldEmitIncrease when delta exceeded', () => {
    assert.equal(shouldEmitIncrease(0.1, 0.1 + EMIT_DELTA + 0.001), true);
    assert.equal(shouldEmitIncrease(0.1, 0.1 + EMIT_DELTA * 0.5), false);
  });

  it('shouldEmitIncrease when crossing alert threshold', () => {
    assert.equal(
      shouldEmitIncrease(FULLNESS_ALERT_THRESHOLD - 0.05, FULLNESS_ALERT_THRESHOLD),
      true
    );
  });

  it('should not emit on first observation without previous', () => {
    assert.equal(shouldEmitIncrease(null, 0.5), false);
  });

  it('buildPayload includes label and isCritical', () => {
    const payload = buildPayload(
      {
        id: 'bin-1',
        regionId: 'reg-1',
        type: 'CONTAINER_SMALL',
        wasteCategory: 'GENERAL',
        latitude: 38.45,
        longitude: 27.22,
      },
      0.85,
      0.7
    );
    assert.equal(payload.binId, 'bin-1');
    assert.equal(payload.fullnessPercent, 85);
    assert.equal(payload.isCritical, true);
    assert.equal(payload.previousFullness, 0.7);
    assert.ok(payload.label);
  });

  it('emitToRooms emits to region, admin and public rooms', () => {
    const emitted = [];
    const io = {
      to(room) {
        return {
          emit(event, payload) {
            emitted.push({ room, event, payload });
          },
        };
      },
    };

    emitToRooms(io, 'reg-1', 'bin:fullness:updated', { binId: 'bin-1' });

    assert.equal(emitted.length, 3);
    assert.deepEqual(
      emitted.map((entry) => entry.room),
      ['region:reg-1', ADMIN_ROOM, PUBLIC_FULLNESS_ROOM]
    );
  });
});
