#!/usr/bin/env tsx
/**
 * Rebuild published domain-teaching fragments against the live successor
 * Authority snapshot. `--write-authoring` updates live authoring files.
 * This is not a production selector mutation.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  verifyMaterializedSnapshot,
  type AuthorityEngineeringBody,
  type AuthoritySnapshotManifest,
} from '@/lib/authoritative-knowledge/authority-snapshot';
import { writeDomainFragmentsToCandidate } from '@/lib/latest-authority-oss-cutover/domain-fragment-files';
import {
  assertNotProductionSelectorPath,
  composeSuccessorDomainTeachingProjection,
  createSuccessorDomainTeachingEnvelope,
  GENERATION_3_AUTHORING_RELATIVE_BY_FRAGMENT_KEY,
  GENERATION_3_AUTHORING_RELATIVES,
  GENERATION_3_PUBLISHED_RELATIVE_BY_FRAGMENT_KEY,
  LIVE_AUTHORING_COMPOSED_MANIFEST_RELATIVE,
  rebindFragmentAuthoringToSuccessorEnvelope,
  type SuccessorAuthorityManifestBinding,
  type SuccessorEngineeringObject,
} from '@/lib/latest-authority-oss-cutover/successor-domain-fragments';
import {
  composeDomainTeachingProjection,
  LIVE_AUTHORITY_DOMAIN_TEACHING_MANIFEST_RELATIVE,
  liveAuthorityEnvelopeForFirstFragment,
  LIVE_FIRST_FRAGMENT_AUTHORITY_NODES,
  translateAndBuildFirstDomainFragment,
  type DomainTeachingFragmentAuthoring,
} from '@/lib/teaching-projection';

const ROOT = process.cwd();
const GENERATION_3_COMPOSED_MANIFEST_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/composed-manifest.json';
const FIRST_FRAGMENT_AUTHORING_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.authoring.json';
const FIRST_FRAGMENT_PUBLISHED_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.json';

function fail(message: string): never {
  throw new Error(`compose-successor-domain-fragments: ${message}`);
}

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`missing ${name}`);
  return value;
}

function optionOr(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value !== undefined && (!value || value.startsWith('--'))) fail(`missing ${name}`);
  return value ?? fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function absolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  assertNotProductionSelectorPath(filePath);
  const target = absolute(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function collectAuthoringPaths(): string[] {
  const collected: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] !== '--authoring-fragment') continue;
    const value = process.argv[index + 1];
    if (!value || value.startsWith('--')) fail('missing --authoring-fragment');
    collected.push(value);
  }
  return collected.length > 0 ? collected : [...GENERATION_3_AUTHORING_RELATIVES];
}

function main(): void {
  const writeAuthoring = hasFlag('--write-authoring');
  const successorManifestPath = optionOr(
    '--successor-authority-manifest',
    LIVE_AUTHORITY_DOMAIN_TEACHING_MANIFEST_RELATIVE,
  );
  const out = hasFlag('--out') ? option('--out') : undefined;
  if (!writeAuthoring && !out) {
    fail('provide --write-authoring and/or --out');
  }

  const successorManifest = readJson<SuccessorAuthorityManifestBinding & AuthoritySnapshotManifest>(
    successorManifestPath,
  );
  const engineering = readJson<{ objects: SuccessorEngineeringObject[] } & AuthorityEngineeringBody>(
    path.join(path.dirname(absolute(successorManifestPath)), 'engineering.json'),
  );
  verifyMaterializedSnapshot({
    manifest: successorManifest,
    engineering,
  });

  const authorings = collectAuthoringPaths().map((filePath) => (
    readJson<DomainTeachingFragmentAuthoring>(filePath)
  ));
  const dropMissing = hasFlag('--drop-missing-endpoints');
  const liveIds = new Set(
    engineering.objects
      .filter((object) => (
        object.reviewStatus === 'approved'
        && object.publicationStatus === 'published'
        && (object.lifecycleStatus == null || object.lifecycleStatus === 'active')
        && typeof object.canonicalId === 'string'
      ))
      .map((object) => object.canonicalId as string),
  );
  const droppedEndpoints: string[] = [];
  const successorAuthorings = authorings.map((authoring) => {
    if (!dropMissing) return authoring;
    const dropped = new Set<string>();
    const coreNodes = authoring.coreNodes.filter((node) => {
      if (liveIds.has(node.canonicalId)) return true;
      dropped.add(node.canonicalId);
      return false;
    });
    const relations = authoring.relations.filter((relation) => {
      if (liveIds.has(relation.sourceNodeId) && liveIds.has(relation.targetNodeId)) return true;
      if (!liveIds.has(relation.sourceNodeId)) dropped.add(relation.sourceNodeId);
      if (!liveIds.has(relation.targetNodeId)) dropped.add(relation.targetNodeId);
      return false;
    });
    droppedEndpoints.push(...dropped);
    return { ...authoring, coreNodes, relations };
  });
  const artifacts = composeSuccessorDomainTeachingProjection({
    manifest: successorManifest,
    authorings: successorAuthorings,
    objects: engineering.objects,
  });

  if (out) {
    const manifestOut = path.join(out, 'composed-domain-fragment-manifest.json');
    mkdirSync(absolute(out), { recursive: true });
    writeJson(manifestOut, artifacts.manifest);
    writeDomainFragmentsToCandidate(absolute(out), artifacts.fragments, { overwrite: true });
  }

  if (writeAuthoring) {
    const envelope = createSuccessorDomainTeachingEnvelope({
      manifest: successorManifest,
      authorings,
      objects: engineering.objects,
    });
    writeJson(GENERATION_3_COMPOSED_MANIFEST_RELATIVE, artifacts.manifest);
    for (const fragment of artifacts.fragments) {
      const publishedRelative = GENERATION_3_PUBLISHED_RELATIVE_BY_FRAGMENT_KEY[fragment.fragmentKey];
      if (!publishedRelative) {
        fail(`no live published path mapping for fragmentKey ${fragment.fragmentKey}`);
      }
      writeJson(publishedRelative, fragment);
    }
    for (const authoring of authorings) {
      const authoringRelative = GENERATION_3_AUTHORING_RELATIVE_BY_FRAGMENT_KEY[authoring.fragmentKey];
      if (!authoringRelative) {
        fail(`no live authoring path mapping for fragmentKey ${authoring.fragmentKey}`);
      }
      writeJson(
        authoringRelative,
        rebindFragmentAuthoringToSuccessorEnvelope(authoring, envelope),
      );
    }

    const firstEnvelope = liveAuthorityEnvelopeForFirstFragment(
      LIVE_FIRST_FRAGMENT_AUTHORITY_NODES,
    );
    const first = translateAndBuildFirstDomainFragment({ authority: firstEnvelope });
    const firstComposed = composeDomainTeachingProjection({
      fragments: [first.fragment],
      authoringRevision: firstEnvelope.authoringRevision,
      authority: firstEnvelope,
    });
    writeJson(FIRST_FRAGMENT_AUTHORING_RELATIVE, first.authoring);
    writeJson(FIRST_FRAGMENT_PUBLISHED_RELATIVE, first.fragment);
    writeJson(LIVE_AUTHORING_COMPOSED_MANIFEST_RELATIVE, firstComposed.manifest);
  }

  process.stdout.write(
    `${JSON.stringify({
      writeAuthoring,
      out: out ? path.resolve(ROOT, out) : null,
      projectionHash: artifacts.manifest.projectionHash,
      domainFragmentSetHash: artifacts.manifest.sourceHashes.fragments,
      snapshotId: artifacts.manifest.authorityBinding.snapshotId,
      fragmentIds: artifacts.fragments.map((fragment) => fragment.fragmentId),
      droppedEndpoints: [...new Set(droppedEndpoints)].sort(),
    }, null, 2)}\n`,
  );
}

main();
