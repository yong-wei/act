import { describe, expect, it } from 'vitest';

import {
  buildPerCardSubmissionAnswers,
  mergeSavedAnswersIntoDraft,
} from '@/features/interactive/shared/per-card-response-utils';

describe('per-card response utils', () => {
  it('persists only saved answers plus the active card draft', () => {
    expect(
      buildPerCardSubmissionAnswers({
        savedAnswers: {
          savedA: 'already submitted',
        },
        currentDraft: {
          savedA: 'local overwrite should not leak',
          target: 'submit this one',
          unsavedOther: 'keep local only',
        },
        targetKey: 'target',
      }),
    ).toEqual({
      savedA: 'already submitted',
      target: 'submit this one',
    });
  });

  it('hydrates saved answers without clearing other local drafts', () => {
    expect(
      mergeSavedAnswersIntoDraft({
        savedAnswers: {
          savedA: 'submitted value',
        },
        currentDraft: {
          savedA: 'stale local value',
          unsavedOther: 'keep this draft',
        },
        keys: ['savedA', 'unsavedOther', 'newEmpty'],
      }),
    ).toEqual({
      savedA: 'submitted value',
      unsavedOther: 'keep this draft',
      newEmpty: '',
    });
  });
});
