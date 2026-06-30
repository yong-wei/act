import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SarDiagnosticsPanel } from '../data-governance-dashboard';
import type { SarDiagnosticsReport } from '@/lib/data-governance/sar-diagnostics';

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
    expect(html).toContain('control-correction-demo');
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
    report.demoFixtureStatus = { ...report.demoFixtureStatus, query };
    const html = renderToStaticMarkup(createElement(SarDiagnosticsPanel, { report }));

    expect(html).toContain('[redacted]');
    expect(html).not.toContain(query);
  });
});
