import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const readSource = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

const deckFiles = [
  'src/resources/interactive-learning/lesson-01/feedback-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-02/laplace-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-03/diff-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-04/transfer-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-05/structure-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-06/metric-handbook/index.tsx',
  'src/resources/interactive-learning/lesson-07/theory-deck/index.tsx',
  'src/resources/interactive-learning/lesson-08/routh-guide/index.tsx',
  'src/resources/interactive-learning/lesson-08/steady-error-deck/index.tsx',
  'src/resources/interactive-learning/lesson-09/correction-strategy/index.tsx',
  'src/resources/interactive-learning/lesson-09/time-domain-synthesis/index.tsx',
  'src/resources/interactive-learning/lesson-11/parameter-root-locus-deck/index.tsx',
  'src/resources/interactive-learning/lesson-13/phase-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-14/margin-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-15/series-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-16/harmonic-linearization-guide/index.tsx',
  'src/resources/interactive-learning/lesson-16/nonlinear-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-17/df-knowledge-deck/index.tsx',
  'src/resources/interactive-learning/lesson-17/negative-inverse-workshop/index.tsx',
];

describe('resource React Doctor regressions', () => {
  it('keeps deck visit tracking event-driven without duplicate progress entries', () => {
    for (const file of deckFiles) {
      const source = readSource(file);

      expect(source, file).toContain('useState<string[]>(() => [initialActiveId])');
      expect(source, file).toContain('const recordVisit = useCallback((nextActiveId: string) => {');
      expect(source, file).toContain('current.includes(nextActiveId) ? current : [...current, nextActiveId]');
      expect(source, file).not.toMatch(/setVisited(?:Ids)?\(nextVisited\)/);
    }
  });

  it('derives widget AI hints without effect-backed local hint state', () => {
    for (const file of [
      'src/resources/widgets/analogy-mapper.tsx',
      'src/resources/widgets/argument-principle.tsx',
      'src/resources/widgets/physics-builder.tsx',
    ]) {
      const source = readSource(file);

      expect(source, file).toContain('const aiHint =');
      expect(source, file).not.toContain('setAiHint');
    }
  });

  it('runs Ten Drops completion from the explicit drop transition', () => {
    const source = readSource('src/resources/interactive-learning/ten-drops-game/index.tsx');

    expect(source).toContain('await addDrop({ row, col });');
    expect(source).toContain('const nextState = useTenDropsGame.getState();');
    expect(source).toContain('nextState.dropsAvailable');
    expect(source).toContain('nextState.maxChainReached');
    expect(source).not.toMatch(/useEffect\(\(\) => \{\s*if \(gameStatus !== 'won'/);
    expect(source).not.toContain('[history.length, gameStatus, undo]');
  });

  it('keeps Control Odyssey telemetry details available outside victory state', () => {
    const source = readSource('src/resources/interactive-learning/control-odyssey/index.tsx');

    expect(source).toContain('const showDetails = detailsState.runId === runId && detailsState.visible;');
    expect(source).not.toContain("const showDetails = gameState === 'VICTORY'");
    expect(source).not.toContain('effectiveShowDetails');
  });

  it('resets the ship model preview by keyed model identity', () => {
    const source = readSource('src/resources/simulations/ship-model-preview.tsx');

    expect(source).toContain('function ShipModelPreviewSession');
    expect(source).toContain('key={modelPath}');
    expect(source).not.toContain('setRetryCount(0)');
    expect(source).not.toContain('setRetryKey(0)');
    expect(source).not.toContain('setLoadFailed(false)');
  });

  it('keeps Destroyer auto-advance timers alive across HUD ticks', () => {
    const source = readSource('src/resources/simulations/destroyer-simulation.tsx');

    expect(source).toContain('const nextTaskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);');
    expect(source).toContain('const scheduledNextTaskIdRef = useRef<string | null>(null);');
    expect(source).toContain('const clearNextTaskAdvance = useCallback(() => {');
    expect(source).toContain('const scheduleNextTaskAdvance = useCallback((taskId: string) => {');
    expect(source).toContain('scheduledNextTaskIdRef.current === taskId');
    expect(source).toContain('nextTaskTimerRef.current = setTimeout(() => {');
    expect(source).toContain('}, [activeTask?.id, clearNextTaskAdvance]);');
    expect(source).toContain('clearNextTaskAdvance();');
    expect(source).not.toMatch(/let nextTaskTimer: ReturnType<typeof setTimeout> \| null = null;[\s\S]*return \(\) => \{[\s\S]*clearTimeout\(nextTaskTimer\)/);
  });
});
