vi.mock('server-only', () => ({}));
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { buildKonlingRuntimeContext } from '@/lib/konling-agent-runtime';

/**
 * #1864 边界回归：完整控灵运行时 DTO 不再对学生浏览器可达；治理上下文
 * 只在服务端构建并供模型 grounding 使用。
 */
describe('konling runtime context confidentiality boundary', () => {
  it('retires the browser-readable konling-context endpoint', () => {
    expect(existsSync(join(process.cwd(), 'src/app/api/ai/konling-context'))).toBe(false);
    // 生产与测试代码都不得再请求该端点。
    const sources = [
      'src/lib/konling-agent-runtime.ts',
      'src/components/ai/global-ai-sidebar.tsx',
      'src/features/knowledge/knowledge-graph-system.tsx',
    ];
    for (const file of sources) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, file).not.toContain("'/api/ai/konling-context'");
      expect(source, file).not.toContain('"/api/ai/konling-context"');
    }
  });

  it('keeps governed context server-side for model grounding with internal canaries intact', async () => {
    const db = {
      knowledgeNode: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'CANARY-node-root-locus',
          name: '根轨迹设计',
          nodeType: 'THEORY',
          description: 'CANARY-server-grounding-description',
          knowledgeDim: 'CONCEPTUAL',
          metadata: { chapterName: '根轨迹法', capabilityTargetRefs: ['capability:root-locus-design'] },
          tags: ['根轨迹'],
        }]),
      },
    };
    const runtime = await buildKonlingRuntimeContext(db as never, {
      authenticatedUserId: 'CANARY-student-1',
      role: 'STUDENT',
      courseId: 'unit-4-5',
      pageId: '/knowledge',
      knowledgeWorkspaceHint: { status: 'selected-node', selectedNodeId: 'CANARY-node-root-locus' },
      trustedContentContext: true,
    });
    // 服务端模型 grounding 仍可消费治理上下文（含内部 canary 值）。
    expect(runtime.knowledgeWorkspace).toBeTruthy();
    expect(JSON.stringify(runtime)).toContain('CANARY-node-root-locus');
    // 运行时构建器保持为服务端模块。
    const runtimeSource = readFileSync(join(process.cwd(), 'src/lib/konling-agent-runtime.ts'), 'utf8');
    expect(runtimeSource).not.toContain("'use client'");
  });
});
