import { createPrismaClient } from '../../src/lib/prisma-client';
import fs from 'node:fs';
import path from 'node:path';

import {
  applyCourseEvidenceBackfillPlan,
  collectCourseEvidenceBackfillPlan,
  refreshCourseEvidenceAffectedStudentCaches,
  regenerateCourseEvidenceReports,
  type CourseEvidenceBackfillApplyResult,
  type CourseEvidenceCacheRefreshResult,
  type CourseEvidenceBackfillPlan,
  type CourseEvidenceReportRegenerationResult,
} from '@/lib/data-governance/course-evidence-backfill';
import {
  normalizeInteractiveRuntimeManifest,
  type InteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';
import { parseCourseEvidenceBackfillOptions } from './course-evidence-backfill-options';

const prisma = createPrismaClient();

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function addManifestAliases(
  manifests: Record<string, InteractiveRuntimeManifest>,
  manifest: InteractiveRuntimeManifest,
  aliases: Array<string | null | undefined>,
) {
  for (const alias of aliases) {
    if (alias && alias.trim()) {
      manifests[alias.trim()] = manifest;
    }
  }
}

function loadRuntimeManifests(rootDir = process.cwd()) {
  const manifests: Record<string, InteractiveRuntimeManifest> = {};
  const lessonsDir = path.join(rootDir, 'course-content/runtime/lessons');
  if (!fs.existsSync(lessonsDir)) return manifests;

  for (const entry of fs.readdirSync(lessonsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const lessonDir = path.join(lessonsDir, entry.name);
    const manifestPath = path.join(lessonDir, 'interactive-manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = normalizeInteractiveRuntimeManifest(readJsonFile(manifestPath));
    if (!manifest) continue;

    let lessonJson: Record<string, unknown> = {};
    const lessonJsonPath = path.join(lessonDir, 'lesson.json');
    if (fs.existsSync(lessonJsonPath)) {
      lessonJson = readJsonFile(lessonJsonPath) as Record<string, unknown>;
    }

    addManifestAliases(manifests, manifest, [
      entry.name,
      manifest.lessonId,
      manifest.courseRouteSegment,
      manifest.courseRouteSegment ? `${manifest.courseRouteSegment}-v1` : null,
      typeof lessonJson.interactive_manifest_source_path === 'string'
        ? lessonJson.interactive_manifest_source_path
        : null,
    ]);
  }

  return manifests;
}

function printCoverage(label: string, plan: CourseEvidenceBackfillPlan) {
  const coverage = label === 'Before' ? plan.coverage.before : plan.coverage.after;
  console.log(`${label} coverage: answers=${coverage.answerAvailableRows}/${coverage.totalRows}, score=${coverage.scoreAvailableRows}/${coverage.totalRows}, questionSummaries=${coverage.questionSummaryAvailableRows}/${coverage.totalRows}`);
  console.log(`  quality: rich=${coverage.richRows}, partial=${coverage.partialRows}, legacy=${coverage.legacyRows}, missing=${coverage.missingRows}`);
}

function printTextReport(
  plan: CourseEvidenceBackfillPlan,
  applyResult: CourseEvidenceBackfillApplyResult | null,
  reportResult: CourseEvidenceReportRegenerationResult | null,
  cacheResult: CourseEvidenceCacheRefreshResult | null,
) {
  console.log(`Course evidence backfill report (${plan.generatedAt})`);
  console.log(`Mode: ${applyResult ? 'apply' : 'dry-run'}`);
  console.log('');
  console.log(`Candidate rows: ${plan.totals.candidateRows}`);
  console.log(`Recoverable rows: ${plan.totals.recoverableRows}`);
  console.log(`Newly enrichable rows: ${plan.totals.newlyEnrichableRows}`);
  console.log(`Already enriched rows: ${plan.totals.alreadyEnrichedRows}`);
  console.log(`Unrecoverable rows: ${plan.totals.unrecoverableRows}`);
  console.log(`Already unrecoverable rows: ${plan.totals.alreadyUnrecoverableRows}`);
  console.log(`Affected sessions: ${plan.totals.affectedSessions}`);
  console.log(`Affected users: ${plan.totals.affectedUsers}`);
  console.log('');
  printCoverage('Before', plan);
  printCoverage('After', plan);

  if (applyResult) {
    console.log('');
    console.log(`Updated StudentStepResponse rows: ${applyResult.responseRowsUpdated}`);
    console.log(`Updated LearningFact rows: ${applyResult.factRowsUpdated}`);
  }

  if (reportResult) {
    console.log('');
    console.log(`Report sessions requested: ${reportResult.sessionsRequested}`);
    console.log(`Report sessions regenerated: ${reportResult.sessionsRegenerated}`);
    console.log(`Report sessions skipped: ${reportResult.sessionsSkipped}`);
    console.log(`Class reports refreshed: ${reportResult.classReports}`);
    console.log(`Student reports refreshed: ${reportResult.studentReports}`);
  }

  if (cacheResult) {
    console.log('');
    console.log(`Feature cache users requested: ${cacheResult.usersRequested}`);
    console.log(`Feature cache users refreshed: ${cacheResult.usersRefreshed}`);
  }
}

async function main() {
  const options = parseCourseEvidenceBackfillOptions(process.argv);
  const manifestsByLessonKey = loadRuntimeManifests();
  const plan = await collectCourseEvidenceBackfillPlan(prisma, {
    filters: options.filters,
    manifestsByLessonKey,
  });
  const applyResult = options.apply
    ? await applyCourseEvidenceBackfillPlan(prisma, plan)
    : null;
  const reportResult = options.apply && options.regenerateReports
    ? await regenerateCourseEvidenceReports(prisma, plan.affectedSessionIds)
    : null;
  const cacheResult = options.apply && options.refreshCache
    ? await refreshCourseEvidenceAffectedStudentCaches(prisma, plan)
    : null;

  if (options.json) {
    console.log(JSON.stringify({ plan, applyResult, reportResult, cacheResult }, null, options.compact ? 0 : 2));
    return;
  }

  printTextReport(plan, applyResult, reportResult, cacheResult);
}

main()
  .catch((error) => {
    console.error('[CourseEvidenceBackfill] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
