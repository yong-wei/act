#!/usr/bin/env tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildDomainTeachingGenerationV3,
  DOMAIN_TEACHING_GENERATION_V3_RELATIVE,
  generation3ArtifactRelatives,
  serializeGeneration3Json,
} from '../knowledge-cutover/build-domain-teaching-generation-v3';

const FORBIDDEN_WRITE_MARKERS = [
  '/generation-2/',
  'first-fragment',
  'foundation-three-domain-v1',
  'modern-discrete-time-v1',
  'modern-state-space-v1',
  '/composed-manifest.json',
] as const;

function assertGeneration3Only(relativePath: string): void {
  if (!relativePath.startsWith(`${DOMAIN_TEACHING_GENERATION_V3_RELATIVE}/`)) {
    throw new Error(`refusing to write outside generation-3: ${relativePath}`);
  }
  if (
    FORBIDDEN_WRITE_MARKERS.some((marker) => relativePath.includes(marker))
    && !relativePath.startsWith(`${DOMAIN_TEACHING_GENERATION_V3_RELATIVE}/`)
  ) {
    throw new Error(`refusing to overwrite published artifact ${relativePath}`);
  }
}

function writeArtifact(repoRoot: string, relativePath: string, value: unknown): void {
  assertGeneration3Only(relativePath);
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, serializeGeneration3Json(value), 'utf8');
}

export function generateCrossDomainTeaching(repoRoot = process.cwd()) {
  const built = buildDomainTeachingGenerationV3({ repoRoot });
  const relatives = generation3ArtifactRelatives();
  writeArtifact(repoRoot, relatives.authoritySource, built.authoritySource);
  writeArtifact(repoRoot, relatives.conversionProtocol, built.conversionProtocol);
  writeArtifact(repoRoot, relatives.upstreamPins, built.pinLedger);
  writeArtifact(repoRoot, relatives.foundationAuthoring, built.foundationAuthoring);
  writeArtifact(repoRoot, relatives.foundationFragment, built.foundationFragment);
  writeArtifact(
    repoRoot,
    relatives.foundationThreeDomainAuthoring,
    built.foundationThreeDomainAuthoring,
  );
  writeArtifact(
    repoRoot,
    relatives.foundationThreeDomainFragment,
    built.foundationThreeDomainFragment,
  );
  writeArtifact(repoRoot, relatives.classicalAuthoring, built.classicalAuthoring);
  writeArtifact(repoRoot, relatives.classicalFragment, built.classicalFragment);
  writeArtifact(repoRoot, relatives.modernDiscreteSource, built.modernDiscrete.source);
  writeArtifact(repoRoot, relatives.modernDiscreteWorklist, built.modernDiscrete.worklist);
  writeArtifact(
    repoRoot,
    relatives.modernDiscreteAuthoring,
    built.modernDiscrete.authoring,
  );
  writeArtifact(
    repoRoot,
    relatives.modernDiscreteFragment,
    built.modernDiscrete.fragment,
  );
  writeArtifact(
    repoRoot,
    relatives.modernDiscreteCoverage,
    built.modernDiscrete.coverage,
  );
  writeArtifact(
    repoRoot,
    relatives.modernStateSpaceSource,
    built.modernStateSpace.source,
  );
  writeArtifact(
    repoRoot,
    relatives.modernStateSpaceWorklist,
    built.modernStateSpace.worklist,
  );
  writeArtifact(
    repoRoot,
    relatives.modernStateSpaceAuthoring,
    built.modernStateSpace.authoring,
  );
  writeArtifact(
    repoRoot,
    relatives.modernStateSpaceFragment,
    built.modernStateSpace.fragment,
  );
  writeArtifact(
    repoRoot,
    relatives.modernStateSpaceCoverage,
    built.modernStateSpace.coverage,
  );
  writeArtifact(repoRoot, relatives.crossDomainSource, built.crossDomain.source);
  writeArtifact(repoRoot, relatives.crossDomainWorklist, built.crossDomain.worklist);
  writeArtifact(repoRoot, relatives.crossDomainAuthoring, built.crossDomain.authoring);
  writeArtifact(repoRoot, relatives.crossDomainFragment, built.crossDomain.fragment);
  writeArtifact(repoRoot, relatives.crossDomainCoverage, built.crossDomain.coverage);
  writeArtifact(repoRoot, relatives.composedManifest, built.composed.manifest);
  return built;
}

if (process.argv[1]?.endsWith('generate-cross-domain-teaching.ts')) {
  generateCrossDomainTeaching();
}
