import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPrismaClient } from '../../src/lib/prisma-client';
import { appendLearnerFactTransition } from '../../src/lib/data-governance/cumulative-learner-state';
import { refreshStudentEvidenceFeatureCache } from '../../src/lib/data-governance/student-evidence-feature-cache';
import {
  buildIdentityAuditReport,
  isolationSourceReference,
  planIdentityIsolation,
  planIdentityIsolationRestore,
  previousGovernanceFromIsolatedContext,
  resolveAuditExecutionRevision,
  type IdentityAuditFact,
} from '../../src/lib/data-governance/legacy-fact-identity-audit';
import { defaultLegacyCrosswalkPath, loadLegacyCrosswalk } from '../../src/lib/teaching-projection/crosswalk';

const prisma = createPrismaClient();

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readOption(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function captureGitWorkspace(): { sha: string | null; dirty: boolean } {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() !== '';
    return {
      sha: /^[0-9a-f]{7,40}$/i.test(sha) ? sha : null,
      dirty,
    };
  } catch {
    return { sha: null, dirty: false };
  }
}

async function loadFacts(userId: string): Promise<IdentityAuditFact[]> {
  return prisma.learningFact.findMany({
    where: { userId },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      userId: true,
      sourceEventId: true,
      contextJson: true,
      knowledgeIdentityNamespace: true,
      canonicalObjectId: true,
      aggregateReleaseSetId: true,
      aggregateReleaseId: true,
      knowledgeProjectionId: true,
      knowledgeRevisionRef: true,
    },
  });
}

async function main() {
  const userId = readOption('--user-id');
  if (!userId) {
    throw new Error('Usage: tsx scripts/db/audit-legacy-fact-identity.ts --user-id <id> [--mode audit|isolate|restore] [--apply] [--out report.json]');
  }
  const mode = (readOption('--mode') ?? 'audit') as 'audit' | 'isolate' | 'restore';
  const apply = hasFlag('--apply');
  const git = captureGitWorkspace();
  const executionRevision = resolveAuditExecutionRevision({
    requireCapture: true,
    gitHead: git.sha,
    dirty: git.dirty,
  });
  const crosswalk = loadLegacyCrosswalk(
    defaultLegacyCrosswalkPath(path.join(process.cwd(), 'course-content/authoring/knowledge/teaching-projection')),
  ).entries;
  const facts = await loadFacts(userId);
  const existing = await prisma.learnerFactTransition.findMany({
    where: { userId, sourceReference: { startsWith: 'identity-isolation' } },
    select: { sourceReference: true, factId: true, transitionPayload: true },
  });
  const existingRefs = existing
    .map((row) => row.sourceReference)
    .filter((value): value is string => typeof value === 'string');

  let report = buildIdentityAuditReport({ userId, facts, crosswalk, executionRevision, mode });
  let writes: Array<{ factId: string; nextContext: Record<string, unknown>; transition: Parameters<typeof appendLearnerFactTransition>[1] }> = [];

  if (mode === 'isolate') {
    const planned = planIdentityIsolation({
      userId,
      facts,
      existingSourceReferences: existingRefs,
      executionRevision,
      crosswalk,
    });
    report = planned.report;
    writes = planned.writes;
  } else if (mode === 'restore') {
    const previousGovernanceByFactId = new Map<string, Record<string, unknown> | null>();
    for (const row of existing) {
      if (row.sourceReference !== isolationSourceReference(row.factId)) continue;
      const payload = row.transitionPayload && typeof row.transitionPayload === 'object'
        ? row.transitionPayload as Record<string, unknown>
        : {};
      const previous = payload.previousGovernance && typeof payload.previousGovernance === 'object'
        ? payload.previousGovernance as Record<string, unknown>
        : null;
      previousGovernanceByFactId.set(row.factId, previous);
    }
    for (const fact of facts) {
      if (previousGovernanceByFactId.has(fact.id)) continue;
      previousGovernanceByFactId.set(fact.id, previousGovernanceFromIsolatedContext(fact.contextJson));
    }
    const planned = planIdentityIsolationRestore({
      userId,
      facts,
      previousGovernanceByFactId,
      existingSourceReferences: existingRefs,
      executionRevision,
      crosswalk,
    });
    report = planned.report;
    writes = planned.writes;
  }

  if (apply && (mode === 'isolate' || mode === 'restore')) {
    for (const write of writes) {
      await prisma.$transaction(async (tx) => {
        await tx.learningFact.update({
          where: { id: write.factId },
          data: { contextJson: write.nextContext },
        });
        await appendLearnerFactTransition(tx, write.transition);
      });
    }
    await refreshStudentEvidenceFeatureCache(prisma, userId);
  }

  const rendered = JSON.stringify(report, null, 2);
  const out = readOption('--out');
  if (out) await writeFile(out, `${rendered}\n`);
  console.log(rendered);
  if ((mode === 'isolate' || mode === 'restore') && !apply) {
    console.error(`${mode} planned ${writes.length} write(s); pass --apply to persist.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
