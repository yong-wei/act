#!/usr/bin/env tsx

import { writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildModernControlDomainArtifacts,
  liveAuthorityEnvelopeForModernControl,
  modernControlArtifactRelatives,
  modernControlDomainDefinitions,
  serializeModernControlJson,
  type ModernControlDomainId,
} from '../../src/lib/teaching-projection/domain-fragments/modern-control-domain';

export interface ModernControlGenerationResult {
  authorityNodeIds: string[];
  artifacts: ReturnType<typeof buildModernControlDomainArtifacts>[];
}

function writeArtifact(repoRoot: string, relativePath: string, value: unknown): void {
  writeFileSync(
    path.join(repoRoot, relativePath),
    serializeModernControlJson(value),
    'utf8',
  );
}

export function generateModernControlDomainTeaching(
  repoRoot = process.cwd(),
): ModernControlGenerationResult {
  const authority = liveAuthorityEnvelopeForModernControl(repoRoot);
  const artifacts = modernControlDomainDefinitions().map((definition) =>
    buildModernControlDomainArtifacts(
      definition.domainId as ModernControlDomainId,
      authority,
    ),
  );
  return {
    authorityNodeIds: authority.nodes.map((node) => node.canonicalId),
    artifacts,
  };
}

export function writeModernControlDomainArtifacts(
  repoRoot = process.cwd(),
): ModernControlGenerationResult {
  const result = generateModernControlDomainTeaching(repoRoot);
  for (const artifact of result.artifacts) {
    const relatives = modernControlArtifactRelatives(artifact.definition.domainId);
    writeArtifact(repoRoot, relatives.source, artifact.source);
    writeArtifact(repoRoot, relatives.worklist, artifact.worklist);
    writeArtifact(repoRoot, relatives.authoring, artifact.authoring);
    writeArtifact(repoRoot, relatives.fragment, artifact.fragment);
    writeArtifact(repoRoot, relatives.coverage, artifact.coverage);
  }
  return result;
}

if (process.argv[1]?.endsWith('generate-modern-control-domain-teaching.ts')) {
  writeModernControlDomainArtifacts();
}

