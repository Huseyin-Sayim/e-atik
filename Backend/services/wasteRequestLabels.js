function buildWasteRequestLabel(wasteType) {
  if (!wasteType) return 'Atık talebi';
  if (typeof wasteType === 'object') {
    const parent = wasteType.parent?.name;
    const child = wasteType.name;
    if (parent && child) return `${parent} — ${child}`;
    return child || parent || 'Atık talebi';
  }
  return String(wasteType);
}

module.exports = {
  buildWasteRequestLabel,
};
