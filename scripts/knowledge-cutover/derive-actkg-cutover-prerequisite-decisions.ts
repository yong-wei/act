#!/usr/bin/env tsx

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { createPrerequisiteAuthorDecision } from '../../src/lib/teaching-projection/prerequisites/publication';
import type { PrerequisiteEdgeAuthoring } from '../../src/lib/teaching-projection/prerequisites/contracts';

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (!value || value.startsWith('--')) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(option('--repo-root'));
  const authoringRevision = option('--authoring-revision');
  const authorityReleaseId = option('--authority-release-id');
  const projectionCaptureId = option('--projection-capture-id');
  const edgesPath = path.join(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection/prerequisites/inventory/edges.yaml',
  );
  const outputPath = path.join(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection/prerequisites/inventory/actkg-cutover-decisions.json',
  );
  const document = parseYaml(await readFile(edgesPath, 'utf8')) as {
    edges?: PrerequisiteEdgeAuthoring[];
  };
  const decisions = (document.edges ?? [])
    .filter((edge) => edge.status === 'PUBLISHED')
    .map((edge) => {
      if (!edge.authorDecisionId || !edge.curatorId || !edge.curatorRationale) {
        throw new Error('every published cutover edge needs authorDecisionId, curatorId, and curatorRationale');
      }
      return createPrerequisiteAuthorDecision({
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        strength: edge.strength,
        scopeId: edge.scopeId,
        evidenceRefs: edge.evidenceRefs ?? [],
        curatorRationale: edge.curatorRationale,
        curatorId: edge.curatorId,
        rationale: edge.curatorRationale,
        authorityReleaseId,
        projectionCaptureId,
        authoringRevision,
        decisionId: edge.authorDecisionId,
        decidedAt: null,
      });
    })
    .sort((a, b) => a.decisionId < b.decisionId ? -1 : a.decisionId > b.decisionId ? 1 : 0);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(decisions, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    outputPath: path.relative(repoRoot, outputPath),
    decisionCount: decisions.length,
    authorityReleaseId,
    projectionCaptureId,
    authoringRevision,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
