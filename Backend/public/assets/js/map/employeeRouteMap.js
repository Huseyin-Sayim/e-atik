(function () {
  'use strict';

  let map = null;
  let routeLayer = null;
  let markersLayer = null;
  let regionLayer = null;
  let plan = null;
  let currentStep = 0;
  let completedCount = 0;
  let legCache = new Map();
  let legLoading = false;
  let renewalBannerVisible = false;

  const PROGRESS_KEY = 'employeeRouteProgress';

  function fullnessToColor(fullnessPercent) {
    const t = Math.max(0, Math.min(100, fullnessPercent ?? 0)) / 100;
    const r = Math.round(13 + (220 - 13) * t);
    const g = Math.round(110 + (53 - 110) * t);
    const b = Math.round(253 + (69 - 253) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function orderIcon(order, fullnessPercent, options) {
    const opts = options || {};
    const opacity = opts.dimmed ? 0.45 : 1;
    const size = opts.active ? 30 : 26;
    const bg = opts.completed ? '#6c757d' : fullnessToColor(fullnessPercent);
    const content = opts.completed ? '✓' : String(order);
    const anchor = size / 2;

    return L.divIcon({
      className: 'route-order-marker',
      html:
        '<div style="opacity:' +
        opacity +
        ';background:' +
        bg +
        ';color:#fff;width:' +
        size +
        'px;height:' +
        size +
        'px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:' +
        (opts.completed ? '14px' : '12px') +
        ';font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">' +
        content +
        '</div>',
      iconSize: [size, size],
      iconAnchor: [anchor, anchor],
    });
  }

  function startIcon() {
    return L.divIcon({
      className: 'route-start-marker',
      html:
        '<div style="background:#0dcaf0;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">B</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  function progressStorageKey() {
    if (!plan?.regionParcelId) return PROGRESS_KEY;
    return PROGRESS_KEY + ':' + plan.regionParcelId;
  }

  function loadProgress() {
    try {
      const raw = sessionStorage.getItem(progressStorageKey());
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.currentStep === 'number' && data.currentStep >= 0) {
        currentStep = data.currentStep;
      }
      if (typeof data.completedCount === 'number') {
        completedCount = data.completedCount;
      }
    } catch (e) {
      /* ignore */
    }
  }

  function saveProgress() {
    try {
      sessionStorage.setItem(
        progressStorageKey(),
        JSON.stringify({ currentStep, completedCount })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function clearProgress() {
    currentStep = 0;
    completedCount = 0;
    try {
      sessionStorage.removeItem(progressStorageKey());
    } catch (e) {
      /* ignore */
    }
  }

  function isRouteComplete() {
    return plan && currentStep >= (plan.stops?.length || 0);
  }

  function getLegEndpoints(stepIndex) {
    const stops = plan.stops;
    if (stepIndex >= stops.length) return null;

    const toStop = stops[stepIndex];
    let from;

    if (stepIndex === 0) {
      from = {
        lat: plan.start.lat,
        lng: plan.start.lng,
        label: 'Başlangıç',
      };
    } else {
      const prev = stops[stepIndex - 1];
      from = {
        lat: prev.latitude,
        lng: prev.longitude,
        label: prev.order + '. ' + prev.label,
      };
    }

    return {
      from,
      to: {
        lat: toStop.latitude,
        lng: toStop.longitude,
        label: toStop.order + '. ' + toStop.label,
        stop: toStop,
      },
    };
  }

  function legCacheKey(from, to) {
    return from.lat + ',' + from.lng + '->' + to.lat + ',' + to.lng;
  }

  async function fetchLeg(from, to) {
    const key = legCacheKey(from, to);
    if (legCache.has(key)) return legCache.get(key);

    const params = new URLSearchParams({
      fromLat: String(from.lat),
      fromLng: String(from.lng),
      toLat: String(to.lat),
      toLng: String(to.lng),
    });

    const res = await fetch('/api/employee/route-leg?' + params.toString(), {
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error('Yol tarifi alınamadı');
    const leg = await res.json();
    legCache.set(key, leg);
    return leg;
  }

  function clearMapLayers() {
    if (routeLayer) {
      map.removeLayer(routeLayer);
      routeLayer = null;
    }
    if (markersLayer) {
      map.removeLayer(markersLayer);
      markersLayer = null;
    }
  }

  function setBanner(html, variant) {
    const el = document.getElementById('route-step-banner');
    if (!el) return;
    el.innerHTML = html;
    el.className = 'route-step-banner alert mb-3 alert-' + (variant || 'primary');
    el.classList.remove('d-none');
  }

  function hideBanner() {
    document.getElementById('route-step-banner')?.classList.add('d-none');
  }

  function renderStepBanner(leg, endpoints) {
    if (renewalBannerVisible) {
      setBanner(
        '<strong>Bütün rota tamamlandı.</strong> Yeni rota oluşturuldu; sağdaki doluluk oranlarını kontrol ediniz.',
        'success'
      );
      return;
    }

    const stop = endpoints.to.stop;
    const dist =
      leg?.distanceKm != null
        ? leg.distanceKm + ' km' + (leg.onRoads ? ' (yol)' : '')
        : stop.distanceFromPrevKm + ' km (kuş uçuşu)';
    const dur =
      leg?.durationMin != null && leg.onRoads ? ' · ~' + leg.durationMin + ' dk' : '';
    const warn = leg?.warning
      ? '<p class="small mb-0 mt-2 text-warning">' + leg.warning + '</p>'
      : '';

    setBanner(
      '<strong>Adım ' +
        stop.order +
        ' / ' +
        plan.stops.length +
        '</strong> — ' +
        endpoints.from.label +
        ' → <span class="text-nowrap">' +
        endpoints.to.label +
        '</span><br>' +
        '<span class="small">' +
        dist +
        dur +
        '</span>' +
        warn,
      'primary'
    );
  }

  function renderSummary() {
    const s = plan.summary || {};
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('route-region-name', plan.regionName || '—');
    set(
      'route-start-coords',
      plan.start ? plan.start.lat.toFixed(6) + ', ' + plan.start.lng.toFixed(6) : '—'
    );
    set('route-stop-count', String(s.stopCount ?? 0));
    set('route-total-km', (s.totalDistanceKm ?? 0) + ' km (tahmini)');
    set('route-avg-fullness', (s.avgFullnessPercent ?? 0) + '%');

    const driveWrap = document.getElementById('route-drive-time-wrap');
    if (driveWrap) driveWrap.classList.add('d-none');

    const warnEl = document.getElementById('route-road-warning');
    if (warnEl) {
      warnEl.textContent = '';
      warnEl.classList.add('d-none');
    }

    const progressEl = document.getElementById('route-progress-text');
    if (progressEl) {
      if (renewalBannerVisible) {
        progressEl.textContent = 'Yeni rota · ' + (plan.stops?.length || 0) + ' durak';
      } else {
        progressEl.textContent =
          'Durak ' + (currentStep + 1) + ' / ' + (plan.stops?.length || 0);
      }
    }
  }

  function renderStopList() {
    const list = document.getElementById('route-stop-list');
    const empty = document.getElementById('route-empty-list');
    const stops = plan.stops || [];
    if (!list || !empty) return;

    list.innerHTML = '';
    if (!stops.length) {
      empty.classList.remove('d-none');
      return;
    }
    empty.classList.add('d-none');

    stops.forEach((stop, index) => {
      const li = document.createElement('li');
      let state = 'pending';
      if (index < currentStep) state = 'completed';
      else if (index === currentStep && !isRouteComplete()) state = 'active';

      li.className = 'route-stop-item route-stop-item--' + state;
      li.dataset.stepIndex = String(index);

      const badgeColor =
        state === 'completed' ? '#6c757d' : fullnessToColor(stop.fullnessPercent);

      let actions = '';
      if (state === 'active') {
        actions =
          '<button type="button" class="btn btn-success btn-sm mt-2 route-collect-btn" data-bin-id="' +
          stop.binId +
          '">Toplandı — sonraki durağa</button>';
      }

      li.innerHTML =
        '<div class="route-stop-item__row">' +
        '<span class="route-order-badge" style="background:' +
        badgeColor +
        '">' +
        (state === 'completed' ? '✓' : stop.order) +
        '</span>' +
        '<div class="route-stop-item__body">' +
        '<strong>' +
        stop.label +
        '</strong>' +
        '<span class="text-secondary small d-block">%' +
        stop.fullnessPercent +
        ' dolu' +
        (state !== 'active' ? ' · ' + stop.distanceFromPrevKm + ' km' : '') +
        '</span>' +
        actions +
        '</div></div>';

      list.appendChild(li);
    });

    list.querySelectorAll('.route-collect-btn').forEach((btn) => {
      btn.addEventListener('click', () => onCollectClick(btn));
    });
  }

  async function fetchRoutePlan() {
    const res = await fetch('/api/employee/route-plan', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Rota alınamadı');
    return res.json();
  }

  async function finalizeRouteAndReload() {
    clearProgress();
    legCache.clear();
    completedCount = 0;
    renewalBannerVisible = true;

    const loadingEl = document.getElementById('route-leg-loading');
    const loadingDefaultText = 'Yol tarifi hesaplanıyor…';
    if (loadingEl) {
      loadingEl.textContent = 'Yeni rota oluşturuluyor…';
      loadingEl.classList.remove('d-none');
    }

    try {
      const newPlan = await fetchRoutePlan();
      if (newPlan.needsRegionSelection) {
        renewalBannerVisible = false;
        showRegionAlert();
        return;
      }

      plan = newPlan;
      currentStep = 0;

      if (!plan.stops?.length || plan.summary?.noCollectionNeeded) {
        renewalBannerVisible = true;
        renderSummary();
        renderStopList();
        clearMapLayers();
        setBanner(
          '<strong>Bütün rota tamamlandı.</strong> Yeni rota oluşturuldu; sağdaki doluluk oranlarını kontrol ediniz. ' +
            'Şu an toplama gerektiren kova bulunmuyor.',
          'success'
        );
        return;
      }

      await refreshStepView();
    } catch (err) {
      console.error(err);
      renewalBannerVisible = false;
      setBanner('Yeni rota yüklenemedi. Lütfen sayfayı yenileyin.', 'warning');
    } finally {
      if (loadingEl) {
        loadingEl.textContent = loadingDefaultText;
        loadingEl.classList.add('d-none');
      }
    }
  }

  async function onCollectClick(btn) {
    if (legLoading) return;

    renewalBannerVisible = false;

    const binId = btn.dataset.binId;
    const stop = plan.stops[currentStep];
    if (!stop || stop.binId !== binId) return;

    btn.disabled = true;
    const prevText = btn.textContent;
    btn.textContent = 'Kaydediliyor…';

    try {
      const res = await fetch('/api/bins/' + encodeURIComponent(binId) + '/collect', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Toplama kaydı oluşturulamadı');
      }
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = prevText;
      alert(err.message || 'Toplama kaydedilemedi. Yine de devam etmek ister misiniz?');
      if (!window.confirm('Toplama kaydı oluşmadı. Sonraki durağa yine de geçilsin mi?')) {
        return;
      }
    }

    completedCount += 1;
    currentStep += 1;

    if (isRouteComplete()) {
      await finalizeRouteAndReload();
      return;
    }

    saveProgress();
    await refreshStepView();
  }

  async function loadRegionHighlight(parcelId) {
    if (!parcelId || !map || regionLayer) return;
    try {
      const res = await fetch('/api/regions/static/' + encodeURIComponent(parcelId));
      const result = await res.json();
      const feature = result.data;
      if (!feature || !feature.geometry) return;

      regionLayer = L.geoJSON(feature, {
        style: { color: '#00a76f', weight: 2, fillOpacity: 0.15, fillColor: '#00a76f' },
      }).addTo(map);
    } catch (err) {
      console.error('Bölge poligonu yüklenemedi:', err);
    }
  }

  function ensureMap() {
    if (map) return;
    map = L.map('route-map').setView([plan.start.lat, plan.start.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    loadRegionHighlight(plan.regionParcelId);
  }

  function renderMapMarkers(endpoints) {
    clearMapLayers();
    markersLayer = L.layerGroup().addTo(map);

    const from = endpoints.from;
    const to = endpoints.to;

    if (currentStep === 0) {
      L.marker([plan.start.lat, plan.start.lng], { icon: startIcon() })
        .bindPopup('<strong>Başlangıç</strong>')
        .addTo(markersLayer);
    } else {
      const prevStop = plan.stops[currentStep - 1];
      L.marker([from.lat, from.lng], {
        icon: orderIcon(prevStop.order, prevStop.fullnessPercent, { completed: true }),
      })
        .bindPopup('<strong>Önceki durak</strong><br>' + from.label)
        .addTo(markersLayer);
    }

    L.marker([to.lat, to.lng], {
      icon: orderIcon(endpoints.to.stop.order, endpoints.to.stop.fullnessPercent, {
        active: true,
      }),
    })
      .bindPopup(
        '<strong>Hedef: ' +
          endpoints.to.stop.order +
          '. ' +
          endpoints.to.stop.label +
          '</strong><br>%' +
          endpoints.to.stop.fullnessPercent +
          ' dolu'
      )
      .addTo(markersLayer);
  }

  function drawLegPolyline(leg, endpoints) {
    if (!leg?.polyline || leg.polyline.length < 2) {
      const pts = [
        [endpoints.from.lat, endpoints.from.lng],
        [endpoints.to.lat, endpoints.to.lng],
      ];
      routeLayer = L.polyline(pts, { color: '#dc3545', weight: 4, opacity: 0.85 }).addTo(map);
      map.fitBounds(pts, { padding: [48, 48], maxZoom: 17 });
      return;
    }

    const latlngs = leg.polyline.map((p) => [p.lat, p.lng]);
    routeLayer = L.polyline(latlngs, { color: '#dc3545', weight: 5, opacity: 0.9 }).addTo(map);
    map.fitBounds(latlngs, { padding: [48, 48], maxZoom: 17 });
  }

  async function refreshStepView() {
    if (!plan || !map) return;

    renderSummary();
    renderStopList();

    const endpoints = getLegEndpoints(currentStep);
    if (!endpoints) return;

    const loadingEl = document.getElementById('route-leg-loading');
    if (loadingEl) loadingEl.classList.remove('d-none');

    legLoading = true;
    let leg = null;
    try {
      leg = await fetchLeg(endpoints.from, endpoints.to);
    } catch (err) {
      console.error(err);
      leg = {
        polyline: [
          { lat: endpoints.from.lat, lng: endpoints.from.lng },
          { lat: endpoints.to.lat, lng: endpoints.to.lng },
        ],
        distanceKm: endpoints.to.stop.distanceFromPrevKm,
        warning: 'Yol tarifi yüklenemedi.',
      };
    } finally {
      legLoading = false;
      if (loadingEl) loadingEl.classList.add('d-none');
    }

    renderMapMarkers(endpoints);
    drawLegPolyline(leg, endpoints);
    renderStepBanner(leg, endpoints);

    const nextEndpoints = getLegEndpoints(currentStep + 1);
    if (nextEndpoints) {
      fetchLeg(nextEndpoints.from, nextEndpoints.to).catch(() => {});
    }
  }

  function applyFullnessUpdate(payload) {
    if (!plan?.stops?.length || !payload?.binId) return;

    const stop = plan.stops.find((s) => s.binId === payload.binId);
    if (!stop) return;

    stop.predictedFullness = payload.predictedFullness;
    stop.fullnessPercent = payload.fullnessPercent;
    stop.isCritical = payload.isCritical;

    renderStopList();
    if (!isRouteComplete() && plan.stops[currentStep]?.binId === payload.binId) {
      refreshStepView().catch(console.error);
    }

    if (payload.isCritical && !renewalBannerVisible) {
      const warn = document.getElementById('route-road-warning');
      if (warn) {
        warn.textContent =
          payload.label + ' %' + payload.fullnessPercent + ' doluluğa ulaştı. Rota listesini kontrol edin.';
        warn.classList.remove('d-none');
      }
    }
  }

  function initFullnessSocket() {
    if (!globalThis.EAtikSocket) return;
    EAtikSocket.onFullnessUpdated(applyFullnessUpdate);
    EAtikSocket.onFullnessIncreased(applyFullnessUpdate);
  }

  async function showPlan(loadedPlan) {
    plan = loadedPlan;
    loadProgress();
    if (plan.stops?.length && currentStep >= plan.stops.length) {
      clearProgress();
      currentStep = 0;
    }

    document.getElementById('route-loading')?.classList.add('d-none');
    document.getElementById('route-region-alert')?.classList.add('d-none');
    document.getElementById('route-content')?.classList.remove('d-none');

    ensureMap();
    renderSummary();
    renderStopList();

    if (!plan.stops?.length || plan.summary?.noCollectionNeeded) {
      clearMapLayers();
      setBanner(
        'Bölgede şu an toplama gerektiren kova yok. Doluluk oranları arttıkça yeni rota oluşturulacaktır.',
        'info'
      );
    } else {
      await refreshStepView();
    }

    initFullnessSocket();

    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 150);
  }

  function showRegionAlert() {
    document.getElementById('route-loading')?.classList.add('d-none');
    document.getElementById('route-content')?.classList.add('d-none');
    document.getElementById('route-region-alert')?.classList.remove('d-none');
  }

  async function loadRoutePlan() {
    try {
      const res = await fetch('/api/employee/route-plan', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Rota alınamadı');
      const loadedPlan = await res.json();
      if (loadedPlan.needsRegionSelection) {
        showRegionAlert();
        return;
      }
      await showPlan(loadedPlan);
    } catch (err) {
      console.error(err);
      const loading = document.getElementById('route-loading');
      if (loading) {
        loading.innerHTML =
          '<p class="text-danger mb-0">Rota yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</p>';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', loadRoutePlan);
})();
