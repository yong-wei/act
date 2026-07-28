// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPreparationEditorReturnState,
  capturePreparationEditorReturnState,
  readPreparationEditorReturnState,
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

  it('retains the originating accordion and scroll state until React completes restoration', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 428 });
    capturePreparationEditorReturnState('/teacher/smart-prep?taskId=task-1#smart-prep-stage-lesson-generation');

    expect(readPreparationEditorReturnState()).toEqual({
      returnUrl: '/teacher/smart-prep?taskId=task-1#smart-prep-stage-lesson-generation',
      scrollY: 428,
      expandedStageIds: ['smart-prep-stage-lesson-generation'],
    });
    expect(window.sessionStorage.getItem('preparation-editor:return-state')).not.toBeNull();

    clearPreparationEditorReturnState();
    expect(window.sessionStorage.getItem('preparation-editor:return-state')).toBeNull();
  });
});
