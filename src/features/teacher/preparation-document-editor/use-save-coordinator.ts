'use client';

import { useRef } from 'react';

export function usePreparationSaveCoordinator() {
  const generationRef = useRef(0);
  const inFlightRef = useRef(false);
  const coordinatorRef = useRef({
    restore(hasLocalDraft: boolean) {
      generationRef.current = hasLocalDraft ? 1 : 0;
      inFlightRef.current = false;
    },
    markEdited() {
      generationRef.current += 1;
      return inFlightRef.current;
    },
    beginSave() {
      if (inFlightRef.current) return null;
      inFlightRef.current = true;
      return generationRef.current;
    },
    finishSave(generation: number) {
      inFlightRef.current = false;
      return generationRef.current === generation;
    },
  });
  return coordinatorRef.current;
}
