(function (global) {
  'use strict';

  let socket = null;
  const handlers = {
    increased: [],
    updated: [],
    snapshot: [],
  };

  function getAccessToken() {
    const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function emitHandlers(list, payload) {
    list.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('[socketClient] handler error', err);
      }
    });
  }

  function connectFullnessSocket() {
    if (socket?.connected) return socket;
    if (typeof global.io === 'undefined') {
      console.warn('[socketClient] Socket.io client not loaded');
      return null;
    }

    const token = getAccessToken();
    if (!token) return null;

    socket = global.io({ auth: { token } });

    socket.on('bin:fullness:increased', (payload) => {
      emitHandlers(handlers.increased, payload);
      emitHandlers(handlers.updated, payload);
    });

    socket.on('bin:fullness:updated', (payload) => {
      emitHandlers(handlers.updated, payload);
    });

    socket.on('bin:fullness:snapshot', (payload) => {
      emitHandlers(handlers.snapshot, payload);
    });

    return socket;
  }

  function onFullnessIncreased(fn) {
    handlers.increased.push(fn);
    connectFullnessSocket();
  }

  function onFullnessUpdated(fn) {
    handlers.updated.push(fn);
    connectFullnessSocket();
  }

  function onFullnessSnapshot(fn) {
    handlers.snapshot.push(fn);
    connectFullnessSocket();
  }

  global.EAtikSocket = {
    connectFullnessSocket,
    onFullnessIncreased,
    onFullnessUpdated,
    onFullnessSnapshot,
    getAccessToken,
  };
})(typeof window !== 'undefined' ? window : globalThis);
