(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const mapEl = document.getElementById('landing-map');
    if (!mapEl || typeof L === 'undefined' || typeof getBinIcon !== 'function') {
      return;
    }

    const map = L.map('landing-map', {
      scrollWheelZoom: false,
      dragging: true,
      zoomControl: true,
      attributionControl: true,
    }).setView([38.459, 27.228], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const binLayerGroup = L.layerGroup().addTo(map);
    let campusLayer = null;
    const MAP_ICON_OPTS = { baseZoom: 15, baseSize: 18 };

    function markerIconOptions(bin) {
      return { ...MAP_ICON_OPTS, wasteCategory: bin.wasteCategory };
    }

    function binFullnessRatio(value) {
      const v = Number(value ?? 0);
      if (!Number.isFinite(v) || v <= 0) return 0;
      return v > 1 ? Math.min(1, v / 100) : Math.min(1, v);
    }

    function bindBinPopup(marker, bin) {
      const ratio = binFullnessRatio(bin.predictedFullness);
      const fullnessPct = Math.round(ratio * 100);
      const barClass = ratio > 0.8 ? 'bg-danger' : 'bg-success';
      marker.bindPopup(
        '<div class="text-center" style="min-width: 140px;">' +
          '<h6 class="mb-1 fs-6">' +
          getBinTypeLabel(bin.type, bin.wasteCategory) +
          '</h6>' +
          '<p class="small text-secondary mb-2 mb-0">' +
          (bin.type === 'WASTE_POINT'
            ? getWasteCategoryLabel(bin.wasteCategory)
            : '') +
          '</p>' +
          '<div class="progress mb-1" style="height: 6px;">' +
          '<div class="progress-bar ' +
          barClass +
          '" style="width: ' +
          fullnessPct +
          '%"></div>' +
          '</div>' +
          '<small>%' +
          fullnessPct +
          ' dolu</small>' +
          '</div>'
      );
    }

    async function loadCampusAreas() {
      try {
        const response = await fetch('/api/regions/static');
        const result = await response.json();
        const geojsonData = result.features ? result : result.data;

        if (!geojsonData) return;

        campusLayer = L.geoJSON(geojsonData, {
          style: { color: '#ff7800', weight: 2, fillOpacity: 0.12 },
        }).addTo(map);
      } catch (err) {
        console.error('Kampüs sınırları yüklenemedi:', err);
      }
    }

    async function loadBins() {
      try {
        const response = await fetch('/api/bins');
        if (!response.ok) throw new Error('bins fetch failed');
        const bins = await response.json();
        const currentZoom = map.getZoom();

        binLayerGroup.clearLayers();

        bins.forEach(function (bin) {
          const marker = L.marker([bin.latitude, bin.longitude], {
            icon: getBinIcon(bin.type, currentZoom, markerIconOptions(bin)),
          });

          marker.binType = bin.type;
          marker.binWasteCategory = bin.wasteCategory;
          bindBinPopup(marker, bin);
          marker.addTo(binLayerGroup);
        });
      } catch (err) {
        console.error('Kovalar yüklenemedi:', err);
      }
    }

    function fitMapView() {
      if (campusLayer) {
        map.fitBounds(campusLayer.getBounds(), { padding: [16, 16], maxZoom: 16 });
        return;
      }
      if (binLayerGroup.getLayers().length > 0) {
        map.fitBounds(binLayerGroup.getBounds(), { padding: [24, 24], maxZoom: 16 });
      }
    }

    map.on('zoomend', function () {
      const currentZoom = map.getZoom();
      binLayerGroup.eachLayer(function (layer) {
        if (layer instanceof L.Marker && layer.binType) {
          layer.setIcon(
            getBinIcon(layer.binType, currentZoom, {
              ...MAP_ICON_OPTS,
              wasteCategory: layer.binWasteCategory,
            })
          );
        }
      });
    });

    const legendEl = document.getElementById('landing-map-legend');
    if (legendEl && typeof renderLandingMapLegendHtml === 'function') {
      legendEl.innerHTML = renderLandingMapLegendHtml();
    }

    Promise.all([loadCampusAreas(), loadBins()]).then(function () {
      fitMapView();
      setTimeout(function () {
        map.invalidateSize();
        fitMapView();
      }, 150);
    });
  });
})();
