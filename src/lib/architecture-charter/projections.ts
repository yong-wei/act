import type { ArchitectureCharter, CharterGateRecord, OwnerId } from './types';
import { OWNER_CATALOG, REQUIRED_BASELINE } from './types';

function cell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

function countByOwner(charter: ArchitectureCharter): Record<OwnerId, number> {
  const counts = Object.fromEntries(OWNER_CATALOG.map((item) => [item.id, 0])) as Record<OwnerId, number>;
  for (const record of charter.owners) counts[record.owner] += 1;
  return counts;
}

function identityLine(charter: ArchitectureCharter): string[] {
  return [
    `- schemaVersion: \`${charter.schemaVersion}\``,
    `- baseline.sourceCommit: \`${charter.baseline.sourceCommit}\``,
    `- baseline.sourceTree: \`${charter.baseline.sourceTree}\``,
    `- baseline.schemaVersion: \`${charter.baseline.schemaVersion}\``,
    `- baseline.censusCoreSha256: \`${REQUIRED_BASELINE.censusCoreSha256}\``,
    `- frozenReceiptIds: ${charter.receiptIds.map((id) => `\`${id}\``).join(', ') || '_none_'}`,
    '',
    'This charter is governance-only. It does not change product routes, authorization, persistence, tests, TypeScript, CI, runtime, or production selectors.',
    '',
  ];
}

export function projectRefactorCharter(charter: ArchitectureCharter): string {
  const counts = countByOwner(charter);
  return [
    '# Modular monolith refactor charter',
    '',
    ...identityLine(charter),
    '## Owner catalog',
    '',
    table(
      ['owner', 'label', 'owned records'],
      OWNER_CATALOG.map((item) => [item.id, item.label, String(counts[item.id])]),
    ),
    '',
    `- owned records: ${charter.owners.length}`,
    `- gates: ${charter.gates.length}`,
    `- compatibility: ${charter.compatibility.length}`,
    `- blocking: ${charter.blocking.length}`,
    '',
    'Existing `frontend-build-source-boundary`, `owned-surface-module-hygiene`, `server-action-and-route-safety`, `app-router-rendering-boundary-safety`, and `stable-dependency-chain-migration` remain authoritative in their scopes.',
    '',
  ].join('\n');
}

export function projectBoundedContextMap(charter: ArchitectureCharter): string {
  const counts = countByOwner(charter);
  return [
    '# Bounded-context map',
    '',
    ...identityLine(charter),
    'Product, toolchain, data, and release surfaces are owned by the platform boundary unless a domain rule matches first.',
    '',
    table(
      ['context', 'owner', 'records'],
      OWNER_CATALOG.map((item) => [item.label, item.id, String(counts[item.id])]),
    ),
    '',
    'Allowed direction: App Router / Server Action -> domain public-api or application use case -> domain core + ports -> adapters -> Prisma/Next/external.',
    '',
  ].join('\n');
}

export function projectDependencyRules(charter: ArchitectureCharter): string {
  return [
    '# Dependency rules',
    '',
    ...identityLine(charter),
    'Later enforcement consumes this charter and the predecessor baseline graph. This document does not activate a lint or CI gate.',
    '',
    '- New cross-domain calls use a stable public API or application use case.',
    '- Production `feature -> app` imports are forbidden except allowlisted historical edges.',
    '- Cross-domain deep imports are forbidden except allowlisted historical edges.',
    '- Domain core must not import Prisma, Next, React, route modules, or database clients.',
    '- New business code in `src/lib` is frozen unless a chartered platform exception exists.',
    '- Test and framework-convention imports stay classified separately from production inversions.',
    '',
    `Owned records feeding these rules: ${charter.owners.length}.`,
    '',
    'The first deletion slice is `decouple-teacher-diagnosis-route-contract`. Remaining edges are staged by `enforce-modular-domain-dependency-contracts`.',
    '',
  ].join('\n');
}

function gateRows(gates: readonly CharterGateRecord[], gateClass: CharterGateRecord['class']): string[][] {
  return gates
    .filter((item) => item.class === gateClass)
    .map((item) => [
      item.identity,
      item.owner,
      item.validator,
      item.protectedBoundary,
      item.protectedFact,
      item.threat,
      item.failureConsequence,
      item.consumers.join('; '),
    ]);
}

export function projectTrustBoundaryMatrix(charter: ArchitectureCharter): string {
  const classes = ['hard', 'contract', 'soft', 'removable'] as const;
  const sections = classes.flatMap((gateClass) => [
    `## ${gateClass}`,
    '',
    table(
      ['identity', 'owner', 'validator', 'boundary', 'protected fact', 'threat', 'consequence', 'consumers'],
      gateRows(charter.gates, gateClass),
    ),
    '',
  ]);
  return [
    '# Trust-boundary matrix',
    '',
    ...identityLine(charter),
    ...sections,
  ].join('\n');
}

export function projectDeprecationLedger(charter: ArchitectureCharter): string {
  return [
    '# Deprecation ledger',
    '',
    ...identityLine(charter),
    table(
      ['id', 'identity', 'owner', 'consumers', 'replacement', 'deletion condition', 'follow-up', 'evidence'],
      charter.compatibility.map((item) => [
        item.id,
        item.identity,
        item.owner,
        item.consumers.join('; '),
        item.replacement,
        item.deletionCondition,
        item.followUpChange,
        item.evidence.join('; '),
      ]),
    ),
    '',
  ].join('\n');
}

export function projectCharterDocuments(charter: ArchitectureCharter): Record<string, string> {
  return {
    'refactor-charter.md': projectRefactorCharter(charter),
    'bounded-context-map.md': projectBoundedContextMap(charter),
    'dependency-rules.md': projectDependencyRules(charter),
    'trust-boundary-matrix.md': projectTrustBoundaryMatrix(charter),
    'deprecation-ledger.md': projectDeprecationLedger(charter),
  };
}
