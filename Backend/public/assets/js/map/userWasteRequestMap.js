(function () {
  'use strict';

  const DEFAULT_CENTER = { lat: 38.458919, lng: 27.227533 };
  let map = null;
  let marker = null;
  let campusLayer = null;
  let selectedLat = null;
  let selectedLng = null;
  let wasteTypeTree = [];

  function coinHintForType(type) {
    if (!type) return '';
    if (type.coinRewardMode === 'PER_KG') {
      return (
        'Tahmini ödül: toplama sonrası ağırlığa göre kg başına ' +
        type.coinRewardValue +
        ' coin.'
      );
    }
    if (type.coinRewardValue > 0) {
      return 'Geri dönüşümde kazanılır: ' + type.coinRewardValue + ' coin.';
    }
    return '';
  }

  function formatTypeLabel(item, parentName) {
    return parentName ? parentName + ' — ' + item.name : item.name;
  }

  function updateCoinHint() {
    const sel = document.getElementById('wasteTypeId');
    const hint = document.getElementById('waste-coin-hint');
    if (!sel || !hint) return;
    const id = sel.value;
    let found = null;
    wasteTypeTree.forEach(function (parent) {
      (parent.children || []).forEach(function (child) {
        if (child.id === id) found = child;
      });
    });
    hint.textContent = coinHintForType(found);
  }

  async function loadWasteTypes() {
    const sel = document.getElementById('wasteTypeId');
    if (!sel) return;
    try {
      const res = await fetch('/api/waste-types');
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Atık türleri yüklenemedi');
      wasteTypeTree = body.data || [];
      const options = ['<option value="">Seçiniz</option>'];
      wasteTypeTree.forEach(function (parent) {
        if (!parent.children || !parent.children.length) return;
        options.push('<optgroup label="' + parent.name.replace(/"/g, '&quot;') + '">');
        parent.children.forEach(function (child) {
          const label = formatTypeLabel(child, null);
          const coin =
            child.coinRewardMode === 'PER_KG'
              ? child.coinRewardValue + ' coin/kg'
              : child.coinRewardValue + ' coin';
          options.push(
            '<option value="' +
              child.id +
              '">' +
              child.name +
              ' (' +
              coin +
              ')</option>'
          );
        });
        options.push('</optgroup>');
      });
      sel.innerHTML = options.join('');
      sel.disabled = false;
      sel.addEventListener('change', updateCoinHint);
    } catch (err) {
      sel.innerHTML = '<option value="">Yüklenemedi</option>';
      console.error(err);
    }
  }

  function updateCoordsDisplay() {
    const el = document.getElementById('waste-coords-display');
    if (!el) return;
    if (selectedLat == null || selectedLng == null) {
      el.textContent = 'Konum: haritadan seçin';
      return;
    }
    el.textContent =
      'Konum: ' + selectedLat.toFixed(6) + ', ' + selectedLng.toFixed(6);
  }

  function setMarker(lat, lng) {
    selectedLat = lat;
    selectedLng = lng;
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setMarker(pos.lat, pos.lng);
      });
    } else {
      marker.setLatLng([lat, lng]);
    }
    updateCoordsDisplay();
  }

  async function loadCampusBounds() {
    try {
      const res = await fetch('/api/regions/static');
      const body = await res.json();
      const parcel = body?.data;
      const geo =
        parcel?.type === 'FeatureCollection'
          ? parcel
          : parcel?.features
            ? { type: 'FeatureCollection', features: parcel.features }
            : null;
      if (!geo?.features?.length) return;

      campusLayer = L.geoJSON(geo, {
        style: { color: '#0d6efd', weight: 2, fillOpacity: 0.08, fillColor: '#0d6efd' },
      }).addTo(map);

      const bounds = campusLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24] });
      }
    } catch (err) {
      console.error('Kampüs sınırı yüklenemedi', err);
    }
  }

  function showAlert(message, variant) {
    const el = document.getElementById('waste-request-alert');
    if (!el) return;
    el.textContent = message;
    el.className = 'alert mt-3 alert-' + (variant || 'info');
    el.classList.remove('d-none');
  }

  function wasteTypeLabel(item) {
    if (!item || !item.wasteType) return '—';
    const p = item.wasteType.parent?.name;
    const n = item.wasteType.name;
    return p ? p + ' — ' + n : n;
  }

  async function loadMyRequests() {
    const list = document.getElementById('waste-request-list');
    const empty = document.getElementById('waste-request-empty');
    if (!list || !empty) return;

    try {
      const res = await fetch('/api/waste-requests/mine', { credentials: 'same-origin' });
      if (!res.ok) return;
      const items = await res.json();
      list.innerHTML = '';
      if (!items.length) {
        empty.classList.remove('d-none');
        return;
      }
      empty.classList.add('d-none');
      items.slice(0, 10).forEach((item) => {
        const li = document.createElement('li');
        li.className = 'border-bottom py-2';
        const coins =
          item.earnedCoins != null && item.earnedCoins > 0
            ? ' · ' + item.earnedCoins + ' coin'
            : '';
        li.innerHTML =
          '<strong>' +
          wasteTypeLabel(item) +
          '</strong> · ' +
          item.status +
          coins +
          '<br><span class="text-secondary">' +
          (item.addressLine || '') +
          '</span>';
        list.appendChild(li);
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    const btn = document.getElementById('waste-submit-btn');
    if (selectedLat == null || selectedLng == null) {
      showAlert('Lütfen haritadan konum seçin.', 'warning');
      return;
    }

    const wasteTypeId = document.getElementById('wasteTypeId').value;
    if (!wasteTypeId) {
      showAlert('Lütfen atık çeşidi seçin.', 'warning');
      return;
    }

    const payload = {
      wasteTypeId,
      addressLine: document.getElementById('addressLine').value.trim(),
      city: document.getElementById('city').value.trim() || null,
      district: document.getElementById('district').value.trim() || null,
      note: document.getElementById('note').value.trim() || null,
      latitude: selectedLat,
      longitude: selectedLng,
    };

    btn.disabled = true;
    try {
      const res = await fetch('/api/waste-requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Talep oluşturulamadı');
      }
      showAlert(body.message || 'Talep oluşturuldu.', 'success');
      document.getElementById('waste-request-form').reset();
      document.getElementById('waste-coin-hint').textContent = '';
      await loadMyRequests();
    } catch (err) {
      showAlert(err.message || 'Hata oluştu', 'danger');
    } finally {
      btn.disabled = false;
    }
  }

  function initMap() {
    map = L.map('waste-request-map').setView(
      [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      15
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    map.on('click', (e) => setMarker(e.latlng.lat, e.latlng.lng));
    setMarker(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
    loadCampusBounds();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadWasteTypes();
    loadMyRequests();
    document.getElementById('waste-request-form')?.addEventListener('submit', onSubmit);
    setTimeout(() => map?.invalidateSize(), 200);
  });
})();
