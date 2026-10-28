import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  findControlMapSearchMatches,
  isControlNodeVisible,
  isLastActiveControlMapFilter,
  toggleControlMapFilter,
} from '@/resources/interactive-learning/control-map/control-map-filters';
import { controlTheoryNodes } from '@/resources/interactive-learning/control-map/data/control-theory-nodes';
import { defaultViewState } from '@/resources/interactive-learning/control-map/types';
import { assessPidResponse } from '@/resources/interactive-learning/pid-simulator/pid-response-assessment';

const DT = 0.02;

function sampled(duration: number, signal: (t: number) => number) {
  return Array.from({ length: Math.round(duration / DT) + 1 }, (_, index) => signal(index * DT));
}

describe('assessPidResponse', () => {
  it('accepts a decaying oscillation and a slow first-order approach', () => {
    const decaying = sampled(20, (t) => 1 - Math.exp(-0.15 * t) * Math.cos(2 * t));
    const slow = sampled(10, (t) => 1 - Math.exp(-0.1 * t));
    expect(assessPidResponse(decaying, 1)).toEqual({ diverged: false, clampChart: false });
    expect(assessPidResponse(slow, 1)).toEqual({ diverged: false, clampChart: false });
  });

  it('flags an oscillation whose envelope keeps growing within the bound', () => {
    const growing = sampled(20, (t) => 1 + 0.5 * Math.exp(0.06 * t) * Math.sin(4 * t));
    expect(Math.max(...growing.map(Math.abs))).toBeLessThan(50);
    expect(assessPidResponse(growing, 1)).toEqual({ diverged: true, clampChart: false });
  });

  it('flags a monotonic runaway', () => {
    const runaway = sampled(20, (t) => 1 - Math.exp(0.1 * t));
    expect(assessPidResponse(runaway, 1).diverged).toBe(true);
  });

  it('clamps the chart for non-finite values or a peak beyond the bound', () => {
    expect(assessPidResponse([0, 0.5, Number.NaN, 1], 1)).toEqual({ diverged: true, clampChart: true });
    expect(assessPidResponse([0, 1, 120, 1], 2)).toEqual({ diverged: true, clampChart: true });
    expect(assessPidResponse([0, 1, 90, 1], 2).clampChart).toBe(false);
  });
});

describe('PID simulator preview and record semantics', () => {
  const source = readFileSync('src/resources/interactive-learning/pid-simulator/pid-simulator-component.tsx', 'utf8');

  it('never reports learning callbacks from the automatic preview', () => {
    const preview = source.slice(source.indexOf('const simulate = () =>'), source.indexOf('}, [runtimeState'));
    expect(preview).toContain('runPidBatchSimulation');
    expect(preview).not.toMatch(/onStateChange|onComplete/);
  });

  it('offers recording only when the host supplies a callback and hides numeric internals', () => {
    expect(source).toContain('const canRecord = Boolean(onStateChange || onComplete);');
    expect(source).toMatch(/\{canRecord \? \(/);
    expect(source).not.toMatch(/步长|时间倍率/);
  });
});

describe('control map filters', () => {
  it('keeps at least one option active in each group', () => {
    const timeOnly = { ...defaultViewState, showFreqDomain: false };
    expect(toggleControlMapFilter(timeOnly, 'showTimeDomain')).toEqual({});
    expect(isLastActiveControlMapFilter(timeOnly, 'showTimeDomain')).toBe(true);
    expect(toggleControlMapFilter(defaultViewState, 'showTimeDomain')).toEqual({ showTimeDomain: false });
    expect(isLastActiveControlMapFilter(defaultViewState, 'showDiscrete')).toBe(false);
  });

  it('hides nodes outside the active domain filter', () => {
    const frequencyOnly = { ...defaultViewState, showTimeDomain: false };
    const timeNode = controlTheoryNodes.find((node) => node.domain === 'time');
    expect(timeNode).toBeDefined();
    expect(isControlNodeVisible(timeNode!, defaultViewState)).toBe(true);
    expect(isControlNodeVisible(timeNode!, frequencyOnly)).toBe(false);
  });

  it('returns search matches only for a non-empty query', () => {
    expect(findControlMapSearchMatches(controlTheoryNodes, defaultViewState)).toEqual([]);
    const matches = findControlMapSearchMatches(controlTheoryNodes, { ...defaultViewState, searchQuery: '根轨迹' });
    expect(matches.map((node) => node.nameCn)).toContain('根轨迹');
    expect(
      findControlMapSearchMatches(controlTheoryNodes, { ...defaultViewState, searchQuery: '不存在的概念xyz' }),
    ).toEqual([]);
  });
});
