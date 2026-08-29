/**
 * Replacement parity and facade detection (#1592).
 */

import {
  IMPLEMENTED_REPLACEMENT_CONTRACTS,
  ResourceGovernanceRetirementGateError,
  type ReplacementIdentity,
  type RetirementCandidate,
} from './contracts';
import { isGitRevision } from './hash';

export function replacementIsImplemented(
  replacement: ReplacementIdentity,
): string[] {
  const reasons: string[] = [];
  if (!IMPLEMENTED_REPLACEMENT_CONTRACTS.includes(replacement.contract)) {
    reasons.push(`replacement-not-r1-r2-r3:${replacement.contract}`);
  }
  if (!replacement.implemented) {
    reasons.push(`replacement-not-implemented:${replacement.publicSymbol}`);
  }
  if (!replacement.publicApiPath || !replacement.publicSymbol) {
    reasons.push('replacement-identity-incomplete');
  }
  if (!isGitRevision(replacement.captureRevision)) {
    reasons.push('replacement-revision-invalid');
  }
  return reasons;
}

export function replacementParityFails(replacement: ReplacementIdentity): string[] {
  const reasons: string[] = [];
  const parity = replacement.parity;
  const required: Array<keyof Omit<typeof parity, 'facade'>> = [
    'identity',
    'sourceOwnership',
    'role',
    'authorization',
    'scope',
    'revision',
    'optionalDegradation',
    'failClosed',
    'cache',
    'publicResponse',
  ];
  for (const key of required) {
    if (parity[key] !== true) {
      reasons.push(`replacement-parity-failed:${key}`);
    }
  }
  if (parity.facade) {
    reasons.push('replacement-is-facade');
  }
  return reasons;
}

export function detectFacadeInSource(input: {
  candidate: RetirementCandidate;
  replacementSource: string | null;
}): boolean {
  if (!input.replacementSource) return false;
  const source = input.replacementSource;
  const oldPath = input.candidate.sourcePath;
  const oldExport = input.candidate.exportName;
  const reexportsOld =
    Boolean(oldExport)
    && /export\s*\{[^}]*\b/.test(source)
    && oldExport !== null
    && source.includes(oldExport)
    && (source.includes(`from '${oldPath}`)
      || source.includes(`from "${oldPath}`)
      || source.includes(`from '@/`)
        && source.includes(oldPath.replace(/^src\//u, '').replace(/\.tsx?$/u, '')));
  const noopAdapter = /featureFlag|TODO: wrap|re-export|passthrough/iu.test(source)
    && Boolean(oldExport)
    && oldExport !== null
    && source.includes(oldExport);
  return Boolean(reexportsOld || noopAdapter);
}

export function assertReplacementQualifies(candidate: RetirementCandidate): void {
  const reasons = [
    ...replacementIsImplemented(candidate.replacement),
    ...replacementParityFails(candidate.replacement),
  ];
  if (reasons.length > 0) {
    throw new ResourceGovernanceRetirementGateError(
      'replacement-unqualified',
      `replacement for ${candidate.id} is not qualified`,
      reasons,
    );
  }
}
