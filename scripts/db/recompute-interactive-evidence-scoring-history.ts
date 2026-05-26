import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

import {
  applyInteractiveEvidenceScoringRecomputePlan,
  collectInteractiveEvidenceScoringRecomputePlan,
  type InteractiveEvidenceScoringRecomputeFilters,
  type InteractiveEvidenceScoringRecomputePlan,
  type InteractiveEvidenceScoringApplyResult,
} from '@/lib/data-governance/interactive-evidence-scoring-recompute';
import {
  normalizeInteractiveRuntimeManifest,
  type InteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';

const prisma = new PrismaClient();

interface RecomputeOptions {
  apply: boolean;
  json: boolean;
  compact: boolean;
  filters: InteractiveEvidenceScoringRecomputeFilters;
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseList(option: string, value: string): string[] {
  const values = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error(`No values provided for ${option}`);
  }
  return values;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

function readRequiredOptionValue(option: string, value: string | undefined): string {
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function parseOptions(argv: string[]): RecomputeOptions {
  const options: RecomputeOptions = {
    apply: false,
    json: false,
    compact: false,
    filters: {},
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--dry-run') {
      options.apply = false;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--compact') {
      options.compact = true;
    } else if (arg === '--session-id' || arg === '--session-ids') {
      options.filters.sessionIds = parseList(arg, readRequiredOptionValue(arg, next));
      index += 1;
    } else if (arg === '--lesson-key' || arg === '--lesson-keys') {
      options.filters.lessonKeys = parseList(arg, readRequiredOptionValue(arg, next));
      index += 1;
    } else if (arg === '--from') {
      options.filters.from = parseDate(readRequiredOptionValue(arg, next));
      index += 1;
    } else if (arg === '--to') {
      options.filters.to = parseDate(readRequiredOptionValue(arg, next));
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
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

function printTextReport(
  plan: InteractiveEvidenceScoringRecomputePlan,
  applyResult: InteractiveEvidenceScoringApplyResult | null,
) {
  console.log(`Interactive evidence scoring recompute report (${plan.generatedAt})`);
  console.log(`Mode: ${applyResult ? 'apply' : 'dry-run'}`);
  console.log('');
  console.log(`Candidate rows: ${plan.totals.candidateRows}`);
  console.log(`Response scoring changes: ${plan.totals.responseRowsChanged}`);
  console.log(`Fact context changes: ${plan.totals.factRowsChanged}`);
  console.log(`Score changes: ${plan.totals.scoreChanges}`);
  console.log(`Source log repairs: ${plan.totals.sourceLogRepairs}`);
  console.log(`Affected lessons: ${plan.totals.affectedLessons}`);
  console.log(`Affected sessions: ${plan.totals.affectedSessions}`);
  console.log(`Affected users: ${plan.totals.affectedUsers}`);

  if (plan.prerequisiteErrors.length > 0) {
    console.log('');
    console.log('Prerequisite errors:');
    for (const error of plan.prerequisiteErrors.slice(0, 20)) {
      console.log(`- ${error.reason}: response=${error.responseId}, lesson=${error.lessonKey ?? 'unknown'}, step=${error.stepId}`);
    }
  }

  if (plan.auditDeltas.length > 0) {
    console.log('');
    console.log('Score deltas:');
    for (const delta of plan.auditDeltas.slice(0, 20)) {
      console.log(`- lesson=${delta.lessonKey ?? 'unknown'}, session=${delta.sessionId}, step=${delta.stepId}, kinds=${delta.questionKinds.join(',') || 'unknown'}, score=${delta.oldScore ?? 'null'} -> ${delta.newScore ?? 'null'}, correct=${delta.oldCorrectCount ?? 'null'} -> ${delta.newCorrectCount ?? 'null'}, users=${delta.affectedUsers}`);
    }
  }

  if (plan.sourceLogDiagnostics.length > 0) {
    console.log('');
    console.log('Unrepairable sourceLogId diagnostics:');
    for (const diagnostic of plan.sourceLogDiagnostics.slice(0, 20)) {
      console.log(`- ${diagnostic.reason}: fact=${diagnostic.factId}, response=${diagnostic.responseId}, sourceEventId=${diagnostic.sourceEventId ?? 'missing'}, lesson=${diagnostic.lessonKey ?? 'unknown'}, session=${diagnostic.sessionId}, step=${diagnostic.stepId}`);
    }
  }

  if (applyResult) {
    console.log('');
    console.log(`Updated StudentStepResponse rows: ${applyResult.responseRowsUpdated}`);
    console.log(`Updated LearningFact rows: ${applyResult.factRowsUpdated}`);
    console.log(`Repaired sourceLogId rows: ${applyResult.sourceLogIdsRepaired}`);
  }
}

async function main() {
  const options = parseOptions(process.argv);
  const manifestsByLessonKey = loadRuntimeManifests();
  const plan = await collectInteractiveEvidenceScoringRecomputePlan(prisma, {
    filters: options.filters,
    manifestsByLessonKey,
  });
  const applyResult = options.apply
    ? await applyInteractiveEvidenceScoringRecomputePlan(prisma, plan)
    : null;

  if (options.json) {
    console.log(JSON.stringify({ plan, applyResult }, null, options.compact ? 0 : 2));
    return;
  }

  printTextReport(plan, applyResult);
}

main()
  .catch((error) => {
    console.error('[InteractiveEvidenceScoringRecompute] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
