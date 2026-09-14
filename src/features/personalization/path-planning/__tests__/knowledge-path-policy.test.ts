import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_HEURISTIC_TIMEOUT_MS,
  readHeuristicTimeoutMs,
  resolveKnowledgePathPolicy,
} from '../knowledge-path-policy';

describe('heuristic timeout config', () => {
  afterEach(() => {
    delete process.env.KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS;
  });

  it('defaults to the production floor until P95 is measured', () => {
    delete process.env.KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS;
    expect(readHeuristicTimeoutMs()).toBe(DEFAULT_HEURISTIC_TIMEOUT_MS);
    expect(resolveKnowledgePathPolicy().heuristicTimeoutMs).toBe(DEFAULT_HEURISTIC_TIMEOUT_MS);
  });

  it('reads the production env override', () => {
    process.env.KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS = '400';
    expect(readHeuristicTimeoutMs()).toBe(400);
    expect(resolveKnowledgePathPolicy().heuristicTimeoutMs).toBe(400);
  });

  it('clamps invalid or extreme values', () => {
    process.env.KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS = '10';
    expect(readHeuristicTimeoutMs()).toBe(50);
    process.env.KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS = '99999';
    expect(readHeuristicTimeoutMs()).toBe(10_000);
    process.env.KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS = 'nope';
    expect(readHeuristicTimeoutMs()).toBe(DEFAULT_HEURISTIC_TIMEOUT_MS);
  });

  it('lets an explicit policy override win over env', () => {
    process.env.KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS = '400';
    expect(resolveKnowledgePathPolicy({ heuristicTimeoutMs: 80 }).heuristicTimeoutMs).toBe(80);
  });
});
