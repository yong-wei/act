import { describe, expect, it } from 'vitest';

import { isCompleteArenaEvaluationCacheIdentity } from '../submissions/evaluation-cache-identity';

describe('arena evaluation cache identity', () => {
  it('requires task, artifact, and protocol identity together', () => {
    expect(isCompleteArenaEvaluationCacheIdentity({
      taskId: 'task-1',
      artifactHash: 'hash-1',
      protocolVersion: 'analysis-whitebox-v1',
    })).toBe(true);
    expect(isCompleteArenaEvaluationCacheIdentity({
      taskId: 'task-1',
      artifactHash: 'hash-1',
      protocolVersion: '',
    })).toBe(false);
    expect(isCompleteArenaEvaluationCacheIdentity({
      taskId: 'task-1',
      artifactHash: '',
      protocolVersion: 'analysis-whitebox-v1',
    })).toBe(false);
    expect(isCompleteArenaEvaluationCacheIdentity({
      taskId: null,
      artifactHash: 'hash-1',
      protocolVersion: 'analysis-whitebox-v1',
    })).toBe(false);
  });
});
