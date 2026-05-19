(function () {
  'use strict';

  let map = null;
  let campusLayer = null;
  let routeLayer = null;
  let targetMarker = null;
  let socket = null;
  let employees = [];
  let selectedUserId = null;
  const employeeMarkers = new Map();

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setSocketBadge(text, variant) {
    const el = document.getElementById('statusSocketBadge');
    if (!el) return;
    el.textContent = text;
    el.className = 'badge bg-' + (variant || 'secondary');
  }

  function updateOnlineCount() {
    const online = employees.filter((e) => e.online).length;
    const el = document.getElementById('statusOnlineCount');
    if (el) {
      el.textContent = online + ' çevrimiçi / ' + employees.length + ' çalışan';
    }
  }

  function progressLabel(emp) {
    if (emp.needsRegionSelection) return 'Bölge atanmadı';
    const p = emp.progress;
    if (!p || p.needsRegionSelection) return 'Bölge atanmadı';
    if (p.noCollectionNeeded && p.totalStops === 0) return 'Toplama gerekmiyor';
    const current = p.currentStep + 1;
    return current + ' / ' + p.totalStops + ' durak';
  }

  function mergeEmployeeUpdate(partial) {
    const idx = employees.findIndex((e) => e.userId === partial.userId);
    if (idx === -1) {
      employees.push(partial);
      return;
    }
    employees[idx] = {
      ...employees[idx],
      ...partial,
      progress: employees[idx].progress,
    };
    if (partial.latitude != null) {
      employees[idx].online = true;
      employees[idx].latitude = partial.latitude;
      employees[idx].longitude = partial.longitude;
      employees[idx].updatedAt = partial.updatedAt;
    }
  }

  function upsertMarker(emp, options) {
    if (!map || emp.latitude == null || emp.longitude == null) return;

    const dimmed = options?.dimmed;
    const isSelected = emp.userId === selectedUserId;
    const opacity = dimmed && !isSelected ? 0.35 : 1;

    const parcelLine = emp.parcelLabel
      ? '<br><small>' + emp.parcelLabel + '</small>'
      : emp.parcelKey
        ? '<br><small>Parsel: ' + emp.parcelKey + '</small>'
        : '';

    const popupHtml =
      '<strong>' +
      (emp.name || 'Çalışan') +
      '</strong><br>' +
      progressLabel(emp) +
      parcelLine +
      '<br><small>' +
      (emp.updatedAt || '') +
      '</small>';

    if (employeeMarkers.has(emp.userId)) {
      const marker = employeeMarkers.get(emp.userId);
      marker.setLatLng([emp.latitude, emp.longitude]);
      marker.setPopupContent(popupHtml);
      marker.setOpacity(opacity);
    } else {
      const marker = L.marker([emp.latitude, emp.longitude], { opacity }).addTo(map);
      marker.bindPopup(popupHtml);
      marker.on('click', () => selectEmployee(emp.userId));
      employeeMarkers.set(emp.userId, marker);
    }
  }

  function refreshAllMarkers() {
    const hasSelection = Boolean(selectedUserId);
    for (const emp of employees) {
      if (emp.latitude != null && emp.longitude != null) {
        upsertMarker(emp, { dimmed: hasSelection });
      }
    }
    for (const [userId, marker] of employeeMarkers.entries()) {
      const emp = employees.find((e) => e.userId === userId);
      if (!emp || emp.latitude == null) {
        map.removeLayer(marker);
        employeeMarkers.delete(userId);
      }
    }
  }

  function renderEmployeeList() {
    const listEl = document.getElementById('employee-list');
    const loadingEl = document.getElementById('employee-list-loading');
    if (!listEl) return;

    listEl.innerHTML = '';
    employees.forEach((emp) => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      if (emp.userId === selectedUserId) li.classList.add('active');
      li.dataset.userId = emp.userId;

      const onlineBadge = emp.online
        ? '<span class="badge bg-success-subtle text-success-emphasis">Çevrimiçi</span>'
        : '<span class="badge bg-secondary-subtle text-secondary">Çevrimdışı</span>';

      li.innerHTML =
        '<div class="d-flex justify-content-between align-items-start gap-2">' +
        '<div><div class="fw-semibold">' +
        (emp.name || 'Çalışan') +
        '</div>' +
        '<div class="small text-secondary">' +
        (emp.regionName || 'Bölge yok') +
        ' · ' +
        progressLabel(emp) +
        '</div></div>' +
        onlineBadge +
        '</div>';

      li.addEventListener('click', () => selectEmployee(emp.userId));
      listEl.appendChild(li);
    });

    if (loadingEl) loadingEl.classList.add('d-none');
    listEl.classList.remove('d-none');
    updateOnlineCount();
  }

  function clearRouteLayers() {
    if (routeLayer && map) {
      map.removeLayer(routeLayer);
      routeLayer = null;
    }
    if (targetMarker && map) {
      map.removeLayer(targetMarker);
      targetMarker = null;
    }
  }

  function drawNextLeg(detail) {
    clearRouteLayers();
    if (!map || !detail?.nextLeg) return;

    const leg = detail.nextLeg;
    const latlngs = (leg.polyline || []).map((p) => [p.lat, p.lng]);

    if (latlngs.length >= 2) {
      routeLayer = L.polyline(latlngs, { color: '#dc3545', weight: 5, opacity: 0.9 }).addTo(map);
      map.fitBounds(latlngs, { padding: [48, 48], maxZoom: 17 });
    }

    const stop = detail.currentStop;
    if (stop?.latitude != null) {
      targetMarker = L.circleMarker([stop.latitude, stop.longitude], {
        radius: 10,
        color: '#fff',
        weight: 2,
        fillColor: '#dc3545',
        fillOpacity: 0.95,
      })
        .bindPopup('<strong>Hedef:</strong> ' + (stop.label || ''))
        .addTo(map);
    }
  }

  function fillDetailPanel(detail) {
    const panel = document.getElementById('status-detail-panel');
    if (!panel) return;
    panel.classList.remove('d-none');

    document.getElementById('detail-employee-name').textContent = detail.name || '—';
    document.getElementById('detail-employee-meta').textContent =
      (detail.regionName || 'Bölge atanmadı') + (detail.email ? ' · ' + detail.email : '');

    const badge = document.getElementById('detail-online-badge');
    if (detail.online) {
      badge.textContent = 'Çevrimiçi';
      badge.className = 'badge bg-success';
    } else {
      badge.textContent = 'Çevrimdışı';
      badge.className = 'badge bg-secondary';
    }

    const regionWarn = document.getElementById('detail-region-warning');
    const stats = document.getElementById('detail-stats');

    if (detail.needsRegionSelection) {
      regionWarn?.classList.remove('d-none');
      stats?.classList.add('d-none');
      document.getElementById('detail-next-stop').textContent = '—';
      document.getElementById('detail-last-location').textContent = detail.updatedAt || '—';
      return;
    }

    regionWarn?.classList.add('d-none');
    stats?.classList.remove('d-none');

    const p = detail.progress || {};
    document.getElementById('detail-progress').textContent =
      p.totalStops > 0 ? p.currentStep + 1 + ' / ' + p.totalStops : '0 / 0';
    document.getElementById('detail-remaining-stops').textContent = String(p.remainingStops ?? 0);
    document.getElementById('detail-remaining-containers').textContent = String(
      p.remainingContainers ?? 0
    );
    document.getElementById('detail-remaining-waste').textContent = String(
      p.remainingWastePoints ?? 0
    );

    if (detail.currentStop) {
      document.getElementById('detail-next-stop').textContent =
        detail.currentStop.order +
        '. ' +
        detail.currentStop.label +
        ' (%' +
        detail.currentStop.fullnessPercent +
        ' dolu)';
    } else if (p.noCollectionNeeded) {
      document.getElementById('detail-next-stop').textContent = 'Toplama gerektiren kova yok';
    } else {
      document.getElementById('detail-next-stop').textContent = 'Rota tamamlandı';
    }

    document.getElementById('detail-last-location').textContent = detail.updatedAt
      ? new Date(detail.updatedAt).toLocaleString('tr-TR')
      : 'Konum yok';
  }

  function clearSelection() {
    selectedUserId = null;
    clearRouteLayers();
    document.getElementById('status-detail-panel')?.classList.add('d-none');
    renderEmployeeList();
    refreshAllMarkers();
  }

  async function selectEmployee(userId) {
    selectedUserId = userId;
    renderEmployeeList();
    refreshAllMarkers();

    try {
      const res = await fetch('/api/tracking/employees/' + encodeURIComponent(userId), {
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Detay alınamadı');
      const body = await res.json();
      const detail = body.data;
      fillDetailPanel(detail);
      drawNextLeg(detail);

      const idx = employees.findIndex((e) => e.userId === userId);
      if (idx !== -1) {
        employees[idx] = {
          ...employees[idx],
          ...detail,
          progress: detail.progress,
        };
        if (detail.latitude != null) upsertMarker(employees[idx]);
      }
    } catch (err) {
      console.error(err);
      alert('Çalışan detayı yüklenemedi.');
    }
  }

  async function loadEmployees() {
    const res = await fetch('/api/tracking/employees', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Liste alınamadı');
    const body = await res.json();
    employees = body.data || [];
    renderEmployeeList();
    refreshAllMarkers();
  }

  function handleLocationSnapshot(snapshotList) {
    (snapshotList || []).forEach((loc) => {
      mergeEmployeeUpdate({
        userId: loc.userId,
        name: loc.name,
        online: true,
        latitude: loc.latitude,
        longitude: loc.longitude,
        updatedAt: loc.updatedAt,
      });
      upsertMarker({
        userId: loc.userId,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        updatedAt: loc.updatedAt,
        progress: employees.find((e) => e.userId === loc.userId)?.progress,
        needsRegionSelection: employees.find((e) => e.userId === loc.userId)?.needsRegionSelection,
      });
    });
    renderEmployeeList();
    updateOnlineCount();
  }

  function initMap() {
    map = L.map('status-map').setView([38.459, 27.228], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    fetch('/api/regions/static')
      .then((res) => res.json())
      .then((result) => {
        const geojsonData = result.features ? result : result.data;
        if (!geojsonData) return;
        campusLayer = L.geoJSON(geojsonData, {
          style: { color: '#ff7800', weight: 2, fillOpacity: 0.08 },
        }).addTo(map);
        if (campusLayer.getBounds().isValid()) {
          map.fitBounds(campusLayer.getBounds(), { padding: [30, 30] });
        }
      })
      .catch((err) => console.error('Kampüs sınırları yüklenemedi', err));
  }

  function initSocket() {
    const token = getCookie('accessToken');
    if (!token) {
      setSocketBadge('Giriş gerekli', 'danger');
      return;
    }

    socket = globalThis.io({ auth: { token } });

    socket.on('connect', () => {
      setSocketBadge('Canlı bağlantı', 'success');
      loadEmployees().catch(console.error);
    });

    socket.on('disconnect', () => {
      setSocketBadge('Bağlantı koptu', 'warning');
    });

    socket.on('connect_error', () => {
      setSocketBadge('Bağlantı hatası', 'danger');
      loadEmployees().catch(console.error);
    });

    socket.on('location:employees:snapshot', (payload) => {
      handleLocationSnapshot(payload.employees);
    });

    socket.on('location:employee:update', (emp) => {
      mergeEmployeeUpdate({
        userId: emp.userId,
        name: emp.name,
        online: true,
        latitude: emp.latitude,
        longitude: emp.longitude,
        updatedAt: emp.updatedAt,
      });
      const full = employees.find((e) => e.userId === emp.userId);
      upsertMarker(full || emp, { dimmed: Boolean(selectedUserId) });
      renderEmployeeList();
      updateOnlineCount();
      if (selectedUserId === emp.userId) {
        selectEmployee(emp.userId).catch(console.error);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initSocket();

    document.getElementById('detail-clear-selection')?.addEventListener('click', clearSelection);

    loadEmployees().catch((err) => {
      console.error(err);
      const loadingEl = document.getElementById('employee-list-loading');
      if (loadingEl) loadingEl.textContent = 'Çalışan listesi yüklenemedi.';
    });
  });
})();
