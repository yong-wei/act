// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  capturePreparationEditorReturnState,
  restorePreparationEditorReturnState,
} from '../preparation-document-editor/return-state';

describe('preparation editor return state', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/teacher/smart-prep?taskId=task-1');
    window.sessionStorage.clear();
    document.body.innerHTML = `
      <details id="smart-prep-stage-lesson-generation" open></details>
      <details id="smart-prep-stage-courseware-generation"></details>
    `;
  });

  it('restores the originating accordion expansion and exact scroll position', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 428 });
    capturePreparationEditorReturnState('/teacher/smart-prep?taskId=task-1#smart-prep-stage-lesson-generation');
    const lesson = document.querySelector<HTMLDetailsElement>('#smart-prep-stage-lesson-generation')!;
    const courseware = document.querySelector<HTMLDetailsElement>('#smart-prep-stage-courseware-generation')!;
    lesson.open = false;
    courseware.open = true;
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    restorePreparationEditorReturnState();

    expect(lesson.open).toBe(true);
    expect(courseware.open).toBe(false);
    expect(scrollTo).toHaveBeenCalledWith({ top: 428 });
    expect(window.sessionStorage.getItem('preparation-editor:return-state')).toBeNull();
  });
});
