import { createPrismaClient } from '../../src/lib/prisma-client';

import { collectSessionDataQualityReport } from '@/lib/data-governance/session-data-quality-report';
import { parseSessionDataQualityReportOptions } from './session-data-quality-report-options';

const prisma = createPrismaClient();

function printTextReport(report: Awaited<ReturnType<typeof collectSessionDataQualityReport>>) {
  console.log(`Session data-quality report (${report.generatedAt})`);
  console.log(`Sessions: ${report.totals.sessions}`);
  console.log(`Participants: ${report.totals.participants}`);
  console.log(`Durable submissions: ${report.totals.durableSubmissions}`);
  console.log(`Answers: ${report.totals.answerAvailableRows}/${report.totals.durableSubmissions}`);
  console.log(`Scores: ${report.totals.scoreAvailableRows}/${report.totals.durableSubmissions}`);
  console.log(`Question summaries: ${report.totals.questionSummaryAvailableRows}/${report.totals.durableSubmissions}`);
  console.log(`Sync errors/incidents: ${report.totals.rawSyncErrors}/${report.totals.syncIncidents}`);

  for (const session of report.sessions) {
    const coverage = session.submissionCoverage;
    const readiness = session.readinessMetrics;
    console.log('');
    console.log(`${session.sessionId} · ${session.lessonKeys.join(', ') || '-'} · ${session.planTitle}`);
    console.log(`  participants: ${session.participants}, logs: ${session.interactionLogs}, facts: ${session.learningFacts}`);
    console.log(`  submissions: ${coverage.totalRows}, answers: ${coverage.answerAvailableRows}, scores: ${coverage.scoreAvailableRows}, questionSummaries: ${coverage.questionSummaryAvailableRows}`);
    console.log(`  durableSubmissionCoverage: ${readiness.durableSubmissionCoverage.submittedParticipants}/${readiness.durableSubmissionCoverage.expectedParticipants}, coverage=${readiness.durableSubmissionCoverage.coverage ?? '-'}`);
    console.log(`  requiredEvidenceCoverage: ${readiness.requiredEvidenceCoverage.availableRows}/${readiness.requiredEvidenceCoverage.submittedRows}, coverage=${readiness.requiredEvidenceCoverage.coverage ?? '-'}`);
    console.log(`  scoreableEvidenceCoverage: ${readiness.scoreableEvidenceCoverage.scoreableRows}/${readiness.scoreableEvidenceCoverage.submittedRows}, coverage=${readiness.scoreableEvidenceCoverage.coverage ?? '-'}`);
    console.log(`  scoringCoverage: ${readiness.scoringCoverage.scoredRows}/${readiness.scoringCoverage.scoreableRows}, coverage=${readiness.scoringCoverage.coverage ?? '-'}`);
    console.log(`  evidenceQuality: ${JSON.stringify(coverage.evidenceQualityCounts)}`);
    console.log(`  reports: class=${session.reportFreshness.classReportAvailable ? 'ready' : 'missing'}, students=${session.reportFreshness.studentReportCount}/${session.reportFreshness.expectedStudentReports}, fresh=${session.reportFreshness.classReportFresh && session.reportFreshness.studentReportsFresh}`);
    console.log(`  snapshotCoverage: ${session.snapshotCoverage.coveredParticipants}/${session.snapshotCoverage.expectedParticipants}, fresh=${session.snapshotCoverage.fresh}`);
    console.log(`  postClassUpdateWindow: ${session.postClassUpdateWindowCoverage.updatedParticipants}/${session.postClassUpdateWindowCoverage.expectedParticipants}, fresh=${session.postClassUpdateWindowCoverage.fresh}`);
    console.log(`  featureCacheFreshness: latestFacts=${session.featureCacheFreshness.latestFactCoveredParticipants}/${session.featureCacheFreshness.expectedParticipantsWithFacts}, postClass=${session.featureCacheFreshness.postClassRefreshedParticipants}/${session.featureCacheFreshness.expectedParticipants}, fresh=${session.featureCacheFreshness.fresh}, evaluated=${session.featureCacheFreshness.evaluated}`);
    console.log(`  closure: captured=${session.postClassClosure.captured.complete}, materialized=${session.postClassClosure.materialized.complete}, summarized=${session.postClassClosure.summarized.complete}, cached=${session.postClassClosure.cached.complete}`);
    console.log(`  sync: raw=${session.syncQuality.rawSyncErrors}, incidents=${session.syncQuality.incidentCount}, affectedUsers=${session.syncQuality.affectedUsers}, dominant=${session.syncQuality.dominantSource ?? '-'}/${session.syncQuality.dominantFailureKind ?? '-'}, severity=${session.syncQuality.severityClassification}`);
    console.log(`  qualityStatus: ${session.qualityStatus.status}, reasons=${session.qualityStatus.reasons.join(',') || '-'}`);
  }
}

async function main() {
  const options = parseSessionDataQualityReportOptions(process.argv);
  const report = await collectSessionDataQualityReport(prisma, options.filters);

  if (options.json) {
    console.log(JSON.stringify(report, null, options.compact ? 0 : 2));
  } else {
    printTextReport(report);
  }
}

main()
  .catch((error) => {
    console.error('[SessionDataQuality] Report failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
