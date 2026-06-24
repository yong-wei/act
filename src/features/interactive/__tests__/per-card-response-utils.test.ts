import { describe, expect, it } from 'vitest';

import {
  buildStepActivityIdentity,
  buildPerCardSubmissionAnswers,
  mergeSavedAnswersIntoDraft,
  mergeSavedAnswersIntoTouchedDraft,
  resolveStudentCardDraftEnvelope,
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

  it('preserves touched draft answers when saved responses are refreshed for the same cards', () => {
    expect(
      mergeSavedAnswersIntoTouchedDraft({
        savedAnswers: {
          savedA: 'server value',
          savedB: 'server untouched',
        },
        currentDraft: {
          savedA: 'local edited value',
          savedB: 'stale local value',
          unsavedOther: 'keep this draft',
        },
        keys: ['savedA', 'savedB', 'unsavedOther'],
        touchedKeys: new Set(['savedA']),
      }),
    ).toEqual({
      savedA: 'local edited value',
      savedB: 'server untouched',
      unsavedOther: 'keep this draft',
    });
  });

  it('preserves touched card drafts across same-step saved response refreshes', () => {
    const identity = buildStepActivityIdentity('step-a', ['card-a', 'card-b']);
    const result = resolveStudentCardDraftEnvelope({
      identity,
      savedAnswers: {
        'card-a': 'server refreshed answer',
        'card-b': 'server fresh answer',
      },
      cardKeys: ['card-a', 'card-b'],
      envelope: {
        identity,
        draftAnswers: {
          'card-a': 'learner local edit',
          'card-b': 'stale card b',
        },
        touchedKeys: new Set(['card-a']),
        localSubmittedKeys: new Set(['card-b']),
      },
    });

    expect(result.identityChanged).toBe(false);
    expect(result.mergedDraftAnswers).toEqual({
      'card-a': 'learner local edit',
      'card-b': 'server fresh answer',
    });
    expect(Array.from(result.nextEnvelope.localSubmittedKeys)).toEqual(['card-b']);
  });

  it('resets card draft envelope when the owning step identity changes', () => {
    const result = resolveStudentCardDraftEnvelope({
      identity: buildStepActivityIdentity('step-b', ['card-a', 'card-c']),
      savedAnswers: {
        'card-a': 'step b saved answer',
      },
      cardKeys: ['card-a', 'card-c'],
      envelope: {
        identity: buildStepActivityIdentity('step-a', ['card-a', 'card-b']),
        draftAnswers: {
          'card-a': 'previous step local edit',
          'card-b': 'previous step answer',
        },
        touchedKeys: new Set(['card-a']),
        localSubmittedKeys: new Set(['card-b']),
      },
    });

    expect(result.identityChanged).toBe(true);
    expect(result.mergedDraftAnswers).toEqual({
      'card-a': 'step b saved answer',
      'card-c': '',
    });
    expect(result.nextEnvelope.identity).toBe('step-b:card-a|card-c');
    expect(result.nextEnvelope.touchedKeys.size).toBe(0);
    expect(result.nextEnvelope.localSubmittedKeys.size).toBe(0);
  });
});
