import { PrismaClient } from '@prisma/client';

import { collectSessionDataQualityReport } from '@/lib/data-governance/session-data-quality-report';
import { parseSessionDataQualityReportOptions } from './session-data-quality-report-options';

const prisma = new PrismaClient();

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
    console.log('');
    console.log(`${session.sessionId} · ${session.lessonKeys.join(', ') || '-'} · ${session.planTitle}`);
    console.log(`  participants: ${session.participants}, logs: ${session.interactionLogs}, facts: ${session.learningFacts}`);
    console.log(`  submissions: ${coverage.totalRows}, answers: ${coverage.answerAvailableRows}, scores: ${coverage.scoreAvailableRows}, questionSummaries: ${coverage.questionSummaryAvailableRows}`);
    console.log(`  evidenceQuality: ${JSON.stringify(coverage.evidenceQualityCounts)}`);
    console.log(`  reports: class=${session.reportFreshness.classReportAvailable ? 'ready' : 'missing'}, students=${session.reportFreshness.studentReportCount}/${session.reportFreshness.expectedStudentReports}, fresh=${session.reportFreshness.classReportFresh && session.reportFreshness.studentReportsFresh}`);
    console.log(`  snapshots: ${session.snapshotFreshness.updatedParticipants}/${session.snapshotFreshness.expectedParticipants}, fresh=${session.snapshotFreshness.fresh}`);
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
