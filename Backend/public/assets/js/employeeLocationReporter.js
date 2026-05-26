(function () {
  'use strict';

  const MIN_INTERVAL_MS = 15000;
  const MIN_MOVE_M = 20;

  let socket = null;
  let watchId = null;
  let lastSent = { lat: null, lng: null, time: 0 };

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function shouldSend(lat, lng) {
    const now = Date.now();
    if (now - lastSent.time < MIN_INTERVAL_MS) return false;
    if (lastSent.lat == null) return true;
    return haversineM(lastSent.lat, lastSent.lng, lat, lng) >= MIN_MOVE_M;
  }

  function sendPosition(position) {
    if (!socket?.connected) return;
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    if (!shouldSend(lat, lng)) return;

    socket.emit('location:update', {
      latitude: lat,
      longitude: lng,
      accuracy: position.coords.accuracy,
    });
    lastSent = { lat, lng, time: Date.now() };
  }

  function startWatching() {
    if (!navigator.geolocation || watchId != null) return;
    watchId = navigator.geolocation.watchPosition(sendPosition, (err) => {
      console.warn('[employeeLocationReporter]', err.message || err.code);
    }, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000,
    });
  }

  function stopWatching() {
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  function init() {
    const token = getCookie('accessToken');
    if (!token || typeof globalThis.io !== 'function') return;

    socket = globalThis.io({ auth: { token } });
    socket.on('connect', startWatching);
    socket.on('location:error', (payload) => {
      console.warn('[employeeLocationReporter]', payload?.message);
    });

    window.addEventListener('beforeunload', () => {
      stopWatching();
      socket?.disconnect();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
