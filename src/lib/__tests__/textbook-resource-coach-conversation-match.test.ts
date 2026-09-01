import { describe, expect, it } from 'vitest';

import {
  isExactResourceCoachMatch,
  resourceCoachBindingIdentity,
} from '@/lib/textbook-resource-coach/conversation-match';
import { hashTextbookMarkdown } from '@/lib/textbook-resource-coach/identity';

const unitMarkdown = '单元正文：稳态误差的定义与计算。';

function identity(overrides: Record<string, unknown> = {}) {
  return {
    resourceKind: 'structured-textbook-unit',
    resourceId: 'unit-3-1',
    bookId: 'hu-shousong-auto-control-8th',
    edition: '第 8 版',
    sourceRevision: 'rev-2026-08',
    unitId: 'unit-3-1',
    contentHash: hashTextbookMarkdown(unitMarkdown),
    anchorId: null,
    ...overrides,
  } as const;
}

function bindingEvent(identityValue: unknown, mode = 'resource-coach') {
  return {
    version: 1,
    teachingAssistantModeId: mode,
    modeClientContextHints: {},
    pinnedTextbookResourceIdentity: identityValue,
  };
}

describe('resource-coach conversation matching', () => {
  it('matches the same unit, revision, hash and anchor through the pinned identity', () => {
    const requested = identity({ anchorId: 'formula-3-1-2' });
    expect(isExactResourceCoachMatch(bindingEvent(identity({ anchorId: 'formula-3-1-2' })), requested)).toBe(true);
  });

  it('falls back to persisted client hints when no pinned identity exists', () => {
    const requested = identity();
    const legacyEvent = {
      version: 1,
      teachingAssistantModeId: 'resource-coach',
      modeClientContextHints: { ...identity() },
    };
    expect(resourceCoachBindingIdentity(legacyEvent)).toEqual(requested);
    expect(isExactResourceCoachMatch(legacyEvent, requested)).toBe(true);
  });

  it.each([
    ['different revision', { sourceRevision: 'rev-2026-09' }],
    ['different content hash', { contentHash: hashTextbookMarkdown('改动后的正文。') }],
    ['different anchor', { anchorId: 'figure-3-1-1' }],
    ['different unit', { unitId: 'unit-3-2', resourceId: 'unit-3-2' }],
  ])('rejects a binding with %s', (_label, overrides) => {
    expect(isExactResourceCoachMatch(bindingEvent(identity(overrides)), identity())).toBe(false);
  });

  it('matches real-data identities with Unicode edition segments', () => {
    const realShape = identity({
      resourceId: 'textbook-unit:hu-shousong-auto-control-8th@第八版/chapter-chapter-01',
      unitId: 'textbook-unit:hu-shousong-auto-control-8th@第八版/chapter-chapter-01',
      edition: '第八版',
      sourceRevision: '58f70df257f493f7dc13b2dabfb0383b972ee017',
    });
    expect(isExactResourceCoachMatch(bindingEvent(realShape), realShape)).toBe(true);
  });

  it('rejects non-coach modes, tampered payloads and empty events', () => {
    const requested = identity();
    expect(isExactResourceCoachMatch(bindingEvent(identity(), 'diagnosis-explainer'), requested)).toBe(false);
    expect(isExactResourceCoachMatch(bindingEvent({ ...identity(), contentHash: 'not-a-hash' }), requested)).toBe(false);
    expect(isExactResourceCoachMatch(null, requested)).toBe(false);
    expect(isExactResourceCoachMatch({ teachingAssistantModeId: 'resource-coach' }, requested)).toBe(false);
  });
});
