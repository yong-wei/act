import { isTestPath } from '@/lib/architecture-census/classify';
import { extractSpecifiers } from '@/lib/architecture-census/imports';
import type { CensusCore, CensusObservation, CensusSourceFile } from '@/lib/architecture-census/types';
import { assignOwner } from '@/lib/architecture-charter/assign';
import type { FitnessViolation } from './types';

function followUp(identity: string): string {
  if (identity.includes('teacher-diagnosis-report-history')) {
    return 'decouple-teacher-diagnosis-route-contract';
  }
  return 'enforce-modular-domain-dependency-contracts';
}

function classificationOf(observation: CensusObservation): FitnessViolation['classification'] {
  if (observation.surfaceClass === 'test' || isTestPath(observation.identity)) return 'test';
  return observation.surfaceClass;
}

function isPublicApi(path: string): boolean {
  return /\/public-api\.(?:ts|tsx)$/u.test(path);
}

function isDomainCore(path: string): boolean {
  return (
    path.startsWith('src/features/')
    && !path.includes('/adapters/')
    && !isPublicApi(path)
    && !isTestPath(path)
    && !path.endsWith('.tsx')
  );
}

function isFrozenLibFile(path: string): boolean {
  return (
    path.startsWith('src/lib/')
    && !path.includes('->')
    && !path.includes('<-')
    && !/^src\/lib\/architecture-(?:census|charter|fitness|test-commands|closure)(?:\/|$)/u.test(path)
    && !isTestPath(path)
    && /\.(?:ts|tsx|js|mjs)$/u.test(path)
  );
}

function isInfrastructureSpecifier(specifier: string): boolean {
  return (
    specifier === 'react'
    || specifier.startsWith('react/')
    || specifier === 'next'
    || specifier.startsWith('next/')
    || specifier === '@prisma/client'
    || specifier === 'prisma'
  );
}

export function collectViolations(core: CensusCore, files: readonly CensusSourceFile[] = []): FitnessViolation[] {
  const found: FitnessViolation[] = [];
  const libFiles = new Set<string>();

  for (const observation of core.observations) {
    if (observation.kind === 'dependency-edge' && observation.attributes.featureToApp === true) {
      const production = observation.attributes.context === 'production';
      if (production) {
        found.push({
          id: observation.id,
          kind: 'feature-to-app',
          identity: observation.identity,
          owner: assignOwner(observation),
          classification: 'production',
          consumers: [String(observation.attributes.from)],
          reason: 'production-feature-imports-app-router',
          deletionCondition: 'import-domain-public-api-instead-of-route-module',
          followUpChange: followUp(observation.identity),
        });
      }
    }
    if (observation.kind === 'deep-import' && observation.surfaceClass !== 'test' && !isTestPath(String(observation.attributes.from ?? observation.identity))) {
      const to = String(observation.attributes.to ?? '');
      if (isPublicApi(to)) continue;
      found.push({
        id: observation.id,
        kind: 'deep-import',
        identity: observation.identity,
        owner: assignOwner(observation),
        classification: classificationOf(observation),
        consumers: [String(observation.attributes.from ?? observation.identity)],
        reason: 'cross-domain-internal-import',
        deletionCondition: 'replace-with-target-public-api',
        followUpChange: followUp(observation.identity),
      });
    }
    if (observation.kind === 'prisma-access' && isDomainCore(observation.identity)) {
      found.push({
        id: observation.id,
        kind: 'domain-core-infrastructure',
        identity: observation.identity,
        owner: assignOwner(observation),
        classification: 'production',
        consumers: [observation.identity],
        reason: 'feature-core-imports-prisma',
        deletionCondition: 'move-prisma-access-behind-adapter-port',
        followUpChange: 'enforce-modular-domain-dependency-contracts',
      });
    }
    if (observation.kind === 'scc') {
      found.push({
        id: observation.id,
        kind: 'scc',
        identity: observation.identity,
        owner: assignOwner(observation),
        classification: 'production',
        consumers: observation.evidence,
        reason: 'production-strongly-connected-component',
        deletionCondition: 'break-cycle-through-public-api',
        followUpChange: 'enforce-modular-domain-dependency-contracts',
      });
    }
    if (files.length === 0) {
      const paths = [observation.identity, ...observation.evidence, String(observation.attributes.from ?? ''), String(observation.attributes.to ?? '')];
      for (const path of paths) {
        if (isFrozenLibFile(path)) libFiles.add(path);
      }
    }
  }
  if (files.length > 0) {
    for (const file of files) {
      if (isFrozenLibFile(file.path)) libFiles.add(file.path);
    }
  }

  for (const file of files) {
    if (!isDomainCore(file.path) || !file.content) continue;
    const infra = extractSpecifiers(file.path, file.content).filter(isInfrastructureSpecifier);
    if (infra.length === 0) continue;
    found.push({
      id: `domain-core-infrastructure:${file.path}:${infra.sort().join(',')}`,
      kind: 'domain-core-infrastructure',
      identity: file.path,
      owner: assignOwner({ id: file.path, kind: 'prisma-access', identity: file.path, evidence: [file.path] }),
      classification: 'production',
      consumers: [file.path],
      reason: `feature-core-imports-${infra.sort().join('-')}`,
      deletionCondition: 'move-infrastructure-behind-adapter-port',
      followUpChange: 'enforce-modular-domain-dependency-contracts',
    });
  }

  for (const path of [...libFiles].sort()) {
    found.push({
      id: `lib-file:${path}`,
      kind: 'lib-file',
      identity: path,
      owner: assignOwner({ id: path, kind: 'script', identity: path, evidence: [path] }),
      classification: isTestPath(path) ? 'test' : 'production',
      consumers: [path],
      reason: 'existing-src-lib-file-frozen',
      deletionCondition: 'move-business-logic-to-owning-domain-module',
      followUpChange: 'enforce-modular-domain-dependency-contracts',
    });
  }

  const unique = new Map<string, FitnessViolation>();
  for (const item of found) unique.set(item.id, item);
  return [...unique.values()].sort((left, right) => left.id.localeCompare(right.id));
}
