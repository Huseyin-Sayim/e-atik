const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const { io: Client } = require('socket.io-client');

process.env.ACCESS_SECRET_KEY =
  process.env.ACCESS_SECRET_KEY || 'test-access-secret-socket';

const { Server } = require('socket.io');
const { socketAuth } = require('../socket/middleware/auth');
const { attachEmployeeTracking } = require('../socket/handlers/employeeTracking');
const {
  setEmployeeUserResolverForTests,
  resetEmployeeUserResolverForTests,
} = require('../services/employeeLocationService');
const { resetLocationStoreForTests } = require('../services/locationStore');

function signToken(userId, role) {
  return jwt.sign({ userId, role }, process.env.ACCESS_SECRET_KEY, {
    expiresIn: '1h',
  });
}

function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);

    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('employeeTracking socket', () => {
  let server;
  let port;
  let employeeSocket;
  let adminSocket;

  before(async () => {
    resetLocationStoreForTests();
    setEmployeeUserResolverForTests(async () => ({
      name: 'Socket Test Employee',
      role: 'EMPLOYEE',
    }));

    server = http.createServer();
    const io = new Server(server, {
      cors: { origin: '*' },
    });
    socketAuth(io);
    attachEmployeeTracking(io);

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (employeeSocket) employeeSocket.close();
    if (adminSocket) adminSocket.close();
    resetLocationStoreForTests();
    resetEmployeeUserResolverForTests();
    await new Promise((resolve) => server.close(resolve));
  });

  it('ADMIN receives snapshot and live update from EMPLOYEE', async () => {
    const baseUrl = `http://127.0.0.1:${port}`;
    const adminToken = signToken('admin-socket-1', 'ADMIN');
    const employeeToken = signToken('emp-socket-1', 'EMPLOYEE');

    adminSocket = Client(baseUrl, {
      auth: { token: adminToken },
      transports: ['websocket'],
      autoConnect: false,
    });

    const snapshotPromise = waitForEvent(adminSocket, 'location:employees:snapshot');
    adminSocket.connect();

    await new Promise((resolve, reject) => {
      adminSocket.on('connect', resolve);
      adminSocket.on('connect_error', reject);
    });

    employeeSocket = Client(baseUrl, {
      auth: { token: employeeToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      employeeSocket.on('connect', resolve);
      employeeSocket.on('connect_error', reject);
    });

    const snapshot = await snapshotPromise;
    assert.ok(Array.isArray(snapshot.employees));

    const updatePromise = waitForEvent(adminSocket, 'location:employee:update');

    const ack = await new Promise((resolve, reject) => {
      employeeSocket.emit(
        'location:update',
        { latitude: 38.461, longitude: 27.22, accuracy: 8 },
        (response) => {
          if (!response?.ok) reject(new Error(JSON.stringify(response)));
          else resolve(response);
        }
      );
    });

    assert.equal(ack.ok, true);

    const update = await updatePromise;
    assert.equal(update.userId, 'emp-socket-1');
    assert.equal(update.latitude, 38.461);
    assert.equal(update.parcelKey, 'akademik');
    assert.ok(update.parcelLabel);
  });

  it('EMPLOYEE receives location:error for outside campus', async () => {
    const baseUrl = `http://127.0.0.1:${port}`;
    const employeeToken = signToken('emp-socket-2', 'EMPLOYEE');

    const socket = Client(baseUrl, {
      auth: { token: employeeToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
    });

    const errorPromise = waitForEvent(socket, 'location:error');

    socket.emit('location:update', { latitude: 41.0, longitude: 29.0 });

    const errPayload = await errorPromise;
    assert.ok(errPayload.message);

    socket.close();
  });

  it('throttles rapid location:update', async () => {
    const baseUrl = `http://127.0.0.1:${port}`;
    const employeeToken = signToken('emp-socket-3', 'EMPLOYEE');

    const socket = Client(baseUrl, {
      auth: { token: employeeToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
    });

    const firstAck = await new Promise((resolve) => {
      socket.emit(
        'location:update',
        { latitude: 38.461, longitude: 27.22 },
        resolve
      );
    });
    assert.equal(firstAck.ok, true);

    const secondAck = await new Promise((resolve) => {
      socket.emit(
        'location:update',
        { latitude: 38.462, longitude: 27.221 },
        resolve
      );
    });
    assert.equal(secondAck.ok, false);
    assert.equal(secondAck.reason, 'throttled');

    socket.close();
  });
});
