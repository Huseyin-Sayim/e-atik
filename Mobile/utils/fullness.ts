export function toFillPercentage(value?: number | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  if (n <= 1) {
    return Math.round(n * 100);
  }
  if (n <= 100) {
    return Math.round(n);
  }
  return 100;
}

export function applyFullnessPatch<T extends { id: string; fillPercentage: number }>(
  bins: T[],
  binId: string,
  percent: number
): T[] {
  const normalized = Math.min(100, Math.max(0, Math.round(percent)));
  let changed = false;
  const next = bins.map((bin) => {
    if (bin.id !== binId) {
      return bin;
    }
    if (bin.fillPercentage === normalized) {
      return bin;
    }
    changed = true;
    return { ...bin, fillPercentage: normalized };
  });
  return changed ? next : bins;
}

export function mergeSnapshotBins<T extends { id: string; fillPercentage: number }>(
  bins: T[],
  snapshots: Array<{ binId: string; fullnessPercent?: number; predictedFullness?: number }>
): T[] {
  if (!snapshots.length) {
    return bins;
  }

  const percentById = new Map<string, number>();
  for (const item of snapshots) {
    const percent =
      item.fullnessPercent != null
        ? toFillPercentage(item.fullnessPercent)
        : toFillPercentage(item.predictedFullness);
    percentById.set(item.binId, percent);
  }

  let changed = false;
  const next = bins.map((bin) => {
    const percent = percentById.get(bin.id);
    if (percent == null || bin.fillPercentage === percent) {
      return bin;
    }
    changed = true;
    return { ...bin, fillPercentage: percent };
  });
  return changed ? next : bins;
}
