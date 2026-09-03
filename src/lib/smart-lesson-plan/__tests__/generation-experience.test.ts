import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { publicJob } from '@/app/api/teacher/smart-lesson-tasks/_shared';
import { GeneratedStageContent } from '@/features/teacher/smart-lesson-plan-workspace';

describe('smart lesson generation experience', () => {
  it('projects the exact seven teaching stages and nine localized action labels', () => {
    const kinds = ['OUTLINE', 'BRIDGE_IN', 'OBJECTIVES', 'PRE_ASSESSMENT', 'PARTICIPATORY_LEARNING', 'POST_ASSESSMENT', 'SUMMARY'];
    const actionStates = ['WAITING', 'PREPARING_EVIDENCE', 'GENERATING', 'VALIDATING', 'AUTO_FIXING', 'WAITING_CONFIRMATION', 'RETRYABLE'];
    const projected = publicJob({
      id: 'job-1',
      draftId: 'draft-1',
      state: 'RUNNING',
      stages: kinds.map((kind, index) => ({
        id: `stage-${index}`,
        kind,
        orderIndex: index,
        state: index === 6 ? 'COMPLETED' : 'RUNNING',
        actionState: index === 6 ? 'COMPLETED' : actionStates[index],
        output: index === 6 ? { steps: [] } : null,
      })),
    }) as { stages: Array<{ title: string; actionLabel: string }> };

    expect(projected.stages.map((stage) => stage.title)).toEqual([
      '提纲', '导入', '学习目标', '前测', '参与式学习', '后测', '总结',
    ]);
    expect(projected.stages.map((stage) => stage.actionLabel)).toEqual([
      '等待开始', '正在准备依据', '正在生成', '正在校验', '正在自动修正', '等待教师确认', '已完成',
    ]);
    expect(publicJob({
      id: 'job-2',
      draftId: 'draft-2',
      state: 'CANCELLED',
      stages: [{ id: 'stage-1', kind: 'OUTLINE', state: 'CANCELLED', actionState: 'CANCELLED' }],
    })).toMatchObject({ stages: [{ actionLabel: '已取消' }] });
    expect(publicJob({
      id: 'job-3',
      draftId: 'draft-3',
      state: 'RETRYABLE',
      stages: [{ id: 'stage-1', kind: 'OUTLINE', state: 'RETRYABLE', actionState: 'RETRYABLE' }],
    })).toMatchObject({ stages: [{ actionLabel: '可重试' }] });
  });

  it('shows only completed validated output and localizes unknown failures without raw payloads', () => {
    const projected = publicJob({
      id: 'job-1',
      draftId: 'draft-1',
      state: 'RETRYABLE',
      failureCode: { providerPayload: 'secret-provider-stack' },
      stages: [{
        id: 'stage-1',
        kind: 'OUTLINE',
        state: 'RUNNING',
        output: { providerPayload: 'partial-secret' },
      }],
    });
    expect(JSON.stringify(projected)).not.toContain('secret-provider-stack');
    expect(JSON.stringify(projected)).not.toContain('partial-secret');

    const stringFailure = publicJob({
      id: 'job-2',
      draftId: 'draft-2',
      state: 'RETRYABLE',
      failureCode: 'ProviderError: upstream rejected payload\n    at secret-provider-stack',
      stages: [],
    });
    expect(stringFailure).not.toHaveProperty('failureCode');
    expect(stringFailure).toMatchObject({
      failureMessage: '当前阶段未能完成，请重试；若问题持续存在，请联系管理员。',
    });
    expect(JSON.stringify(stringFailure)).not.toContain('secret-provider-stack');
    expect(JSON.stringify(stringFailure)).not.toContain('upstream rejected payload');
  });

  it('polls only jobs that can advance without teacher action and renders stage content without JSON serialization', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/teacher/smart-lesson-plan-workspace.tsx'),
      'utf8',
    );
    expect(source).toContain("!SMART_JOB_ACTIVE_STATES.includes(activeJobState");
    expect(source).not.toContain("!['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(activeJobState)");
    expect(source).toContain('<GeneratedStageContent');
    expect(source).not.toContain('JSON.stringify(stage.output');
  });

  it('renders every validated outline and BOPPPS teaching field as visible text', () => {
    const outline = renderToStaticMarkup(createElement(GeneratedStageContent, {
      title: '提纲',
      value: {
        keyContent: ['核心知识'],
        difficultContent: ['教学难点'],
        limitations: ['样本数量有限'],
        classAdaptation: { aggregateContextRef: 'diagnosis-1', emphasis: ['加强形成性评价'] },
        coursewareStepOutline: [{
          title: '课堂导入',
          bopppsStage: 'bridgeIn',
          minutes: 5,
        }],
      },
    }));
    expect(outline).toContain('核心知识');
    expect(outline).toContain('教学难点');
    expect(outline).toContain('样本数量有限');
    expect(outline).toContain('加强形成性评价');
    expect(outline).toContain('课堂导入');
    expect(outline).toContain('BOPPPS 阶段：');
    expect(outline).toContain('5 分钟');

    const boppps = renderToStaticMarkup(createElement(GeneratedStageContent, {
      title: '参与式学习',
      value: {
        minutes: 12,
        teacherActivity: '组织讨论',
        studentActivity: '小组分析',
        assessment: '检查推理过程',
        steps: [{
          title: '参数分析',
          minutes: 12,
          teacherActivity: '提供案例',
          studentActivity: '计算并汇报',
          assessment: '核对判据',
          sourceBindings: [{ citationId: 'citation-1' }],
        }],
      },
    }));
    [
      '阶段总时长：', '组织讨论', '小组分析', '检查推理过程',
      '参数分析', '提供案例', '计算并汇报', '核对判据', 'citation-1',
    ].forEach((text) => expect(boppps).toContain(text));
  });
});
