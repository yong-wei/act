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

  it('rejects non-trusted markers nested under controlled producer prefixes', () => {
    for (const marker of [
      'historical',
      'interaction-log',
      'yangfan-diagnostic-fixture',
      'backfill',
      'recompute',
    ]) {
      expect(isTrustedLearningFact({
        sourceEventId: `adaptive-assessment:${marker}:event-1`,
        sourceLogId: 'server-log-1',
      })).toBe(false);
    }
  });

  it('rejects arbitrary unknown source event ids without a server-side log anchor', () => {
    expect(isTrustedLearningFact({
      sourceEventId: 'unknown-non-empty-event-id',
      sourceLogId: null,
    })).toBe(false);
    expect(isTrustedLearningFact({
      sourceEventId: 'unknown-prefixed:event-1',
      sourceLogId: 'log-1',
    })).toBe(false);
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

  it('requires a source log for every controlled producer prefix', () => {
    for (const policy of trustedLearningFactPolicy.controlledSourceEventPolicies) {
      expect(isTrustedLearningFact({
        sourceEventId: `${policy.sourceEventPrefix}event-1`,
        sourceLogId: null,
      })).toBe(false);
      expect(isTrustedLearningFact({
        sourceEventId: `${policy.sourceEventPrefix}event-1`,
        sourceLogId: 'server-log-1',
      })).toBe(true);
    }
  });

  it('accepts formal producer events with server-side anchors', () => {
    expect(isTrustedLearningFact({
      sourceEventId: 'arena-official:publication-1:task-1:submission-1:student-1:hash:label:targets:versions',
      sourceLogId: 'submission-1',
    })).toBe(true);
    expect(isTrustedLearningFact({
      sourceEventId: 'control-correction-path:choice:path-1:event-1',
      sourceLogId: 'event-1',
    })).toBe(true);
    expect(isTrustedLearningFact({
      sourceEventId: 'simulation-task-evidence:v2:digest-1',
      sourceLogId: 'SimulationRun:run-1',
    })).toBe(true);
    expect(isTrustedLearningFact({
      sourceEventId: 'unprefixed-core-event-id',
      sourceLogId: 'server-log-1',
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
      controlledSourceEventPolicies: expect.any(Array),
    });
    expect(TRUSTED_LEARNING_FACT_POLICY_VERSION).toBe('trusted-learning-fact-policy.v1');
  });
});
