import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  knowledgeDeckCardKey,
  recordKnowledgeDeckVisit,
} from '@/resources/interactive-learning/shared/knowledge-deck';

const knowledgeDeckFiles = [
  'src/resources/interactive-learning/lesson-01/feedback-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-02/laplace-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-03/diff-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-04/transfer-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-05/structure-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-13/phase-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-14/margin-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-15/series-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-16/nonlinear-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-17/df-knowledge-deck/index.tsx',
];

describe('knowledge deck interaction state', () => {
  it('tracks repeated knowledge nodes as distinct learning cards', () => {
    const firstVisit = recordKnowledgeDeckVisit(
      { activeIndex: 0, visitedIndices: [0] },
      1
    );

    expect(firstVisit).toEqual({
      activeIndex: 1,
      visitedIndices: [0, 1],
    });

    const repeatedNodeVisit = recordKnowledgeDeckVisit(firstVisit, 2);

    expect(repeatedNodeVisit).toEqual({
      activeIndex: 2,
      visitedIndices: [0, 1, 2],
    });
  });

  it('does not duplicate a card visit when the same index is selected again', () => {
    expect(
      recordKnowledgeDeckVisit({ activeIndex: 2, visitedIndices: [0, 1, 2] }, 1)
    ).toEqual({
      activeIndex: 1,
      visitedIndices: [0, 1, 2],
    });
  });

  it('uses node id and card index together for unique navigation keys', () => {
    expect(knowledgeDeckCardKey({ id: '传递函数_2_2c5e2589' }, 3)).toBe(
      '传递函数_2_2c5e2589:3'
    );
  });

  it('routes every lesson knowledge deck through the shared index-based deck', () => {
    for (const file of knowledgeDeckFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');

      expect(source).toContain('<KnowledgeDeck');
      expect(source).not.toContain('key={card.id}');
      expect(source).not.toContain('activeId === card.id');
      expect(source).not.toContain('recordVisit(card.id)');
      expect(source).not.toContain('visited, setVisited');
    }
  });

  it('keeps shared deck telemetry and theme adaptation explicit', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/resources/interactive-learning/shared/knowledge-deck.tsx'),
      'utf8'
    );

    expect(source).toContain('knowledgeNodeId');
    expect(source).toContain('cardIndex');
    expect(source).toContain('visitedIndices');
    expect(source).toContain('dark:bg-slate');
    expect(source).toContain('dark:text-slate');
    expect(source).toContain('PathResourceContinueAction');
    expect(source).not.toContain('onComplete?.(result)');
  });

  it('keeps knowledge card taxonomy badges readable in light and dark themes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/resources/interactive-learning/shared/knowledge-card.tsx'),
      'utf8'
    );

    expect(source).toContain('text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200');
    expect(source).toContain('text-blue-700 dark:bg-blue-500/15 dark:text-blue-200');
    expect(source).toContain('hover:bg-slate-100 dark:hover:bg-slate-700');
  });
});

const browseCompleteResourceFiles = [
  'src/resources/interactive-learning/lesson-03/modeling-workflow-puzzle/index.tsx',
  'src/resources/interactive-learning/lesson-05/block-diagram-workshop/index.tsx',
  'src/resources/interactive-learning/lesson-06/judge-bench-sim/index.tsx',
  'src/resources/interactive-learning/lesson-06/metric-handbook/index.tsx',
  'src/resources/interactive-learning/lesson-07/theory-deck/index.tsx',
  'src/resources/interactive-learning/lesson-08/routh-guide/index.tsx',
  'src/resources/interactive-learning/lesson-08/steady-error-deck/index.tsx',
  'src/resources/interactive-learning/lesson-09/correction-strategy/index.tsx',
  'src/resources/interactive-learning/lesson-09/time-domain-synthesis/index.tsx',
  'src/resources/interactive-learning/lesson-10/root-locus-workshop/index.tsx',
  'src/resources/interactive-learning/lesson-11/graphical-thinking-workshop/index.tsx',
  'src/resources/interactive-learning/lesson-11/parameter-root-locus-deck/index.tsx',
  'src/resources/interactive-learning/lesson-13/iso2631-mapping/index.tsx',
  'src/resources/interactive-learning/lesson-14/margin-tradeoff-lab/index.tsx',
  'src/resources/interactive-learning/lesson-14/three-band-studio/index.tsx',
  'src/resources/interactive-learning/lesson-15/lag-lead-workshop/index.tsx',
  'src/resources/interactive-learning/lesson-16/harmonic-linearization-guide/index.tsx',
  'src/resources/interactive-learning/lesson-17/negative-inverse-workshop/index.tsx',
];

describe('browse-complete resource path continue', () => {
  it('requires an explicit continue action instead of completing from a visit effect', () => {
    for (const file of browseCompleteResourceFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).toContain('PathResourceContinueAction');
      expect(source, file).not.toContain('!interactive?.progress.isComplete');
    }
  });

  it('keeps judge-bench completion metrics in the continue payload', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/resources/interactive-learning/lesson-06/judge-bench-sim/index.tsx'),
      'utf8'
    );

    expect(source).toContain('metrics: result.metrics');
    expect(source).toContain('pass,');
    expect(source).not.toContain('data: { zeta, omega, duration }');
  });
});

const lastQuestionQuizFiles = [
  'src/resources/interactive-learning/lesson-01/feedback-exit-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-01/feedback-precheck/index.tsx',
  'src/resources/interactive-learning/lesson-01/loop-scenario-lab/index.tsx',
  'src/resources/interactive-learning/lesson-02/laplace-exit-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-02/laplace-inverse-lab/index.tsx',
  'src/resources/interactive-learning/lesson-02/laplace-precheck/index.tsx',
  'src/resources/interactive-learning/lesson-03/diff-exit-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-03/diff-precheck/index.tsx',
  'src/resources/interactive-learning/lesson-03/modeling-scenario-lab/index.tsx',
  'src/resources/interactive-learning/lesson-04/transfer-derivation-lab/index.tsx',
  'src/resources/interactive-learning/lesson-04/transfer-element-workshop/index.tsx',
  'src/resources/interactive-learning/lesson-04/transfer-exit-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-04/transfer-precheck/index.tsx',
  'src/resources/interactive-learning/lesson-05/block-diagram-precheck/index.tsx',
  'src/resources/interactive-learning/lesson-05/mason-loop-challenge/index.tsx',
  'src/resources/interactive-learning/lesson-05/signal-flow-lab/index.tsx',
  'src/resources/interactive-learning/lesson-05/structure-exit-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-06/metric-quick-check/index.tsx',
  'src/resources/interactive-learning/lesson-07/damping-quick-check/index.tsx',
  'src/resources/interactive-learning/lesson-08/post-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-08/routh-practice/index.tsx',
  'src/resources/interactive-learning/lesson-08/stability-precheck/index.tsx',
  'src/resources/interactive-learning/lesson-09/correction-precheck/index.tsx',
  'src/resources/interactive-learning/lesson-12/bode-plot-recognition/index.tsx',
  'src/resources/interactive-learning/lesson-12/bode-post-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-12/frequency-precheck/index.tsx',
  'src/resources/interactive-learning/lesson-13/nyquist-stability-scenario/index.tsx',
  'src/resources/interactive-learning/lesson-13/phase-concept-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-13/phase-stability-exit-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-14/margin-exit-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-14/margin-quick-check/index.tsx',
  'src/resources/interactive-learning/lesson-15/series-exit-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-15/series-strategy-lab/index.tsx',
  'src/resources/interactive-learning/lesson-16/nonlinear-exit-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-16/nonlinear-precheck/index.tsx',
  'src/resources/interactive-learning/lesson-17/df-exit-quiz/index.tsx',
  'src/resources/interactive-learning/lesson-17/df-precheck/index.tsx',
];

describe('last-question quiz path continue', () => {
  it('does not complete from the last check, and requires an explicit continue action', () => {
    for (const file of lastQuestionQuizFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).toContain('PathResourceContinueAction');
      expect(source, file).not.toContain('interactive?.progress.markComplete(result)');
    }
  });
});
