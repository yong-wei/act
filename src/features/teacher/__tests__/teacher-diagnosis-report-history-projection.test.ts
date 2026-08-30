import { describe, expect, it } from 'vitest';

import type { DiagnosisReportApiItem } from '@/features/teacher/diagnosis/public-api';
import {
  compareAdjacentReports,
  projectReportHistoryCard,
} from '@/features/teacher/teacher-diagnosis-report-history-projection';

const baseline: DiagnosisReportApiItem = {
  id: 'report-older',
  scopeType: 'class',
  scopeId: 'class-1',
  classId: 'class-1',
  targetUserId: null,
  reportBody: {
    summary: '旧摘要。',
    findings: [{
      title: '稳定裕度判断',
      knowledgeNodeId: 'node-margin',
      riskType: 'constraint',
      severity: 'high',
      evidenceRefs: ['knowledge-progress:progress-1'],
    }],
    evidenceRefs: ['student-competency-snapshot:snapshot-1'],
    evidenceCutoff: '2026-08-01T08:00:00.000Z',
    sourceCoverage: { classMembers: 30, includedStudents: 20, coverage: 2 / 3 },
    confidence: 'medium',
    limitations: ['no-knowledge-progress-evidence'],
  },
  riskSummary: {
    total: 1,
    byType: { stagnation: 0, constraint: 1, cross_domain: 0 },
    bySeverity: { low: 0, medium: 0, high: 1 },
  },
  evidenceCutoff: '2026-08-01T08:00:00.000Z',
  generatorVersion: 'teacher-diagnosis.v1',
  generatedAt: '2026-08-01T08:05:00.000Z',
};

describe('teacher diagnosis report history projection', () => {
  it('keeps unsupported top-level sources unavailable instead of fabricating zero coverage', () => {
    const projection = projectReportHistoryCard(baseline);

    expect(projection.evidenceGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'assignment',
        state: 'unavailable',
        includedLabel: '未提供',
        missingLabel: '未提供',
      }),
      expect.objectContaining({
        id: 'assessment',
        state: 'unavailable',
        includedLabel: '未提供',
        missingLabel: '未提供',
      }),
      expect.objectContaining({
        id: 'learning-behavior',
        state: 'partial',
        includedLabel: '20 人',
        missingLabel: '10 人',
        detailSources: ['能力快照', '知识点学习进度'],
      }),
    ]));
    expect(projection.confidenceReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: '当前报告尚未纳入作业证据。' }),
      expect.objectContaining({ reason: '当前报告尚未纳入测验证据。' }),
      expect.objectContaining({ reason: '仅纳入 20/30 名学生的可用证据。' }),
    ]));
    expect(projection.declaredLimitations).toContain('没有可用的知识点学习进度证据。');
  });

  it('projects the governed generation reason instead of generic model prose', () => {
    expect(projectReportHistoryCard({
      ...baseline,
      generationReason: 'version-change',
      ruleVersion: 'teacher-diagnosis-preflight.v1',
    }).generationReason).toContain('预检规则升级');
    expect(projectReportHistoryCard({
      ...baseline,
      generationReason: 'teacher-forced',
      forceReason: '用于教学复盘会议留档',
    }).generationReason).toContain('用于教学复盘会议留档');
  });

  it('renders persisted assignment and assessment coverage when the report includes governed outcomes', () => {
    const projection = projectReportHistoryCard({
      ...baseline,
      reportBody: {
        ...baseline.reportBody,
        sourceCoverage: {
          ...baseline.reportBody.sourceCoverage,
          assignment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
          assessment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
        },
      },
    });

    expect(projection.evidenceGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'assignment', state: 'available', includedLabel: '100 人', missingLabel: '0 人' }),
      expect.objectContaining({ id: 'assessment', state: 'available', includedLabel: '100 人', missingLabel: '0 人' }),
    ]));
    expect(projection.confidenceReasons).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: '当前报告尚未纳入作业证据。' }),
      expect.objectContaining({ reason: '当前报告尚未纳入测验证据。' }),
    ]));
  });

  it('marks attribution limited only when a knowledge-progress finding lacks a node', () => {
    const projection = projectReportHistoryCard({
      ...baseline,
      reportBody: {
        ...baseline.reportBody,
        findings: [{
          title: '多数学生知识节点掌握停滞',
          evidenceRefs: ['knowledge-progress:progress-1'],
        }],
        limitations: [],
      },
    });

    expect(projection.attributionLimited).toBe(true);
    expect(projection.confidenceReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: '部分发现没有可核验的知识节点映射，不能作为精准知识薄弱点。',
        recoveryAction: '补全题目、错因与知识节点映射后，重新生成诊断。',
      }),
    ]));
  });

  it('does not mark overall risk or score-distribution findings as attribution limited', () => {
    const projection = projectReportHistoryCard({
      ...baseline,
      reportBody: {
        ...baseline.reportBody,
        findings: [
          {
            title: '部分学生存在学习进度受限风险',
            riskType: 'constraint',
            evidenceRefs: ['student-risk-flag:risk-1'],
          },
          {
            title: '低分段学生比例需关注',
            evidenceRefs: ['assignment-submission:submission-1'],
          },
        ],
        limitations: [],
      },
    });

    expect(projection.attributionLimited).toBe(false);
    expect(projection.confidenceReasons).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: '部分发现没有可核验的知识节点映射，不能作为精准知识薄弱点。',
      }),
    ]));
  });

  it('keeps complete mixed-finding coverage available when only non-node findings omit knowledgeNodeId', () => {
    const projection = projectReportHistoryCard({
      ...baseline,
      reportBody: {
        summary: '班级覆盖完整，总体风险与成绩分布不要求知识节点。',
        findings: [
          {
            title: '多数学生知识节点掌握停滞',
            knowledgeNodeId: '1',
            riskType: 'stagnation',
            evidenceRefs: ['knowledge-progress:progress-1'],
          },
          {
            title: '部分学生存在学习进度受限风险',
            riskType: 'constraint',
            evidenceRefs: ['student-risk-flag:risk-1'],
          },
          {
            title: '低分段学生比例需关注',
            evidenceRefs: ['assignment-submission:submission-1'],
          },
        ],
        evidenceRefs: [
          'knowledge-progress:progress-1',
          'student-risk-flag:risk-1',
          'assignment-submission:submission-1',
          'adaptive-assessment-session:session-1',
        ],
        evidenceCutoff: baseline.reportBody.evidenceCutoff,
        sourceCoverage: {
          classMembers: 100,
          includedStudents: 100,
          coverage: 1,
          assignment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
          assessment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
        },
        confidence: 'high',
        limitations: [],
      },
    });

    expect(projection.attributionLimited).toBe(false);
    expect(projection.declaredLimitations).toEqual([]);
    expect(projection.confidenceReasons).toEqual([]);
    expect(projection.availability.label).toBe('证据较充分');
    expect(projection.evidenceGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'assignment', state: 'available', includedLabel: '100 人', missingLabel: '0 人' }),
      expect.objectContaining({ id: 'assessment', state: 'available', includedLabel: '100 人', missingLabel: '0 人' }),
      expect.objectContaining({ id: 'learning-behavior', state: 'available', includedLabel: '100 人', missingLabel: '0 人' }),
    ]));
  });

  it('describes attribution-only reports as knowledge-node attribution limitation instead of coverage limitation', () => {
    const projection = projectReportHistoryCard({
      ...baseline,
      reportBody: {
        summary: '班级数据覆盖完整，但知识点发现缺少可核验的知识节点映射。',
        findings: [{
          title: '多数学生知识节点掌握停滞',
          evidenceRefs: ['knowledge-progress:progress-1'],
        }],
        evidenceRefs: ['knowledge-progress:progress-1'],
        evidenceCutoff: baseline.reportBody.evidenceCutoff,
        sourceCoverage: {
          classMembers: 100,
          includedStudents: 100,
          coverage: 1,
          assignment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
          assessment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
        },
        confidence: 'high',
        limitations: [],
      },
    });

    expect(projection.attributionLimited).toBe(true);
    expect(projection.confidenceReasons).toEqual([
      expect.objectContaining({
        reason: '部分发现没有可核验的知识节点映射，不能作为精准知识薄弱点。',
      }),
    ]);
    expect(projection.availability.label).toBe('知识节点归因受限');
    expect(projection.availability.recoveryAction).toBe('补全题目、错因与知识节点映射后，重新生成诊断。');
    expect(projection.availability.label).not.toBe('证据可用，但覆盖受限');
  });

  it('keeps the attribution-specific state out when the report declares an unmapped limitation text', () => {
    const projection = projectReportHistoryCard({
      ...baseline,
      reportBody: {
        summary: '班级数据覆盖完整，但存在声明限制且知识点发现缺少知识节点映射。',
        findings: [{
          title: '多数学生知识节点掌握停滞',
          evidenceRefs: ['knowledge-progress:progress-1'],
        }],
        evidenceRefs: ['knowledge-progress:progress-1'],
        evidenceCutoff: baseline.reportBody.evidenceCutoff,
        sourceCoverage: {
          classMembers: 100,
          includedStudents: 100,
          coverage: 1,
          assignment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
          assessment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
        },
        confidence: 'high',
        limitations: ['特定教材章节证据暂时缺失。'],
      },
    });

    expect(projection.attributionLimited).toBe(true);
    expect(projection.availability.label).not.toBe('知识节点归因受限');
    expect(projection.availability.label).toBe('证据可用，但覆盖受限');
  });

  it('keeps the attribution-specific state out when learning-behavior coverage is partial', () => {
    const projection = projectReportHistoryCard({
      ...baseline,
      reportBody: {
        summary: '学习行为覆盖比例未满，知识点发现缺少知识节点映射。',
        findings: [{
          title: '多数学生知识节点掌握停滞',
          evidenceRefs: ['knowledge-progress:progress-1'],
        }],
        evidenceRefs: ['knowledge-progress:progress-1'],
        evidenceCutoff: baseline.reportBody.evidenceCutoff,
        sourceCoverage: {
          classMembers: 100,
          includedStudents: 100,
          coverage: 0.9,
          assignment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
          assessment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
        },
        confidence: 'high',
        limitations: [],
      },
    });

    expect(projection.attributionLimited).toBe(true);
    expect(projection.evidenceGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'learning-behavior', state: 'partial' }),
    ]));
    expect(projection.availability.label).not.toBe('知识节点归因受限');
    expect(projection.availability.label).toBe('证据可用，但覆盖受限');
  });

  it('keeps the coverage-limited wording when attribution limitation coexists with real coverage gaps', () => {
    const projection = projectReportHistoryCard({
      ...baseline,
      reportBody: {
        summary: '班级仍有学生证据未纳入，且知识点发现缺少知识节点映射。',
        findings: [{
          title: '多数学生知识节点掌握停滞',
          evidenceRefs: ['knowledge-progress:progress-1'],
        }],
        evidenceRefs: ['knowledge-progress:progress-1'],
        evidenceCutoff: baseline.reportBody.evidenceCutoff,
        sourceCoverage: {
          classMembers: 100,
          includedStudents: 90,
          coverage: 0.9,
          assignment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
          assessment: {
            availability: 'available',
            includedStudents: 100,
            missingStudents: 0,
            evidenceCount: 100,
            scoredCount: 100,
          },
        },
        confidence: 'high',
        limitations: [],
      },
    });

    expect(projection.attributionLimited).toBe(true);
    expect(projection.confidenceReasons.length).toBeGreaterThan(1);
    expect(projection.availability.label).toBe('证据可用，但覆盖受限');
  });

  it('does not treat generated prose changes as learning changes when governed structure is unchanged', () => {
    const current: DiagnosisReportApiItem = {
      ...baseline,
      id: 'report-current',
      generatedAt: '2026-08-08T08:05:00.000Z',
      reportBody: {
        ...baseline.reportBody,
        summary: '完全不同的生成摘要。',
        findings: [{
          ...baseline.reportBody.findings[0],
          title: '模型重新措辞后的稳定裕度结论',
          summary: '模型改写说明，但没有改变受治理结构。',
        }],
      },
    };

    expect(compareAdjacentReports(current, baseline)).toMatchObject({
      state: 'ready',
      additions: 0,
      persistent: 1,
      improved: 0,
      riskEscalated: 0,
      riskDowngraded: 0,
    });
  });

  it('reports only comparable severity transitions and fails closed for incompatible structure versions', () => {
    const lowerRisk: DiagnosisReportApiItem = {
      ...baseline,
      id: 'report-lower-risk',
      reportBody: {
        ...baseline.reportBody,
        findings: [{ ...baseline.reportBody.findings[0], severity: 'low' }],
      },
    };
    const versionChanged = { ...lowerRisk, generatorVersion: 'teacher-diagnosis.v2' };

    expect(compareAdjacentReports(lowerRisk, baseline)).toMatchObject({
      state: 'ready',
      persistent: 1,
      improved: 1,
      riskDowngraded: 1,
    });
    expect(compareAdjacentReports(versionChanged, baseline)).toMatchObject({
      state: 'version-mismatch',
    });
    expect(compareAdjacentReports(lowerRisk)).toMatchObject({ state: 'no-baseline' });
  });

  it('does not report a downgrade or improvement when a matched finding lacks severity', () => {
    const current: DiagnosisReportApiItem = {
      ...baseline,
      id: 'report-missing-severity',
      reportBody: {
        ...baseline.reportBody,
        findings: [{
          ...baseline.reportBody.findings[0],
          severity: undefined,
        }],
      },
    };

    expect(compareAdjacentReports(current, baseline)).toMatchObject({
      state: 'ready',
      additions: 0,
      persistent: 1,
      improved: 0,
      riskEscalated: 0,
      riskDowngraded: 0,
      incomparableSeverityTransitions: 1,
    });
    expect(compareAdjacentReports(current, baseline).description).toContain('缺少风险等级');
  });
});
