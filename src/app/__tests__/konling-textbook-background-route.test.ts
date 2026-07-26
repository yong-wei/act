import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Konling textbook background route contract', () => {
  it('keeps optimization inside the original UI message stream and request runtime', () => {
    const route = readSource('src/app/api/ai/chat/route.ts');
    const runtime = readSource('src/lib/konling-agent-runtime.ts');
    const stream = readSource('src/lib/konling-message-revision-stream.ts');

    expect(route.match(/createUIMessageStreamResponse\(/gu)).toHaveLength(1);
    expect(route).toContain('hasPendingOptimization:');
    expect(route).toContain('finalizeOptimization:');
    expect(route).toContain('getTextbookOptimizations = toolRuntime.getTextbookOptimizations');
    expect(stream).toContain("type: 'data-konling-optimization-status'");
    expect(stream).toContain("type: 'data-konling-message-revision'");

    const runtimeStart = runtime.indexOf('export function buildKonlingToolRuntime');
    const mapDeclaration = runtime.indexOf('const textbookOptimizations = new Map', runtimeStart);
    expect(mapDeclaration).toBeGreaterThan(runtimeStart);
    expect(runtime.slice(0, runtimeStart)).not.toContain('textbookOptimizations = new Map');
    expect(runtime).toContain('toolCallId: options.toolCallId');
    expect(runtime).toContain('abortSignal: options.abortSignal');
  });

  it('closes tools for material revision and gates revision 2 behind persistence CAS', () => {
    const route = readSource('src/app/api/ai/chat/route.ts');
    const optimizationStart = route.indexOf('finalizeOptimization: async');
    const optimizationBody = route.slice(optimizationStart);
    const revisionGeneration = optimizationBody.indexOf('const optimized = await generateText');
    const cas = optimizationBody.indexOf('replaceKonlingConversationAssistantRevision');
    const revisionReturn = optimizationBody.indexOf('revision: 2', cas);

    expect(revisionGeneration).toBeGreaterThan(0);
    expect(optimizationBody.slice(revisionGeneration, cas)).not.toContain('tools,');
    expect(optimizationBody).toContain('...frozenModelMessages');
    expect(optimizationBody).toContain('...response.messages');
    expect(optimizationBody).toContain('abortSignal: request.signal');
    expect(cas).toBeGreaterThan(revisionGeneration);
    expect(revisionReturn).toBeGreaterThan(cas);
    expect(optimizationBody).toContain('if (!replaced) return null');
    expect(optimizationBody).toContain('repair: citationRepairUsed');
    expect(route).toContain('responseAssistantMessage = responseMessage');
    expect(route.match(/replaceMessageTextContent\(/gu)).toHaveLength(2);
  });

  it('uses only the approved production optimization copy', () => {
    const renderer = readSource('src/components/ai/konling-chat-renderer.tsx');
    expect(renderer).toContain('正在后台优化响应');
    expect(renderer).not.toContain('embedding timeout');
    expect(renderer).not.toContain('rerank timeout');
    expect(renderer).not.toContain('traceId');
  });

  it('freezes one minimal server-owned context for mapping-only citation repair', () => {
    const route = readSource('src/app/api/ai/chat/route.ts');
    const repair = readSource('src/lib/konling-citation-repair.ts');

    expect(route).toContain('citationRepairServerContext = Object.freeze({');
    for (const field of ['role:', 'topic:', 'courseTitle:']) {
      expect(route).toContain(field);
    }
    const repairContextStart = route.indexOf('citationRepairServerContext = Object.freeze({');
    const repairContextEnd = route.indexOf('});', repairContextStart);
    const repairContext = route.slice(repairContextStart, repairContextEnd);
    expect(repairContext).not.toContain('courseId:');
    expect(repairContext).not.toContain('pageId:');
    expect(route.match(/serverContext: citationRepairServerContext/gu)).toHaveLength(2);
    expect(repair).toContain('assignedCitations: input.assignedCitations');
    expect(repair).toContain('unresolvedMarkers: [...initial.unresolvedMarkers]');
    expect(repair).not.toContain('learnerState:');
    expect(repair).not.toContain('userId:');
    expect(repair).not.toContain('toolPayload');
  });
});
