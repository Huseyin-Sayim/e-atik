const WASTE_TYPE_LABELS = {
  DOMESTIC: 'Evsel',
  ELECTRONIC: 'Elektronik',
  PLASTIC: 'Plastik',
  GLASS: 'Cam',
  PAPER: 'Kağıt',
  GENERAL: 'Genel',
};

function buildWasteRequestLabel(wasteType) {
  const label = WASTE_TYPE_LABELS[wasteType] || wasteType;
  return `Evsel atık — ${label}`;
}

module.exports = {
  WASTE_TYPE_LABELS,
  buildWasteRequestLabel,
};
