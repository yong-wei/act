import { serializeDeterministic } from './serialize';
import type { CensusCore, CensusObservation, InventoryKind } from './types';

function rows(core: CensusCore, kind: InventoryKind): CensusObservation[] {
  return core.observations.filter((item) => item.kind === kind);
}

function table(headers: readonly string[], body: readonly (readonly string[])[]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

export function projectSummary(core: CensusCore): string {
  return [
    '# Modular monolith architecture census',
    '',
    `- schemaVersion: \`${core.schemaVersion}\``,
    `- sourceCommit: \`${core.captureIdentity.sourceCommit}\``,
    `- sourceTree: \`${core.captureIdentity.sourceTree}\``,
    `- commitTime: \`${core.captureIdentity.commitTime}\``,
    `- observations: ${core.observations.length}`,
    '',
    'This baseline does not activate architecture rules or change product, CI, database, runtime, or production selectors.',
    '',
    '## Inventory denominators',
    '',
    table(
      ['kind', 'discovered', 'represented', 'excluded', 'duplicate', 'unresolved'],
      core.manifests.map((manifest) => [
        manifest.kind,
        String(manifest.totals.discovered),
        String(manifest.totals.represented),
        String(manifest.totals.excluded),
        String(manifest.totals.duplicate),
        String(manifest.totals.unresolved),
      ]),
    ),
    '',
  ].join('\n');
}

export function projectOwnership(core: CensusCore): string {
  const counts = {
    'resolved-current': 0,
    'candidate-target': 0,
    ambiguous: 0,
  };
  for (const item of core.observations) {
    counts[item.ownership.state] += 1;
  }
  const ambiguous = core.observations.filter((item) => item.ownership.state === 'ambiguous').slice(0, 200);
  return [
    '# Ownership projection',
    '',
    `- resolved-current: ${counts['resolved-current']}`,
    `- candidate-target: ${counts['candidate-target']}`,
    `- ambiguous: ${counts.ambiguous}`,
    '',
    'Ambiguity is retained for charter adjudication. This projection does not choose an owner.',
    '',
    '## Ambiguous observations',
    '',
    ambiguous.length === 0
      ? '_None._'
      : table(
        ['id', 'candidate', 'evidence'],
        ambiguous.map((item) => [
          item.id,
          item.ownership.candidateTargetOwner ?? 'null',
          item.ownership.conflictingEvidence.join('; ') || item.ownership.currentOwnerEvidence.join('; '),
        ]),
      ),
    '',
  ].join('\n');
}

export function projectDependency(core: CensusCore): string {
  const edges = rows(core, 'dependency-edge');
  const deep = rows(core, 'deep-import');
  const featureToApp = edges.filter((item) => item.attributes.featureToApp === true);
  const productionFeatureToApp = featureToApp.filter((item) => item.attributes.context === 'production');
  const testFeatureToApp = featureToApp.filter((item) => item.attributes.context === 'test');
  return [
    '# Dependency projection',
    '',
    `- dependency-edge: ${edges.length}`,
    `- reverse-edge: ${rows(core, 'reverse-edge').length}`,
    `- deep-import: ${deep.length}`,
    `- production feature-to-app: ${productionFeatureToApp.length}`,
    `- test feature-to-app: ${testFeatureToApp.length}`,
    '',
    'Counts are observations, not architecture findings.',
    '',
    '## Production feature-to-App Router edges',
    '',
    productionFeatureToApp.length === 0
      ? '_None._'
      : table(
        ['id', 'from', 'to'],
        productionFeatureToApp.map((item) => [item.identity, String(item.attributes.from), String(item.attributes.to)]),
      ),
    '',
    '## Deep imports',
    '',
    deep.length === 0
      ? '_None._'
      : table(
        ['id', 'from', 'to'],
        deep.slice(0, 200).map((item) => [item.identity, String(item.attributes.from), String(item.attributes.to)]),
      ),
    deep.length > 200 ? `\n_Truncated to 200 of ${deep.length} deep-import observations. Complete set is in census-core.json._\n` : '',
  ].join('\n').replace(/\n+$/u, '\n');
}

export function projectCycles(core: CensusCore): string {
  const sccs = rows(core, 'scc');
  return [
    '# Cycle projection',
    '',
    `- strongly connected components: ${sccs.length}`,
    '',
    'Each SCC lists member count and constituent edge count. Complete member/edge identities remain in census-core.json.',
    '',
    sccs.length === 0
      ? '_None._'
      : table(
        ['id', 'members', 'edges'],
        sccs.map((item) => [item.identity, String(item.attributes.memberCount), String(item.attributes.edgeCount)]),
      ),
    '',
  ].join('\n');
}

export function projectGates(core: CensusCore): string {
  const gates = rows(core, 'gate');
  return [
    '# Gate projection',
    '',
    `- gates: ${gates.length}`,
    '',
    'Missing classification evidence remains unresolved. This projection does not weaken or relocate a gate.',
    '',
    gates.length === 0
      ? '_None._'
      : table(
        ['id', 'validator', 'boundary', 'class'],
        gates.map((item) => [
          item.identity,
          String(item.attributes.validator ?? item.identity),
          String(item.attributes.protectedBoundary ?? 'unresolved'),
          item.trustClass ?? 'unresolved',
        ]),
      ),
    '',
  ].join('\n');
}

export function projectCompatibility(core: CensusCore): string {
  const items = rows(core, 'compatibility-surface');
  return [
    '# Compatibility projection',
    '',
    `- compatibility surfaces: ${items.length}`,
    '',
    'Deletion eligibility is unknown until the charter ledger records a replacement and follow-up change.',
    '',
    items.length === 0
      ? '_None._'
      : table(
        ['id', 'notes'],
        items.map((item) => [item.identity, item.notes.join('; ')]),
      ),
    '',
  ].join('\n');
}

export function projectMetrics(core: CensusCore, censusCoreHash: string, receiptIds: readonly string[] = []): string {
  const centers = rows(core, 'change-center');
  return [
    '# Metric projection',
    '',
    `- censusCoreHash: \`${censusCoreHash}\``,
    `- frozenReceiptIds: ${receiptIds.length === 0 ? '_none captured in this projection_' : receiptIds.map((id) => `\`${id}\``).join(', ')}`,
    '',
    'Size and command counts are observations. They are not architecture findings or enforcement budgets.',
    '',
    '## Command summaries',
    '',
    table(
      ['commandId', 'scope', 'exitStatus', 'fingerprint'],
      core.commandSummaries.map((item) => [
        item.commandId,
        item.scope,
        String(item.exitStatus ?? 'null'),
        item.fingerprint ?? 'null',
      ]),
    ),
    '',
    '## Oversized change centers',
    '',
    centers.length === 0
      ? '_None._'
      : table(
        ['path', 'bytes', 'notes'],
        centers.map((item) => [item.identity, String(item.attributes.byteLength), item.notes.join('; ')]),
      ),
    '',
  ].join('\n');
}

export function projectAll(
  core: CensusCore,
  censusCoreHash: string,
  receiptIds: readonly string[] = [],
): Record<string, string> {
  return {
    'summary.md': projectSummary(core),
    'ownership.md': projectOwnership(core),
    'dependency.md': projectDependency(core),
    'cycles.md': projectCycles(core),
    'gates.md': projectGates(core),
    'compatibility.md': projectCompatibility(core),
    'metrics.md': projectMetrics(core, censusCoreHash, receiptIds),
  };
}

export function frozenProjectionIdentity(censusCoreHash: string, receiptIds: readonly string[]): string {
  return serializeDeterministic({ censusCoreHash, receiptIds: [...receiptIds].sort() });
}
