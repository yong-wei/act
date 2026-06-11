import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DiagnosisSurfacePanel } from '@/features/adaptive/diagnosis-surface-panel';
import type { RoleBasedLearningDiagnosis } from '@/lib/data-governance/role-based-learning-diagnosis';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

const baseDiagnosis: RoleBasedLearningDiagnosis = {
  version: 'role-based-learning-diagnosis.v1',
  view: 'student',
  goalId: 'control-correction',
  generatedAt: '2026-06-11T00:00:00.000Z',
  materialization: {
    version: 'role-based-learning-diagnosis.v1',
    inputs: ['control-correction-diagnosis-report-snapshot'],
    refresh: 'on-evidence-change-or-request',
  },
  claims: [{
    id: 'claim-1',
    dimensionId: 'timeDomainAnalysis',
    judgment: 'developing',
    studentExplanation: '时域指标理解正在形成，需要结合证据继续练习。',
    teacherExplanation: '该维度需要按证据覆盖判断干预优先级。',
    rootCause: '终端验证证据尚不稳定。',
    evidenceRefs: [{
      chunkId: 'evidence-1',
      sourceType: 'diagnosis',
      displayTitle: '二阶对象诊断摘要',
      displayHref: '/profile/evidence',
      confidence: 'medium',
      capsule: '调节时间证据可见，原始作答已脱敏。',
      citationChip: {
        chunkId: 'evidence-1',
        displayTitle: '二阶对象诊断摘要',
        displayHref: '/profile/evidence',
        sourceType: 'diagnosis',
        authorityLevel: 'verified',
        confidence: 'medium',
        freshnessBucket: 'current',
        privacyVisibility: 'redacted',
        limitationState: null,
      },
    }],
    sourceCoverage: { diagnosis: 'ready' },
    metrics: {
      score: 0.66,
      percentile: {
        state: 'available',
        percentile: 72,
        sampleSize: 16,
        fallback: 'none',
      },
      growthPercentile: {
        state: 'available',
        percentile: 64,
        sampleSize: 12,
        fallback: 'none',
      },
    },
    confidence: {
      state: 'medium',
      score: 0.66,
      evidenceCount: 1,
      sourceCompleteness: 0.8,
    },
    evidenceWindow: {
      generatedAt: '2026-06-11T00:00:00.000Z',
      sourceLastUpdatedAt: '2026-06-10T00:00:00.000Z',
      stale: false,
    },
    limitations: [],
    nextActions: [{
      kind: 'learning-path',
      label: '继续当前学习路径',
      href: '/assessment/adaptive-practice',
    }],
    privacyClass: 'student-visible',
    materializationVersion: 'role-based-learning-diagnosis.v1',
  }],
  limitations: [],
  rootCauseClusters: [],
  drilldownRefs: [],
  auditRefs: [],
  redactionPolicy: {
    rawPayloads: 'omitted',
    ordinaryViews: 'redacted-summaries-only',
  },
};

describe('DiagnosisSurfacePanel', () => {
  it('renders a student diagnosis with evidence and next action without raw private text', () => {
    const html = renderToStaticMarkup(
      React.createElement(DiagnosisSurfacePanel, {
        diagnosis: baseDiagnosis,
        mode: 'student',
        title: '控制校正个人诊断',
      })
    );

    expect(html).toContain('控制校正个人诊断');
    expect(html).toContain('证据抽屉');
    expect(html).toContain('二阶对象诊断摘要');
    expect(html).toContain('66%');
    expect(html).toContain('P72');
    expect(html).toContain('成长 P64');
    expect(html).toContain('继续当前学习路径');
    expect(html).not.toMatch(/rawDialogue|private Konling memory|studentAnswer/i);
  });

  it('renders teacher class clusters and prep-pack readiness from role-projected diagnosis', () => {
    const diagnosis: RoleBasedLearningDiagnosis = {
      ...baseDiagnosis,
      view: 'teacher-class',
      rootCauseClusters: [{
        id: 'cluster-1',
        dimensionId: 'simulationValidation',
        label: '仿真终端验证证据不足。',
        affectedPopulation: 4,
        denominator: 12,
        confidence: 'medium',
        evidenceCoverage: {
          ready: 4,
          stale: 1,
          missing: 5,
          lowConfidence: 2,
        },
        interventionPriority: 'medium',
        drilldownRefs: [{ kind: 'student-consultation', userId: 'student-1', href: '/teacher/classes/class-1/students/student-1' }],
      }],
    };

    const html = renderToStaticMarkup(
      React.createElement(DiagnosisSurfacePanel, {
        diagnosis,
        mode: 'teacher-class',
        title: '控制校正班级诊断',
      })
    );

    expect(html).toContain('控制校正班级诊断');
    expect(html).toContain('弱点聚类与备课入口');
    expect(html).toContain('备课可准备');
    expect(html).toContain('影响人数');
  });

  it('renders degraded state when no governed snapshot is available', () => {
    const diagnosis: RoleBasedLearningDiagnosis = {
      ...baseDiagnosis,
      materialization: {
        ...baseDiagnosis.materialization,
        inputs: [],
      },
      limitations: [{
        reason: 'missing-snapshot',
        detail: 'No governed diagnosis report snapshot was supplied.',
      }],
      claims: [{
        ...baseDiagnosis.claims[0],
        judgment: 'insufficient-evidence',
        evidenceRefs: [],
        limitations: [{
          reason: 'missing-citation',
          detail: 'No accessible governed citation was found.',
        }],
      }],
    };

    const html = renderToStaticMarkup(
      React.createElement(DiagnosisSurfacePanel, {
        diagnosis,
        mode: 'teacher-student',
        title: '学生钻取诊断',
      })
    );

    expect(html).toContain('当前诊断处于降级状态');
    expect(html).toContain('诊断快照缺失');
    expect(html).toContain('当前角色没有可展示的证据引用');
  });
});
