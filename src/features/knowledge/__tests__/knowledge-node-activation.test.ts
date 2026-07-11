import { describe, expect, it } from 'vitest';
import { resolveKnowledgeNodeActivation } from '../graph/node-activation';

describe('knowledge node direct activation resolver', () => {
  it.each([
    [{ expansionState: 'expandable', expanded: false }, 'expand'],
    [{ expansionState: 'expandable', expanded: true }, 'collapse'],
    [{ expansionState: 'expandable', expanded: true, filteredEmpty: true }, 'collapse'],
    [{ expansionState: 'leaf', expanded: false }, 'inspect'],
    [{ expansionState: 'unknown', expanded: false }, 'resolve'],
    [{ expansionState: 'unknown', expanded: false, error: true }, 'resolve'],
    [{ expansionState: 'expandable', expanded: false, error: true }, 'expand'],
    [{ expansionState: 'expandable', expanded: false, loading: true }, 'ignore'],
  ] as const)('maps %o to %s', (input, expected) => {
    expect(resolveKnowledgeNodeActivation(input)).toBe(expected);
  });
});
