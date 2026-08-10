import { describe, expect, it } from 'vitest';
import {
  TRUSTED_LEARNING_FACT_POLICY_VERSION,
  isTrustedLearningFact,
  trustedLearningFactPolicy,
} from '../trusted-learning-fact-filter';

describe('trusted learning fact filter', () => {
  it('rejects facts without a server-side source event anchor', () => {
    expect(isTrustedLearningFact({ sourceEventId: null })).toBe(false);
    expect(isTrustedLearningFact({ sourceEventId: undefined })).toBe(false);
    expect(isTrustedLearningFact({ sourceEventId: '' })).toBe(false);
    expect(isTrustedLearningFact({ sourceEventId: '   ' })).toBe(false);
  });

  it('rejects known historical, replay, fixture, backfill, and recompute event prefixes', () => {
    for (const prefix of trustedLearningFactPolicy.nonTrustedSourceEventPrefixes) {
      expect(isTrustedLearningFact({
        sourceEventId: `${prefix}event-1`,
        sourceLogId: 'log-1',
      })).toBe(false);
    }
  });

  it('requires a source log for simulation agent and task evidence', () => {
    for (const prefix of trustedLearningFactPolicy.simulationSourceEventPrefixes) {
      expect(isTrustedLearningFact({
        sourceEventId: `${prefix}event-1`,
        sourceLogId: null,
      })).toBe(false);
      expect(isTrustedLearningFact({
        sourceEventId: `${prefix}event-1`,
        sourceLogId: '',
      })).toBe(false);
      expect(isTrustedLearningFact({
        sourceEventId: `${prefix}event-1`,
        sourceLogId: 'simulation-log-1',
      })).toBe(true);
    }
  });

  it('accepts governed server events with a source event anchor', () => {
    expect(isTrustedLearningFact({
      sourceEventId: 'governed-event:123',
      sourceLogId: 'governed-log:123',
      knowledgeRevisionRef: 'lesson:control-engineering:1',
    })).toBe(true);
  });

  it('does not read an application-side trusted marker', () => {
    const fact = {
      sourceEventId: 'historical:event-1',
      sourceLogId: 'log-1',
      trusted: true,
    };
    expect(isTrustedLearningFact(fact)).toBe(false);
  });

  it('exposes a stable versioned policy', () => {
    expect(trustedLearningFactPolicy).toMatchObject({
      version: TRUSTED_LEARNING_FACT_POLICY_VERSION,
      evidenceAnchorFields: ['sourceEventId', 'sourceLogId'],
      nonTrustedSourceEventPrefixes: expect.any(Array),
      simulationSourceEventPrefixes: expect.any(Array),
    });
    expect(TRUSTED_LEARNING_FACT_POLICY_VERSION).toBe('trusted-learning-fact-policy.v1');
  });
});
