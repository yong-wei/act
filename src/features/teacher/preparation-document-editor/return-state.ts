'use client';

const RETURN_STATE_KEY = 'preparation-editor:return-state';

export type PreparationEditorReturnState = {
  returnUrl: string;
  scrollY: number;
  expandedStageIds: string[];
};

export function capturePreparationEditorReturnState(returnUrl: string) {
  const state: PreparationEditorReturnState = {
    returnUrl,
    scrollY: window.scrollY,
    expandedStageIds: [...window.document.querySelectorAll<HTMLDetailsElement>('details[id^="smart-prep-stage-"]')]
      .filter((details) => details.open)
      .map((details) => details.id),
  };
  window.sessionStorage.setItem(RETURN_STATE_KEY, JSON.stringify(state));
}

export function returnToPreparationEditorOrigin(fallback: string) {
  const state = readPreparationEditorReturnState();
  window.location.assign(state?.returnUrl ?? fallback);
}

export function clearPreparationEditorReturnState() {
  window.sessionStorage.removeItem(RETURN_STATE_KEY);
}

export function readPreparationEditorReturnState(): PreparationEditorReturnState | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(RETURN_STATE_KEY) ?? 'null');
    if (!value || typeof value.returnUrl !== 'string' || typeof value.scrollY !== 'number') return null;
    if (!Array.isArray(value.expandedStageIds) || !value.expandedStageIds.every((id: unknown) => typeof id === 'string')) return null;
    if (!value.returnUrl.startsWith('/teacher/smart-prep')) return null;
    return value;
  } catch {
    return null;
  }
}
