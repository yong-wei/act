import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  KonlingChatMessageList,
  konlingPromptInputClassName,
  sanitizeKonlingToolResultPreview,
} from '@/components/ai/konling-chat-renderer';
import { KonlingCitationPanel } from '@/components/ai/konling-citation-presentation';

describe('Konling shared chat renderer', () => {
  it('renders assistant messages with full-width layout and collapsed tool summary', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingChatMessageList, {
        messages: [{
          id: 'assistant-1',
          role: 'assistant',
          content: '已读取工作区状态。',
          toolInvocations: [
            { toolName: 'get_workspace_status', state: 'result', result: { userId: 'student-1', safe: true } },
            { toolName: 'get_hints', state: 'result', result: { hint: '先看误差曲线' } },
          ],
          metadata: {
            konlingCitationGuard: {
              status: 'verified',
              citations: [{
                id: 'content:citation-1',
                sourceType: 'content',
                displayTitle: '课程资源',
                href: '/course-runtime/resources/unit.md#citation-1',
                confidence: 'high',
                evidenceBasis: 'source-pack',
              }],
            },
          },
        }],
      }),
    );

    expect(html).toContain('data-konling-chat-renderer="shared"');
    expect(html).toContain('data-konling-message-bubble="assistant"');
    expect(html).toContain('w-full max-w-none');
    expect(html).toContain('data-konling-tool-summary');
    expect(html).toContain('已调用 2 项辅助能力');
    expect(html).toContain('data-konling-citation-chip');
    expect(html).not.toContain('KonlingAvatar');
    expect(html).not.toContain('student-1');
  });

  it('keeps user messages compact and exports the 75 percent prompt input contract', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingChatMessageList, {
        messages: [{
          id: 'user-1',
          role: 'user',
          content: '解释根轨迹。',
        }],
      }),
    );

    expect(html).toContain('data-konling-message-bubble="user"');
    expect(html).toContain('max-w-[80%]');
    expect(konlingPromptInputClassName).toContain('flex-[0_1_75%]');
  });

  it('renders only the approved background optimization status copy', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingChatMessageList, {
        messages: [{
          id: 'assistant-optimizing',
          role: 'assistant',
          content: '基础回答',
          metadata: {
            konlingOptimizationActive: true,
            provider: 'hidden-provider',
            timeoutMs: 2500,
            traceId: 'hidden-trace',
          },
        }],
      }),
    );
    expect(html).toContain('data-konling-optimization-status');
    expect(html).toContain('正在后台优化响应');
    expect(html).not.toContain('hidden-provider');
    expect(html).not.toContain('2500');
    expect(html).not.toContain('hidden-trace');
  });

  it('restores a structured smart-preparation action card from persisted message metadata', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingChatMessageList, {
        messages: [{
          id: 'assistant-action',
          role: 'assistant',
          content: '',
          metadata: {
            konlingSmartPreparationActions: [{
              actionId: 'suggestion-private',
              operation: 'revise',
              taskId: 'task-private',
              state: 'pending',
              proposal: {
                topic: '闭环稳定性',
                audience: '本科生',
                prerequisitesChanged: true,
                prerequisites: '已掌握拉普拉斯变换',
                durationMinutes: 45,
                outlineConfirmationRequiredChanged: true,
                outlineConfirmationRequired: true,
                courseBasis: '自动控制原理',
                sources: ['课程讲义 v3'],
                knowledgePoints: ['稳定性'],
                goals: ['判断稳定性'],
                textbookRanges: [],
              },
            }],
          },
        }],
        onStructuredAction: async () => ({ state: 'applied' as const, message: '已应用。' }),
      }),
    );

    expect(html).toContain('data-konling-structured-action-card');
    expect(html).toContain('控灵建议修订备课任务');
    expect(html).toContain('主题：闭环稳定性');
    expect(html).toContain('前置知识：已掌握拉普拉斯变换');
    expect(html).toContain('大纲确认：生成前需要确认');
    expect(html).toContain('课程依据：自动控制原理');
    expect(html).toContain('资料来源：课程讲义 v3');
    expect(html).toContain('应用');
    expect(html).toContain('忽略');
    expect(html).not.toContain('suggestion-private');
    expect(html).not.toContain('session-private');
    expect(html).toContain('稳定性');
    expect(html).toContain('判断稳定性');
  });

  it('renders a persisted terminal action without rerunning or exposing action controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingChatMessageList, {
        messages: [{
          role: 'assistant',
          metadata: {
            konlingSmartPreparationActions: [{
              actionId: 'suggestion-1',
              operation: 'bootstrap',
              state: 'applied',
              proposal: { topic: '根轨迹' },
            }],
          },
        }],
      }),
    );

    expect(html).toContain('data-action-state="applied"');
    expect(html).toContain('已创建备课任务');
    expect(html).not.toContain('>应用<');
    expect(html).not.toContain('>忽略<');
  });

  it('shows readable replacement content and terminal recovery actions without raw payloads', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingChatMessageList, {
        messages: [{
          role: 'assistant',
          metadata: {
            konlingSmartPreparationActions: [{
              actionId: 'action-private',
              operation: 'revise',
              taskId: 'task-private',
              state: 'conflict',
              proposal: {
                topic: '频域稳定裕度',
                selectedClassChanged: true,
                selectedClassLabel: '已调整',
                textbookRanges: [{ level: 'SECTION', structuralPath: ['第3章', '3.2 稳定裕度'] }],
                knowledgePoints: ['相角裕度', '幅值裕度'],
                goals: ['能够解释两类稳定裕度的差异'],
              },
            }],
          },
        }],
        onStructuredAction: async () => ({ state: 'conflict' as const, message: '仍有冲突。' }),
      }),
    );

    expect(html).toContain('频域稳定裕度');
    expect(html).toContain('相角裕度');
    expect(html).toContain('幅值裕度');
    expect(html).toContain('3.2 稳定裕度');
    expect(html).toContain('刷新任务');
    expect(html).toContain('重新生成建议');
    expect(html).not.toContain('action-private');
    expect(html).not.toContain('task-private');
    expect(html).not.toContain('{&quot;');
  });

  it('labels citation diagnostics as development-mode diagnostics', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingCitationPanel, {
        metadata: {
          konlingCitationGuard: {
            status: 'verified',
            diagnosticReasons: ['assistant-citations-unverified-stream'],
            citations: [{
              sourceType: 'content',
              displayTitle: '流式预检来源',
              href: '/course-runtime/resources/textbooks/control/ch02.md#time-constant',
              confidence: 'high',
              evidenceBasis: 'source-pack',
            }],
          },
        },
      }),
    );

    expect(html).toContain('data-konling-citation-diagnostics');
    expect(html).toContain('开发模式诊断：assistant-citations-unverified-stream');
  });

  it('redacts internal context fields used by expanded tool result previews', () => {
    const expandedText = sanitizeKonlingToolResultPreview({
      id: 'kg-node-secret',
      nodeId: 'node-secret',
      graphNodeId: 'graph-node-secret',
      candidateId: 'candidate-secret',
      trace_id: 'trace-secret',
      nodeIds: ['node-list-secret'],
      nextNodeIds: ['next-node-secret'],
      completedNodeIds: ['completed-node-secret'],
      terminalValidationNodeIds: ['terminal-node-secret'],
      knowledgeNodeIds: ['knowledge-node-secret'],
      userId: 'student-1',
      studentId: 'student-2',
      classId: 'class-secret',
      courseId: 'course-secret',
      pageId: 'page-secret',
      pathNodeId: 'path-secret',
      resourceId: 'resource-secret',
      goalId: 'goal-secret',
      prepPackId: 'prep-secret',
      citation: 'citation-secret',
      payload: { raw: 'raw-secret' },
      safeSummary: '可见摘要',
      readinessSummary: {
        message: '可以展示的准备摘要',
      },
      valid: true,
    });

    expect(expandedText).toContain('可见摘要');
    expect(expandedText).toContain('可以展示的准备摘要');
    expect(expandedText).toContain('"valid": true');
    [
      'kg-node-secret',
      'node-secret',
      'graph-node-secret',
      'candidate-secret',
      'trace-secret',
      'node-list-secret',
      'next-node-secret',
      'completed-node-secret',
      'terminal-node-secret',
      'knowledge-node-secret',
      'student-1',
      'student-2',
      'class-secret',
      'course-secret',
      'page-secret',
      'path-secret',
      'resource-secret',
      'goal-secret',
      'prep-secret',
      'citation-secret',
      'raw-secret',
    ].forEach((value) => {
      expect(expandedText).not.toContain(value);
    });
  });
});
