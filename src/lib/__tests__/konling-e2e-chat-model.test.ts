import { describe, expect, it } from 'vitest';
import { streamText, tool } from 'ai';
import { z } from 'zod';

import {
  encodeKonlingE2ESourceBindingsMetadata,
  parseKonlingE2ESourceBindingsMetadata,
  resolveKonlingE2EChatModel,
} from '../ai/konling-e2e-chat-model';

describe('Konling deterministic browser acceptance model gate', () => {
  it('is unreachable without the exact acceptance token', () => {
    expect(resolveKonlingE2EChatModel({ NODE_ENV: 'test' })).toBeNull();
    expect(resolveKonlingE2EChatModel({ NODE_ENV: 'test', SMART_LESSON_E2E_FIXTURE_TOKEN: 'wrong' })).toBeNull();
  });

  it('is unreachable in production even with the acceptance token', () => {
    expect(resolveKonlingE2EChatModel({ NODE_ENV: 'production', SMART_LESSON_E2E_FIXTURE_TOKEN: 'smart-lesson-real-browser-v1' })).toBeNull();
  });

  it('exposes an AI SDK v3 model only for the exact non-production gate', () => {
    expect(resolveKonlingE2EChatModel({ NODE_ENV: 'test', SMART_LESSON_E2E_FIXTURE_TOKEN: 'smart-lesson-real-browser-v1' }))
      .toMatchObject({ specificationVersion: 'v3', provider: 'konling-e2e-fixture' });
  });

  it('traverses the AI SDK tool execution and follow-up model step', async () => {
    const model = resolveKonlingE2EChatModel({ NODE_ENV: 'test', SMART_LESSON_E2E_FIXTURE_TOKEN: 'smart-lesson-real-browser-v1' });
    if (!model) throw new Error('fixture-model-required');
    const calls: unknown[] = [];
    const result = streamText({
      model,
      prompt: '请创建根轨迹课。',
      tools: { propose_smart_lesson_task_change: tool({
        inputSchema: z.object({ operation: z.string(), clarification: z.object({ question: z.string(), alternatives: z.array(z.string()) }) }),
        execute: async (input) => { calls.push(input); return { saved: true }; },
      }) },
      stopWhen: ({ steps }) => steps.length >= 2,
    });
    await expect(result.text).resolves.toBe('建议已保存，等待教师确认。');
    expect(calls).toEqual([expect.objectContaining({ operation: 'bootstrap', clarification: expect.any(Object) })]);
  });

  it('round-trips source-version bindings from compact message metadata', () => {
    const metadata = {
      sourceVersionId: 'version-1',
      bindings: [
        { stableAnchor: 'h1:相角条件/paragraph:1', contentHash: '1'.repeat(64) },
        { stableAnchor: 'h1:幅值条件/paragraph:1', contentHash: '2'.repeat(64) },
        { stableAnchor: 'h1:绘图规则/paragraph:1', contentHash: '3'.repeat(64) },
      ],
    };
    const encoded = encodeKonlingE2ESourceBindingsMetadata(metadata);
    expect(parseKonlingE2ESourceBindingsMetadata(`自然语言消息 ${encoded}`)).toEqual(metadata);
  });

  it('keeps source state pending and does not invent bindings when metadata is absent', async () => {
    const model = resolveKonlingE2EChatModel({ NODE_ENV: 'test', SMART_LESSON_E2E_FIXTURE_TOKEN: 'smart-lesson-real-browser-v1' });
    if (!model) throw new Error('fixture-model-required');
    const calls: any[] = [];
    const result = streamText({
      model,
      prompt: '选择幅值与相角条件 courseBasisId=basis-1 sourceVersionId=version-1',
      tools: { propose_smart_lesson_task_change: tool({
        inputSchema: z.object({ operation: z.string(), proposedTask: z.any() }),
        execute: async (input) => { calls.push(input); return { saved: true }; },
      }) },
      stopWhen: ({ steps }) => steps.length >= 2,
    });
    await result.text;
    const proposedTask = calls[0].proposedTask;
    expect(proposedTask.knowledgePoints.every((point: any) => point.sourceState === 'ai_generated_source_pending'
      && point.sourceBindings.length === 0)).toBe(true);
    expect(proposedTask.goals[0]).toMatchObject({ sourceState: 'ai_generated_source_pending', sourceBindings: [] });
  });
});
