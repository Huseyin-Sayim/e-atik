(function (global) {
  'use strict';

  const PIN_ASPECT = 32 / 52;

  const BIN_ICON_CONFIG = {
    CONTAINER_SMALL: {
      url: '/assets/images/map/bin-container-small.svg',
      label: 'Küçük konteyner',
    },
    CONTAINER_LARGE: {
      url: '/assets/images/map/bin-container-large.svg',
      label: 'Büyük konteyner',
    },
    WASTE_POINT: {
      url: '/assets/images/map/bin-waste-point.svg',
      label: 'Atık noktası',
    },
  };

  const WASTE_CATEGORY_ICON_CONFIG = {
    GENERAL: {
      url: '/assets/images/map/waste-general.svg',
      label: 'Genel atık',
    },
    DOMESTIC: {
      url: '/assets/images/map/waste-domestic.svg',
      label: 'Evsel atık',
    },
    ELECTRONIC: {
      url: '/assets/images/map/waste-electronic.svg',
      label: 'Elektronik atık',
    },
    PLASTIC: {
      url: '/assets/images/map/waste-plastic.svg',
      label: 'Plastik atık',
    },
    GLASS: {
      url: '/assets/images/map/waste-glass.svg',
      label: 'Cam atık',
    },
    PAPER: {
      url: '/assets/images/map/waste-paper.svg',
      label: 'Kağıt atık',
    },
  };

  const PIN_SHELL_BY_TYPE = {
    CONTAINER_SMALL: '/assets/images/map/pin-shell-orange.svg',
    CONTAINER_LARGE: '/assets/images/map/pin-shell-blue.svg',
    WASTE_POINT: '/assets/images/map/pin-shell-green.svg',
  };

  const DEFAULT_BIN_TYPE = 'CONTAINER_SMALL';
  const DEFAULT_WASTE_CATEGORY = 'GENERAL';
  const iconCache = new Map();

  function normalizeBinType(binType) {
    if (binType && BIN_ICON_CONFIG[binType]) return binType;
    return DEFAULT_BIN_TYPE;
  }

  function normalizeWasteCategory(wasteCategory) {
    if (wasteCategory && WASTE_CATEGORY_ICON_CONFIG[wasteCategory]) {
      return wasteCategory;
    }
    return DEFAULT_WASTE_CATEGORY;
  }

  function resolveInnerIconConfig(binType, wasteCategory) {
    const type = normalizeBinType(binType);
    if (type === 'WASTE_POINT') {
      return WASTE_CATEGORY_ICON_CONFIG[normalizeWasteCategory(wasteCategory)];
    }
    return BIN_ICON_CONFIG[type];
  }

  function getPinShellUrl(binType) {
    return PIN_SHELL_BY_TYPE[normalizeBinType(binType)];
  }

  function calcIconSize(zoom, baseZoom, baseSize) {
    const bz = baseZoom != null ? baseZoom : 15;
    const bs = baseSize != null ? baseSize : 22;
    let height = (zoom / bz) * bs * (52 / 32);
    height = Math.min(Math.max(Math.round(height), 24), 46);
    const width = Math.round(height * PIN_ASPECT);
    return { width, height };
  }

  function getBinTypeLabel(binType, wasteCategory) {
    const type = normalizeBinType(binType);
    if (type === 'WASTE_POINT') {
      return WASTE_CATEGORY_ICON_CONFIG[normalizeWasteCategory(wasteCategory)].label;
    }
    return BIN_ICON_CONFIG[type].label;
  }

  function getWasteCategoryLabel(wasteCategory) {
    return WASTE_CATEGORY_ICON_CONFIG[normalizeWasteCategory(wasteCategory)].label;
  }

  function getBinIconUrl(binType, wasteCategory) {
    return resolveInnerIconConfig(binType, wasteCategory).url;
  }

  function buildPinMarkerHtml(binType, wasteCategory, width, height) {
    const type = normalizeBinType(binType);
    const inner = resolveInnerIconConfig(binType, wasteCategory);
    const shell = getPinShellUrl(type);

    return (
      '<div class="map-pin-marker map-pin-marker--' +
      type +
      '" style="width:' +
      width +
      'px;height:' +
      height +
      'px">' +
      '<img class="map-pin-marker__shell" src="' +
      shell +
      '" alt="" draggable="false">' +
      '<img class="map-pin-marker__glyph" src="' +
      inner.url +
      '" alt="" draggable="false">' +
      '</div>'
    );
  }

  function getBinIcon(binType, zoom, options) {
    if (typeof global.L === 'undefined') {
      throw new Error('Leaflet (L) must be loaded before getBinIcon');
    }

    const opts = options || {};
    const wasteCategory = opts.wasteCategory;
    const baseZoom = opts.baseZoom != null ? opts.baseZoom : 15;
    const baseSize = opts.baseSize != null ? opts.baseSize : 22;
    const type = normalizeBinType(binType);
    const category =
      type === 'WASTE_POINT' ? normalizeWasteCategory(wasteCategory) : '';
    const { width, height } = calcIconSize(zoom, baseZoom, baseSize);
    const cacheKey = 'pin:' + type + ':' + category + ':' + width + 'x' + height;

    if (iconCache.has(cacheKey)) {
      return iconCache.get(cacheKey);
    }

    const icon = global.L.divIcon({
      html: buildPinMarkerHtml(binType, wasteCategory, width, height),
      className: 'map-pin-marker-host',
      iconSize: [width, height],
      iconAnchor: [width / 2, height],
      popupAnchor: [0, -height],
    });

    iconCache.set(cacheKey, icon);
    return icon;
  }

  function getBinIconTypes() {
    return Object.keys(BIN_ICON_CONFIG);
  }

  function getWasteCategoryTypes() {
    return Object.keys(WASTE_CATEGORY_ICON_CONFIG);
  }

  function buildLegendPinItem(binType, wasteCategory, label) {
    const w = 16;
    const h = Math.round(w / PIN_ASPECT);

    return (
      '<span class="map-bin-legend__item">' +
      '<span class="map-bin-legend__pin">' +
      buildPinMarkerHtml(binType, wasteCategory, w, h) +
      '</span>' +
      '<span>' +
      label +
      '</span></span>'
    );
  }

  function renderMapLegendHtml() {
    const containerItems = ['CONTAINER_SMALL', 'CONTAINER_LARGE']
      .map((type) =>
        buildLegendPinItem(type, null, BIN_ICON_CONFIG[type].label)
      )
      .join('');

    const wasteItems = getWasteCategoryTypes()
      .map((cat) =>
        buildLegendPinItem(
          'WASTE_POINT',
          cat,
          WASTE_CATEGORY_ICON_CONFIG[cat].label
        )
      )
      .join('');

    return (
      '<span class="map-bin-legend__group"><strong class="me-2">Konteynerler:</strong>' +
      containerItems +
      '</span>' +
      '<span class="map-bin-legend__group"><strong class="me-2">Atık noktaları:</strong>' +
      wasteItems +
      '</span>'
    );
  }

  function buildLandingLegendItem(binType, wasteCategory, label) {
    const w = 14;
    const h = Math.round(w / PIN_ASPECT);

    return (
      '<li class="landing-legend__item">' +
      '<span class="landing-legend__pin">' +
      buildPinMarkerHtml(binType, wasteCategory, w, h) +
      '</span>' +
      '<span class="landing-legend__label">' +
      label +
      '</span></li>'
    );
  }

  function renderLandingMapLegendHtml() {
    const containerRows = ['CONTAINER_SMALL', 'CONTAINER_LARGE']
      .map((type) =>
        buildLandingLegendItem(type, null, BIN_ICON_CONFIG[type].label)
      )
      .join('');

    const wasteRows = getWasteCategoryTypes()
      .map((cat) =>
        buildLandingLegendItem(
          'WASTE_POINT',
          cat,
          WASTE_CATEGORY_ICON_CONFIG[cat].label
        )
      )
      .join('');

    return (
      '<div class="landing-legend">' +
      '<div class="landing-legend__block">' +
      '<p class="landing-legend__heading">Konteynerler</p>' +
      '<ul class="landing-legend__list">' +
      containerRows +
      '</ul></div>' +
      '<div class="landing-legend__block">' +
      '<p class="landing-legend__heading">Atık noktaları</p>' +
      '<ul class="landing-legend__list landing-legend__list--waste">' +
      wasteRows +
      '</ul></div></div>'
    );
  }

  global.PIN_SHELL_BY_TYPE = PIN_SHELL_BY_TYPE;
  global.BIN_ICON_CONFIG = BIN_ICON_CONFIG;
  global.WASTE_CATEGORY_ICON_CONFIG = WASTE_CATEGORY_ICON_CONFIG;
  global.normalizeBinType = normalizeBinType;
  global.normalizeWasteCategory = normalizeWasteCategory;
  global.calcIconSize = calcIconSize;
  global.getBinTypeLabel = getBinTypeLabel;
  global.getWasteCategoryLabel = getWasteCategoryLabel;
  global.getBinIconUrl = getBinIconUrl;
  global.getBinIcon = getBinIcon;
  global.getBinIconTypes = getBinIconTypes;
  global.getWasteCategoryTypes = getWasteCategoryTypes;
  global.buildPinMarkerHtml = buildPinMarkerHtml;
  global.renderMapLegendHtml = renderMapLegendHtml;
  global.renderLandingMapLegendHtml = renderLandingMapLegendHtml;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
