import { describe, expect, it } from 'vitest';

import {
  CANONICAL_INTERACTIVE_RESPONSE_KINDS,
  getInteractiveResponseKindMetadata,
  isCanonicalInteractiveResponseKind,
  isObjectiveInteractiveResponseKind,
  normalizeInteractiveResponseKind,
} from '../interactive-response-contracts';

describe('interactive response contracts', () => {
  it('defines the finite canonical response vocabulary', () => {
    expect(CANONICAL_INTERACTIVE_RESPONSE_KINDS).toEqual([
      'choice.single',
      'choice.binary',
      'choice.multi',
      'text.short',
      'text.long',
      'text.structured',
      'parameter.set',
      'ordering.sequence',
      'matching.pairs',
      'table.builder',
      'simulation.result',
      'training.result',
    ]);

    for (const kind of CANONICAL_INTERACTIVE_RESPONSE_KINDS) {
      expect(isCanonicalInteractiveResponseKind(kind), kind).toBe(true);
    }
  });

  it('normalizes legacy aliases to canonical response kinds', () => {
    expect(normalizeInteractiveResponseKind('single_choice')).toBe('choice.single');
    expect(normalizeInteractiveResponseKind('binary_choice')).toBe('choice.binary');
    expect(normalizeInteractiveResponseKind('true_false')).toBe('choice.binary');
    expect(normalizeInteractiveResponseKind('multi_choice')).toBe('choice.multi');
    expect(normalizeInteractiveResponseKind('multi_select')).toBe('choice.multi');
    expect(normalizeInteractiveResponseKind('fill_text')).toBe('text.short');
    expect(normalizeInteractiveResponseKind('text')).toBe('text.short');
    expect(normalizeInteractiveResponseKind('short_response')).toBe('text.short');
    expect(normalizeInteractiveResponseKind('short_text')).toBe('text.short');
    expect(normalizeInteractiveResponseKind('observation_text')).toBe('text.short');
    expect(normalizeInteractiveResponseKind('drag_sort')).toBe('ordering.sequence');
    expect(normalizeInteractiveResponseKind('card_sort')).toBe('ordering.sequence');
    expect(normalizeInteractiveResponseKind('drag_match')).toBe('matching.pairs');
    expect(normalizeInteractiveResponseKind('triple_match')).toBe('matching.pairs');
    expect(normalizeInteractiveResponseKind('match')).toBe('matching.pairs');
    expect(normalizeInteractiveResponseKind('parameter_set')).toBe('parameter.set');
    expect(normalizeInteractiveResponseKind('table_builder')).toBe('table.builder');
  });

  it('rejects unknown or missing response kinds instead of silently treating them as text', () => {
    expect(() => normalizeInteractiveResponseKind('mult_select')).toThrow(
      'Unknown interactive response kind: mult_select',
    );
    expect(() => normalizeInteractiveResponseKind('')).toThrow('Missing interactive response kind');
    expect(isObjectiveInteractiveResponseKind('mult_select')).toBe(false);
  });

  it('classifies canonical response kinds by evidence and scoring category', () => {
    expect(isObjectiveInteractiveResponseKind('choice.multi')).toBe(true);
    expect(isObjectiveInteractiveResponseKind('multi_select')).toBe(true);
    expect(getInteractiveResponseKindMetadata('choice.single')).toMatchObject({
      category: 'objective',
      scoring: 'objective',
    });
    expect(getInteractiveResponseKindMetadata('text.short')).toMatchObject({
      category: 'subjective',
      scoring: 'subjective',
    });
    expect(getInteractiveResponseKindMetadata('parameter.set')).toMatchObject({
      category: 'parameter',
      scoring: 'unsupported',
    });
    expect(getInteractiveResponseKindMetadata('simulation.result')).toMatchObject({
      category: 'simulation',
      scoring: 'unsupported',
    });
    expect(getInteractiveResponseKindMetadata('training.result')).toMatchObject({
      category: 'training',
      scoring: 'unsupported',
    });
  });
});
