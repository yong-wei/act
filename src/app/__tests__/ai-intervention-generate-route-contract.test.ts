import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildKonlingInterventionClientFields } from '@/lib/konling-intervention-client-payload';
import type { KonlingInterventionRecord } from '@/lib/konling-agent-runtime';

const generateRouteSource = readFileSync(
  join(process.cwd(), 'src/app/api/ai/intervention/generate/route.ts'),
  'utf8',
);
const companionPanelSource = readFileSync(
  join(process.cwd(), 'src/features/ai/companion/ai-companion-panel.tsx'),
  'utf8',
);

describe('AI intervention generate route contract', () => {
  it('keeps the existing client InterventionPayload field semantics in the response', () => {
    const fields = buildKonlingInterventionClientFields({
      id: 'intv-1',
      shouldIntervene: true,
      reason: 'multiple_failures',
      interventionType: 'failure-analysis',
      content: '先固定两个参数。',
      whyNow: '多次失败。',
      evidence: [{ result: { overshoot: 42 } }],
      alternatives: ['单参数扫描'],
      relatedConcepts: ['阻尼比'],
      highlightParams: ['kp', 'kd'],
      showTrendPrediction: true,
      cooldownUntil: '2026-05-28T00:20:00.000Z',
    } satisfies KonlingInterventionRecord);

    expect(fields).toMatchObject({
      interventionId: 'intv-1',
      canSubmitFeedback: true,
      intervention: {
        suggestedNextSteps: ['单参数扫描'],
        relatedConcepts: ['阻尼比'],
        highlightParams: ['kp', 'kd'],
        showTrendPrediction: true,
      },
    });
    expect(fields.intervention.highlightParams).not.toContain('overshoot');
  });

  it('marks no-op generated interventions as not feedbackable', () => {
    const fields = buildKonlingInterventionClientFields({
      id: '',
      shouldIntervene: false,
      reason: 'none',
      interventionType: 'none',
      content: '当前探索节奏良好。',
      whyNow: '当前不需要主动干预。',
      evidence: [],
      alternatives: ['继续记录每次参数变化与指标变化关系'],
      relatedConcepts: ['迭代优化'],
      highlightParams: ['kp'],
      showTrendPrediction: false,
      cooldownUntil: null,
    } satisfies KonlingInterventionRecord);

    expect(fields.interventionId).toBe('');
    expect(fields.canSubmitFeedback).toBe(false);
    expect(fields.intervention.highlightParams).toEqual(['kp']);
  });

  it('marks cooldown responses as not feedbackable even when an old intervention id exists', () => {
    const fields = buildKonlingInterventionClientFields({
      id: 'previous-intv',
      shouldIntervene: false,
      reason: 'cooldown-active',
      interventionType: 'failure-analysis',
      content: '',
      whyNow: '最近已经触发过 Konling 干预，当前仍处于冷却期。',
      evidence: [],
      alternatives: ['继续当前路径节点', '稍后再请求帮助'],
      relatedConcepts: [],
      highlightParams: ['kp'],
      showTrendPrediction: false,
      cooldownUntil: '2026-05-28T00:20:00.000Z',
    } satisfies KonlingInterventionRecord);

    expect(fields.interventionId).toBe('previous-intv');
    expect(fields.canSubmitFeedback).toBe(false);
    expect(fields.intervention.showTrendPrediction).toBe(false);
  });

  it('uses a stable simulation companion scope for generate and feedback requests', () => {
    expect(companionPanelSource).toContain("courseId: 'simulation-companion'");
    expect(companionPanelSource).toContain('pageId: sessionId');
    expect(companionPanelSource).toContain('resourceId: sessionId');
    expect(companionPanelSource).toContain('pathNodeId: `ai-companion:${sessionId}`');
    expect(companionPanelSource).toContain('JSON.stringify({');
    expect(companionPanelSource).toContain('studentState,');
    expect(companionPanelSource).toContain('...interventionScope,');
    expect(companionPanelSource).toContain('arenaTaskId: context.taskId, method: context.method');
  });

  it('routes generate responses through the behavior-tested client field builder', () => {
    expect(generateRouteSource).toContain('buildKonlingInterventionClientFields(intervention)');
    expect(generateRouteSource).toContain('decision: toClientDecision(intervention)');
    expect(generateRouteSource).not.toContain('const decision = shouldIntervene');
  });
});
