import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SarDiagnosticsPanel } from '../data-governance-dashboard';
import type { SarDiagnosticsReport } from '@/lib/data-governance/sar-diagnostics';
import type { SarRefreshHealth } from '@/lib/data-governance/sar-refresh';

function reportWithPrivateTrace(): SarDiagnosticsReport {
  return {
    generatedAt: '2026-06-30T10:00:00.000Z',
    totals: {
      eventCount: 12,
      entityCount: 8,
      relationCount: 15,
      queryCount: 2,
      averageHopCount: 2.5,
      privacyRejectionCount: 3,
      limitationCount: 2,
      sourcePackHandoffCount: 4,
      verifiedCitationRate: 0.75,
      sarCandidateAdoptionCount: 5,
      sarCandidateRejectionCount: 1,
    },
    eventTypeCounts: { learning_fact: 5, resource: 7 },
    sourceOwnerCounts: { graph: 6, evidence: 4 },
    privacyScopeCounts: { admin: 7, teacher: 5 },
    authorityLevelCounts: { verified: 6, candidate: 6 },
    limitationCounts: { private_scope: 2 },
    queryTraceSummaries: [
      {
        id: 'trace-safe',
        query: 'control-correction diagnosis',
        hopCount: 2,
        selectedEventCount: 4,
        selectedEntityCount: 3,
        rejectedRefCount: 2,
        privacyRejectionCount: 1,
        limitationCount: 1,
        sourcePackHandoffCount: 2,
        verifiedCitationRate: 0.5,
      },
    ],
    serializedTraces: [
      {
        id: 'trace-redacted',
        seedEntityIds: ['student-redacted'],
        expandedEntityIds: ['goal-control-correction'],
        selectedEventIds: ['event-safe'],
        selectedRefs: ['resource-safe'],
        rejectedRefs: [{ ref: 'private raw answer', reason: 'private-scope' }],
        limitations: ['hiddenArenaEvaluationInternalsPayload'],
        versionRefs: ['private Konling memory'],
        downstream: {
          sourcePackHandoffRefs: ['source-pack-safe'],
          verifiedCitationRefs: ['citation-safe'],
          verifiedCitationRate: 1,
        },
        events: [],
        entities: [],
      },
    ],
    comparison: {
      ordinarySourcePackRefCount: 3,
      sarAssistedRefCount: 5,
      adoptedRefCount: 4,
      rejectedRefCount: 1,
    },
    demoFixtureStatus: {
      id: 'control-correction-demo',
      deterministic: true,
      query: 'control-correction demo',
      sourcePackHandoff: true,
      verifiedCitationOutcome: 'available',
    },
  };
}

function refreshHealthWithPrivateLimitations(): SarRefreshHealth {
  return {
    generatedAt: '2026-06-30T10:01:00.000Z',
    status: 'degraded',
    lastAttemptedAt: '2026-06-30T10:01:00.000Z',
    lastSuccessfulAt: '2026-06-30T10:01:00.000Z',
    totals: {
      sourceFamilyCount: 8,
      projectedEventCount: 5,
      projectedEntityCount: 6,
      projectedRelationCount: 10,
      staleSourceCount: 1,
      failureCount: 0,
    },
    sources: [
      {
        family: 'arena-official',
        status: 'degraded',
        sourceVersion: 'control-correction-sar-refresh.v1',
        highWaterMark: '2026-06-30T10:01:00.000Z',
        lastAttemptedAt: '2026-06-30T10:01:00.000Z',
        lastSuccessfulAt: '2026-06-30T10:01:00.000Z',
        projectedEventCount: 0,
        projectedEntityCount: 0,
        projectedRelationCount: 0,
        staleCount: 1,
        failureCount: 0,
        retryState: 'retry-scheduled',
        limitations: ['restricted-health-detail-redacted'],
      },
    ],
    limitations: [
      'restricted-health-detail-redacted',
      'private raw answer',
      'hiddenArenaEvaluationInternalsPayload',
      'private Konling memory',
    ],
  };
}

describe('SAR diagnostics admin panel', () => {
  it('renders aggregate SAR diagnostics and trace summaries', () => {
    const html = renderToStaticMarkup(createElement(SarDiagnosticsPanel, { report: reportWithPrivateTrace() }));

    expect(html).toContain('data-admin-sar-diagnostics=\"available\"');
    expect(html).toContain('SAR 诊断');
    expect(html).toContain('Source Pack 交接');
    expect(html).toContain('Verified citation rate');
    expect(html).toContain('75.0%');
    expect(html).toContain('SAR candidate adopted');
    expect(html).toContain('SAR candidate rejected');
    expect(html).toContain('SAR-assisted refs');
    expect(html).toContain('control-correction diagnosis');
    expect(html).toContain('2（隐私 1） / 1');
    expect(html).toContain('control-correction-demo');
  });

  it('renders SAR refresh health without raw private limitation strings', () => {
    const html = renderToStaticMarkup(createElement(SarDiagnosticsPanel, {
      report: reportWithPrivateTrace(),
      refreshHealth: refreshHealthWithPrivateLimitations(),
    }));

    expect(html).toContain('data-admin-sar-refresh-health=\"degraded\"');
    expect(html).toContain('SAR 投影刷新');
    expect(html).toContain('arena-official');
    expect(html).toContain('retry-scheduled');
    expect(html).toContain('[redacted]');
    expect(html).not.toContain('private raw answer');
    expect(html).not.toContain('hiddenArenaEvaluationInternalsPayload');
    expect(html).not.toContain('private Konling memory');
  });

  it('renders an explicit degraded state when SAR diagnostics are absent', () => {
    const html = renderToStaticMarkup(createElement(SarDiagnosticsPanel, { report: null }));

    expect(html).toContain('data-admin-sar-diagnostics=\"unavailable\"');
    expect(html).toContain('data-admin-sar-diagnostics-state=\"degraded\"');
    expect(html).toContain('SAR 诊断不可用');
  });

  it('does not render raw private trace payload strings', () => {
    const html = renderToStaticMarkup(createElement(SarDiagnosticsPanel, { report: reportWithPrivateTrace() }));

    expect(html).not.toContain('private raw answer');
    expect(html).not.toContain('hiddenArenaEvaluationInternalsPayload');
    expect(html).not.toContain('private Konling memory');
  });

  it.each([
    'private raw answer',
    'hiddenArenaEvaluationInternalsPayload',
    'private Konling memory',
  ])('redacts forbidden visible demo fixture text: %s', (query) => {
    const report = reportWithPrivateTrace();
    report.demoFixtureStatus = {
      id: report.demoFixtureStatus?.id ?? 'control-correction-demo',
      deterministic: report.demoFixtureStatus?.deterministic ?? true,
      sourcePackHandoff: report.demoFixtureStatus?.sourcePackHandoff ?? true,
      verifiedCitationOutcome: report.demoFixtureStatus?.verifiedCitationOutcome ?? 'available',
      query,
    };
    const html = renderToStaticMarkup(createElement(SarDiagnosticsPanel, { report }));

    expect(html).toContain('[redacted]');
    expect(html).not.toContain(query);
  });

  it('renders SAR live evaluation report metrics without restricted record content', () => {
    const report = reportWithPrivateTrace();
    report.liveEvaluation = {
      generatedAt: '2026-07-02T09:00:00.000Z',
      querySet: [{
        id: 'trace-safe',
        query: 'control-correction diagnosis',
        ordinaryRetrievalBaselineRefCount: 1,
        ordinaryRetrievalBaselineRefs: ['chunk:source-pack:frequency-margin'],
        sarCandidateRefCount: 2,
        sarCandidateRefs: ['chunk:source-pack:frequency-margin', 'planning-unit:persisted-sar-candidate'],
        sarOnlyCandidateRefCount: 1,
        sarOnlyCandidateRefs: ['planning-unit:persisted-sar-candidate'],
        citationTargetRefCount: 2,
        citationTargetRefs: ['citation-target:persisted-direct-candidate', 'citation:persisted-arena-official'],
        verifiedCitationRefCount: 1,
        verifiedCitationRefs: ['citation:persisted-arena-official'],
        verifiedCitationRate: 0.5,
        sourcePackHandoffRefCount: 2,
        sourcePackHandoffRefs: ['chunk:source-pack:frequency-margin', 'planning-unit:persisted-sar-candidate'],
        adoptedCandidateRefs: ['planning-unit:persisted-sar-candidate'],
        rejectedCandidateRefs: [{ ref: '[redacted]', reason: '[redacted]' }],
        multiHopHit: true,
        privacyRejectionCount: 1,
        limitationCount: 1,
      }],
      metrics: {
        queryCount: 1,
        ordinaryRetrievalBaselineRefCount: 1,
        sarCandidateRefCount: 2,
        sarOnlyCandidateRefCount: 1,
        citationTargetRefCount: 2,
        verifiedCitationRefCount: 1,
        verifiedCitationRate: 0.5,
        sourcePackHandoffRefCount: 2,
        privacyRejectionCount: 1,
        limitationCount: 2,
        feedbackRecordCount: 2,
        multiHopHitRate: 1,
      },
      baselineComparison: {
        ordinaryRetrievalBaselineRefCount: 1,
        sarCandidateRefCount: 2,
        sarOnlyCandidateRefCount: 1,
        citationTargetRefCount: 2,
        verifiedCitationRefCount: 1,
        verifiedCitationRate: 0.5,
      },
      evaluationRecords: [
        {
          id: 'safe-record',
          kind: 'structured-test',
          actorRole: 'admin',
          task: '检查治理报告导出',
          expectedEvidence: '只展示安全摘要',
          observedResult: '候选和正式引用被分开计数',
          limitation: '样本有限',
        },
        {
          id: '[redacted]',
          kind: 'target-user-feedback',
          actorRole: 'teacher',
          task: '[redacted]',
          expectedEvidence: '[redacted]',
          observedResult: '[redacted]',
          limitation: '[redacted]',
        },
      ],
      limitations: ['arena-auxiliary-evidence-context-only', '[redacted]'],
      privacyBoundary: {
        restrictedRawContentExcluded: true,
        candidateRefsAreVerifiedCitations: false,
        exportedFields: ['querySet', 'metrics'],
      },
      arenaOfficialAuthority: {
        status: 'available',
        officialMetricSources: {
          score: 'ArenaSubmission',
          validity: 'ArenaSubmission',
          ranking: 'ArenaSubmission',
          attemptPolicy: 'ArenaSubmission',
          evaluationMetrics: 'ArenaEvaluationRun',
        },
        officialSources: ['ArenaEvaluationRun', 'ArenaSubmission'],
        auxiliarySources: ['KAQWriteback', 'LearningFact', 'SARTrace'],
        officialRecordSummary: {
          submissionCount: 1,
          evaluationRunCount: 1,
          latestSubmissionAt: '2026-07-02T08:55:00.000Z',
          latestEvaluationCompletedAt: '2026-07-02T08:58:00.000Z',
        },
        limitations: ['arena-auxiliary-evidence-context-only'],
      },
    };
    const html = renderToStaticMarkup(createElement(SarDiagnosticsPanel, { report }));

    expect(html).toContain('SAR live evaluation');
    expect(html).toContain('Baseline refs');
    expect(html).toContain('SAR candidates');
    expect(html).toContain('Verified citation rate');
    expect(html).toContain('50.0%');
    expect(html).toContain('100.0%');
    expect(html).toContain('ArenaSubmission');
    expect(html).toContain('ArenaEvaluationRun');
    expect(html).toContain('检查治理报告导出');
    expect(html).not.toContain('private raw answer');
    expect(html).not.toContain('hiddenArenaEvaluationInternalsPayload');
    expect(html).not.toContain('private Konling memory');
  });
});
