import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import fullnessSocketService, { FullnessPayload } from '../services/fullnessSocket';
import {
  applyFullnessPatch,
  mergeSnapshotBins,
  toFillPercentage,
} from '../utils/fullness';

type BinWithFill = { id: string; fillPercentage: number };

type Options<T extends BinWithFill> = {
  enabled?: boolean;
  selectedBin?: T | null;
  onSelectedBinChange?: (bin: T | null) => void;
};

function payloadToPercent(payload: FullnessPayload): number {
  if (payload.fullnessPercent != null) {
    return toFillPercentage(payload.fullnessPercent);
  }
  return toFillPercentage(payload.predictedFullness);
}

export function useBinFullnessLive<T extends BinWithFill>(
  bins: T[],
  setBins: Dispatch<SetStateAction<T[]>>,
  options: Options<T> = {}
) {
  const { enabled = true, selectedBin, onSelectedBinChange } = options;
  const selectedBinRef = useRef(selectedBin);
  const onSelectedBinChangeRef = useRef(onSelectedBinChange);

  selectedBinRef.current = selectedBin;
  onSelectedBinChangeRef.current = onSelectedBinChange;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const applyPayload = (payload: FullnessPayload) => {
      const percent = payloadToPercent(payload);
      setBins((prev) => applyFullnessPatch(prev, payload.binId, percent));

      const currentSelected = selectedBinRef.current;
      if (currentSelected?.id === payload.binId) {
        onSelectedBinChangeRef.current?.({
          ...currentSelected,
          fillPercentage: percent,
        });
      }
    };

    const unsubFullness = fullnessSocketService.subscribe(applyPayload);
    const unsubSnapshot = fullnessSocketService.subscribeSnapshot((snapshot) => {
      if (!snapshot.bins?.length) {
        return;
      }
      setBins((prev) => mergeSnapshotBins(prev, snapshot.bins));
    });

    fullnessSocketService.connect().catch(() => {});

    return () => {
      unsubFullness();
      unsubSnapshot();
    };
  }, [enabled, setBins]);
}
