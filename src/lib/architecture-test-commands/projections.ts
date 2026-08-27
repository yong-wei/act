import type { DiscoveryCore } from './types';

function line(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function projectCommandContractsDoc(core: DiscoveryCore): string {
  const commands = core.commands.map((command) => [
    `## \`${command.npmScript}\``,
    '',
    `- command id: \`${command.id}\``,
    `- scope: ${command.scope}`,
    `- layers: ${command.layers.length > 0 ? command.layers.map((layer) => `\`${layer}\``).join(', ') : '(PR composition, not a layer)'}`,
    `- required inputs: ${command.requiredInputs.length > 0 ? command.requiredInputs.join(', ') : 'none'}`,
    `- excluded scopes: ${command.excludedScopes.join(', ') || 'none'}`,
    `- CI: ${command.ciWorkflow ? `${command.ciWorkflow} / ${command.ciJob}` : 'not a current required check'}`,
    command.historicalComponents.length > 0
      ? `- retained components:\n${command.historicalComponents.map((item) => `  - \`${item.npmScript}\` (${item.owner}: ${item.role})`).join('\n')}`
      : '- retained components: none',
    '',
  ].join('\n'));
  return [
    '# Test command contracts',
    '',
    'Observation counts are revision-bound. Read `docs/testing/baseline/discovery-core.json` for the current denominator.',
    '',
    `- schemaVersion: \`${core.schemaVersion}\``,
    `- sourceCommit: \`${core.sourceCommit}\``,
    `- sourceTree: \`${core.sourceTree}\``,
    `- baseline census: \`${core.baseline.censusCoreSha256}\``,
    `- charter: \`${core.charter.sha256}\``,
    `- discovered: ${core.totals.discovered}`,
    `- classified: ${core.totals.classified}`,
    `- excluded: ${core.totals.excluded}`,
    `- unresolved: ${core.totals.unresolved}`,
    '',
    'Current red executions are not accepted failures. They remain blockers for `eliminate-accepted-red-test-baseline`.',
    '',
    ...commands,
    '## Discovery rules',
    '',
    'Include:',
    line(core.includeRules),
    '',
    'Exclude:',
    line(core.excludeRules),
    '',
  ].join('\n');
}

export function projectReceiptsDoc(core: DiscoveryCore): string {
  return [
    '# Test receipts',
    '',
    'Deterministic discovery cores are byte-identical for the same revision and declared inputs.',
    'Duration, RSS, Node/OS, and service state belong in a measurement receipt. A new measurement creates a new receipt identity.',
    '',
    `- discovery schema: \`${core.schemaVersion}\``,
    `- measurement schema: \`act-test-command-measurement-receipt/v1\``,
    `- release manifest schema: \`act-release-qualification-manifest/v1\``,
    `- baseline census: \`${core.baseline.censusCoreSha256}\``,
    `- charter: \`${core.charter.sha256}\``,
    '',
    'Qualified receipts must not contain credentials, raw event payloads, learner identifiers, or machine-local absolute paths.',
    '',
    'Do not encode a current pass/fail count as a permanent constant. Read the receipt bound to the source revision.',
    '',
  ].join('\n');
}

export function projectCiMappingDoc(core: DiscoveryCore): string {
  const rows = core.commands.map((command) => {
    const check = command.ciWorkflow ? `${command.ciWorkflow} job \`${command.ciJob}\`` : 'none yet; later CI change must reuse this command id';
    return `| \`${command.id}\` | \`${command.npmScript}\` | ${check} | ${command.scope} |`;
  });
  return [
    '# CI command mapping',
    '',
    'Each required CI check must invoke exactly one governed local command, or a documented composition of governed commands, with the same scope and receipt semantics.',
    '',
    '| command id | npm script | current CI check | scope |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    'The historical `npm test` commercial UI evidence validator is not a PR command. It is a `test:release` component.',
    'The historical Playwright bundle `test:integration` is retained as `test:e2e:playwright` and is not the integration command contract.',
    '',
    `Pinned charter: \`${core.charter.sha256}\`.`,
    `Pinned census: \`${core.baseline.censusCoreSha256}\`.`,
    '',
  ].join('\n');
}

export function projectHandoffDoc(core: DiscoveryCore): string {
  const unresolved = core.unresolved.length === 0
    ? ['- Discovery currently closes. Remaining redness is execution, not an accepted failure.']
    : core.unresolved.slice(0, 40).map((item) => `- \`${item.identity}\` (${item.code}: ${item.detail})`);
  return [
    '# Test command contract handoff',
    '',
    'Inputs for `eliminate-accepted-red-test-baseline`, `split-production-tooling-test-typescript-graphs`, and CI gates.',
    '',
    `- discovery sourceCommit: \`${core.sourceCommit}\``,
    `- discovery sourceTree: \`${core.sourceTree}\``,
    `- unresolved: ${core.totals.unresolved}`,
    `- classified: ${core.totals.classified}`,
    '',
    '## Remaining blockers',
    '',
    ...unresolved,
    '',
    '- `test:unit` still observes failing tests and unhandled errors from the frozen census measurement; do not mark them accepted.',
    '- `test:release` has no qualification manifest yet. Missing evidence is a release blocker, not a product-test skip.',
    '- This change does not claim the default gate is green.',
    '',
  ].join('\n');
}
