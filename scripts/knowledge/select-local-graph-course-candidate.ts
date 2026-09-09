import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { activateAuthoritySnapshot, resolveAuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';
import { verifyMaterializedSnapshot, type AuthorityEngineeringBody, type AuthoritySnapshotManifest } from '@/lib/authoritative-knowledge/authority-snapshot';
import { buildAuthorityDomainCatalog } from '@/lib/authority-domain-catalog/builder';
import type { AuthorityDomainCatalogAuthoring } from '@/lib/authority-domain-catalog/contracts';
import { materializeAuthorityDomainCatalogRuntime, resolveAuthorityDomainCatalogPaths } from '@/lib/authority-domain-catalog/loader';
import { activateConsumerActivation, loadStagedConsumerActivation, readCurrentConsumerActivationPointer, resolveConsumerActivationStorePaths, rollbackConsumerActivation } from '@/lib/versioned-knowledge-activation/store';

// Local preview only. Production must use the stopped-service coordinated transaction.
const root = process.cwd();
if (!process.argv.includes('--local-preview') || execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' }).trim() !== 'true') {
  throw new Error('This command requires --local-preview inside the authoring Git worktree');
}
const arg = (name: string) => { const i = process.argv.indexOf(name); const value = i >= 0 ? process.argv[i + 1] : undefined; if (!value) throw new Error('missing ' + name); return value; };
const candidate = arg('--candidate-root');
const read = <T>(relative: string): T => JSON.parse(readFileSync(join(root, relative), 'utf8')) as T;
const stage = read<{ successor: { activationId: string }; predecessor: { activationId: string; activationHash: string } }>(candidate + '/consumer-activation-stage.json');
const consumers = resolveConsumerActivationStorePaths(join(root, 'course-content/runtime/knowledge/consumer-activation'));
const staged = loadStagedConsumerActivation(consumers, stage.successor.activationId);
if (staged.manifest.impact.readyConsumerIds.length !== 6) throw new Error('candidate must qualify all six consumers');
const graph = staged.manifest.consumers.find((row) => row.consumerId === 'engineering-graph')!;
const snapshotId = graph.combination?.authoritySnapshotId;
if (!snapshotId) throw new Error('candidate Authority is absent');
const snapshotRoot = 'course-content/authoring/knowledge/authority/releases/' + snapshotId;
const manifest = read<AuthoritySnapshotManifest>(snapshotRoot + '/manifest.json');
const engineering = read<AuthorityEngineeringBody>(snapshotRoot + '/engineering.json');
verifyMaterializedSnapshot({ manifest, engineering });
const authoring = read<AuthorityDomainCatalogAuthoring>(candidate + '/domain-catalog/catalog-authoring.json');
const nodes = engineering.objects.map((row) => ({ canonicalId: row.canonicalId, lifecycleStatus: row.lifecycleStatus ?? 'active' }));
const catalog = buildAuthorityDomainCatalog(authoring, nodes);
if (catalog.authorityBinding.snapshotHash !== manifest.snapshotHash) throw new Error('candidate catalog Authority differs');
const prior = readCurrentConsumerActivationPointer(consumers);
if (prior?.activationId !== stage.predecessor.activationId && prior?.activationId !== staged.activationId) {
  const current = prior ? loadStagedConsumerActivation(consumers, prior.activationId) : null;
  if (current?.manifest.priorActivationId !== stage.predecessor.activationId
    || current.manifest.priorActivationHash !== stage.predecessor.activationHash) throw new Error('local preview cannot reach the observed production predecessor');
  const rolled = rollbackConsumerActivation(consumers, { toActivationId: stage.predecessor.activationId, toActivationHash: stage.predecessor.activationHash });
  if (rolled.status !== 'rolled-back') throw new Error('local predecessor restore failed');
}
const activated = activateAuthoritySnapshot(resolveAuthorityStorePaths(join(root, 'course-content/authoring/knowledge/authority')), { snapshotId });
if (activated.status !== 'activated') throw new Error('local Authority activation failed');
const catalogPaths = resolveAuthorityDomainCatalogPaths(root);
materializeAuthorityDomainCatalogRuntime({ ...catalogPaths, authoringCatalogPath: join(root, candidate, 'domain-catalog/catalog-authoring.json') }, nodes);
if (prior?.activationId !== staged.activationId) {
  const result = activateConsumerActivation(consumers, { activationId: staged.activationId });
  if (result.status !== 'activated') throw new Error('local consumer activation failed: ' + result.receipt.reasons.join('; '));
}
console.log(JSON.stringify({ localPreview: true, snapshotId, catalogId: catalog.catalogId, activationId: staged.activationId }));
