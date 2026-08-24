#!/usr/bin/env tsx

import { writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildFoundationThreeDomainArtifacts,
  foundationThreeDomainArtifactRelatives,
  liveAuthorityEnvelopeForFoundationThreeDomain,
  serializeFoundationThreeDomainJson,
  type FoundationThreeDomainArtifacts,
} from '../../src/lib/teaching-projection/domain-fragments/foundation-three-domain';
import {
  composeDomainTeachingProjection,
} from '../../src/lib/teaching-projection/domain-fragments/compose';
import { translateAndBuildFirstDomainFragment } from '../../src/lib/teaching-projection/domain-fragments/translate';
import type { DomainTeachingFragment } from '../../src/lib/teaching-projection/domain-fragments/contracts';

const OLD_FIRST_OUTPUT_NAMES = new Set([
  'first-fragment.authoring.json',
  'first-fragment.json',
  'composed-manifest.json',
]);

export interface FoundationThreeDomainGenerationResult {
  artifacts: FoundationThreeDomainArtifacts;
  fixtureFirst: DomainTeachingFragment;
  composedFixture: ReturnType<typeof composeDomainTeachingProjection>;
  authorityNodeIds: string[];
}

function writeArtifact(
  repoRoot: string,
  outputName: string,
  value: unknown,
): void {
  if (OLD_FIRST_OUTPUT_NAMES.has(path.basename(outputName))) {
    throw new Error(`refusing to overwrite retained #1370 artifact ${outputName}`);
  }
  const filePath = path.join(repoRoot, outputName);
  writeFileSync(filePath, serializeFoundationThreeDomainJson(value), 'utf8');
}

export function generateFoundationThreeDomainTeaching(
  repoRoot = process.cwd(),
): FoundationThreeDomainGenerationResult {
  const authority = liveAuthorityEnvelopeForFoundationThreeDomain(repoRoot);
  const artifacts = buildFoundationThreeDomainArtifacts(authority);

  // This is deliberately a derived fixture: the retained #1370 authoring is
  // rebuilt against the same union envelope solely to exercise composition.
  const { fragment: fixtureFirst } = translateAndBuildFirstDomainFragment({
    authority,
  });
  const composedFixture = composeDomainTeachingProjection({
    fragments: [fixtureFirst, artifacts.fragment],
    authoringRevision: authority.authoringRevision,
  });
  return {
    artifacts,
    fixtureFirst,
    composedFixture,
    authorityNodeIds: authority.nodes.map((node) => node.canonicalId),
  };
}

export function writeFoundationThreeDomainArtifacts(
  repoRoot = process.cwd(),
): FoundationThreeDomainGenerationResult {
  const result = generateFoundationThreeDomainTeaching(repoRoot);
  const { artifacts, composedFixture } = result;
  const relatives = foundationThreeDomainArtifactRelatives();
  writeArtifact(repoRoot, relatives.source, artifacts.source);
  writeArtifact(repoRoot, relatives.worklist, artifacts.worklist);
  writeArtifact(repoRoot, relatives.authoring, artifacts.authoring);
  writeArtifact(repoRoot, relatives.fragment, artifacts.fragment);
  writeArtifact(repoRoot, relatives.coverage, artifacts.coverage);
  writeArtifact(
    repoRoot,
    relatives.twoFragmentManifest,
    composedFixture.manifest,
  );
  return result;
}

if (process.argv[1]?.endsWith('generate-foundation-three-domain-teaching.ts')) {
  writeFoundationThreeDomainArtifacts();
}
