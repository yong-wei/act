import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from './authoritative-release';

const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;

type JsonObject = Record<string, unknown>;

interface PreviousBundle {
  bundle_id: string;
  sha256sums_sha256: string;
}

interface StableAggregateManifest {
  bundle_contract_version: string;
  bundle_digest: string;
  bundle_id: string;
  bundle_kind: 'aggregate';
  publication: { tag: string };
  previous_bundle: PreviousBundle | null;
  release: {
    release_hash: string;
    release_id: string;
    release_version: string;
    source_dataset_hash: string;
  };
  release_stage: 'stable';
  schema: { sha256: string; version: string };
  source_revision: { commit: string; tag: string };
  statistics: JsonObject;
}

interface Candidate {
  bundleDir: string;
  bundleFiles: string[];
  manifest: StableAggregateManifest;
  manifestSha256: string;
  sha256sumsSha256: string;
  sha256sumsBytes: Buffer;
  validationReportSha256: string;
}

export interface LatestStableAggregateBinding extends JsonObject {
  protocol: 'act-latest-stable-aggregate-binding/1';
  selectionPolicy: 'LATEST_STABLE_AGGREGATE';
  actkgMainCommit: string;
  sourceCommit: string;
  sourceTag: string;
  packagingCommit: string;
  stableTag: string;
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  sourceDatasetHash: string;
  bundleId: string;
  bundleDigest: string;
  manifestSha256: string;
  sha256sumsSha256: string;
  validationReportSha256: string;
  schemaVersion: string;
  schemaSha256: string;
  predecessorBundleId: string | null;
  candidateChain: string[];
  candidateChainEndpoints: string[];
  statistics: JsonObject;
  bundlePath: string;
  resolutionDigest: string;
}

function fail(message: string): never {
  throw new Error(`Latest stable Aggregate resolution failed: ${message}`);
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function hash(value: unknown, label: string): string {
  const result = string(value, label);
  if (!SHA256.test(result)) fail(`${label} must be a lowercase SHA-256`);
  return result;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitBytes(root: string, args: string[]): Buffer {
  return execFileSync('git', ['-C', root, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function parseManifest(value: unknown, label: string): StableAggregateManifest | null {
  const row = object(value, label);
  if (row.bundle_kind !== 'aggregate' || row.release_stage !== 'stable') return null;
  const release = object(row.release, `${label}.release`);
  const source = object(row.source_revision, `${label}.source_revision`);
  const publication = object(row.publication, `${label}.publication`);
  const schema = object(row.schema, `${label}.schema`);
  const previous = row.previous_bundle === null || row.previous_bundle === undefined
    ? null
    : object(row.previous_bundle, `${label}.previous_bundle`);
  return {
    bundle_contract_version: string(
      row.bundle_contract_version,
      `${label}.bundle_contract_version`,
    ),
    bundle_digest: hash(row.bundle_digest, `${label}.bundle_digest`),
    bundle_id: string(row.bundle_id, `${label}.bundle_id`),
    bundle_kind: 'aggregate',
    publication: { tag: string(publication.tag, `${label}.publication.tag`) },
    previous_bundle: previous
      ? {
          bundle_id: string(previous.bundle_id, `${label}.previous_bundle.bundle_id`),
          sha256sums_sha256: hash(
            previous.sha256sums_sha256,
            `${label}.previous_bundle.sha256sums_sha256`,
          ),
        }
      : null,
    release: {
      release_hash: hash(release.release_hash, `${label}.release.release_hash`),
      release_id: string(release.release_id, `${label}.release.release_id`),
      release_version: string(
        release.release_version,
        `${label}.release.release_version`,
      ),
      source_dataset_hash: hash(
        release.source_dataset_hash,
        `${label}.release.source_dataset_hash`,
      ),
    },
    release_stage: 'stable',
    schema: {
      sha256: hash(schema.sha256, `${label}.schema.sha256`),
      version: string(schema.version, `${label}.schema.version`),
    },
    source_revision: {
      commit: string(source.commit, `${label}.source_revision.commit`),
      tag: string(source.tag, `${label}.source_revision.tag`),
    },
    statistics: object(row.statistics, `${label}.statistics`),
  };
}

function parseSums(value: string, label: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const [index, line] of value.trimEnd().split('\n').entries()) {
    const match = /^([0-9a-f]{64}) {2}(.+)$/u.exec(line);
    if (!match) fail(`${label}:${index + 1} is not a canonical SHA256SUMS row`);
    if (result.has(match[2])) fail(`${label} repeats ${match[2]}`);
    result.set(match[2], match[1]);
  }
  return result;
}

async function loadCandidate(bundleDir: string): Promise<Candidate | null> {
  const manifestPath = path.join(bundleDir, 'bundle-manifest.json');
  const manifestBytes = await readFile(manifestPath).catch(() => null);
  if (!manifestBytes) return null;
  const manifest = parseManifest(
    JSON.parse(manifestBytes.toString('utf8')),
    manifestPath,
  );
  if (!manifest) return null;

  const sumsPath = path.join(bundleDir, 'SHA256SUMS');
  const sumsBytes = await readFile(sumsPath);
  const sums = parseSums(sumsBytes.toString('utf8'), sumsPath);
  const files = (await readdir(bundleDir))
    .filter((name) => name !== 'SHA256SUMS')
    .sort();
  if (canonicalJson([...sums.keys()].sort()) !== canonicalJson(files)) {
    fail(`${manifest.bundle_id} SHA256SUMS does not close over the Bundle`);
  }
  for (const [name, expected] of sums) {
    const filePath = path.join(bundleDir, name);
    if (!(await stat(filePath)).isFile()) fail(`${filePath} is not a regular file`);
    if (sha256(await readFile(filePath)) !== expected) {
      fail(`${manifest.bundle_id} SHA256SUMS mismatch: ${name}`);
    }
  }
  const reportBytes = await readFile(path.join(bundleDir, 'validation-report.json'));
  const report = object(JSON.parse(reportBytes.toString('utf8')), 'validation-report');
  if (report.result !== 'PASS') fail(`${manifest.bundle_id} validation report is not PASS`);

  return {
    bundleDir,
    bundleFiles: files,
    manifest,
    manifestSha256: sha256(manifestBytes),
    sha256sumsSha256: sha256(sumsBytes),
    sha256sumsBytes: sumsBytes,
    validationReportSha256: sha256(reportBytes),
  };
}

export async function resolveLatestStableAggregate(options: {
  actkgRoot: string;
  releasesPath?: string;
  mainRef?: string;
}): Promise<LatestStableAggregateBinding> {
  const actkgRoot = path.resolve(options.actkgRoot);
  const releasesRoot = path.resolve(
    actkgRoot,
    options.releasesPath ?? 'releases',
  );
  const mainRef = options.mainRef ?? 'origin/main';
  const candidates = (
    await Promise.all(
      (await readdir(releasesRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => loadCandidate(path.join(releasesRoot, entry.name))),
    )
  ).filter((candidate): candidate is Candidate => candidate !== null);
  if (candidates.length === 0) fail('no stable aggregate Manifest exists');

  const byId = new Map<string, Candidate>();
  for (const candidate of candidates) {
    if (byId.has(candidate.manifest.bundle_id)) {
      fail(`duplicate bundle_id ${candidate.manifest.bundle_id}`);
    }
    byId.set(candidate.manifest.bundle_id, candidate);
  }
  const referenced = new Set<string>();
  for (const candidate of candidates) {
    const previous = candidate.manifest.previous_bundle;
    if (previous && !byId.has(previous.bundle_id)) {
      fail(
        `${candidate.manifest.bundle_id} previous_bundle ${previous.bundle_id} is missing from the stable Aggregate candidate set`,
      );
    }
    if (!previous) continue;
    referenced.add(previous.bundle_id);
    const predecessor = byId.get(previous.bundle_id)!;
    if (predecessor.sha256sumsSha256 !== previous.sha256sums_sha256) {
      fail(`${candidate.manifest.bundle_id} predecessor SHA256SUMS drift`);
    }
  }
  const endpoints = candidates.filter(
    (candidate) => !referenced.has(candidate.manifest.bundle_id),
  );
  if (endpoints.length !== 1) {
    fail(`expected one endpoint, found ${endpoints.length}`);
  }

  const chain: Candidate[] = [];
  const visited = new Set<string>();
  let current: Candidate | undefined = endpoints[0];
  while (current) {
    if (visited.has(current.manifest.bundle_id)) fail('previous_bundle cycle detected');
    visited.add(current.manifest.bundle_id);
    chain.unshift(current);
    const previousId: string | undefined =
      current.manifest.previous_bundle?.bundle_id;
    current = previousId ? byId.get(previousId) : undefined;
  }
  if (visited.size !== candidates.length) {
    fail('stable Aggregate manifests do not form one closed chain');
  }

  const endpoint = endpoints[0];
  const manifest = endpoint.manifest;
  const actkgMainCommit = git(actkgRoot, ['rev-parse', `${mainRef}^{commit}`]);
  const sourceCommit = git(actkgRoot, [
    'rev-parse',
    `${manifest.source_revision.tag}^{commit}`,
  ]);
  const packagingCommit = git(actkgRoot, [
    'rev-parse',
    `${manifest.publication.tag}^{commit}`,
  ]);
  for (const [value, label] of [
    [actkgMainCommit, 'main commit'],
    [sourceCommit, 'source tag commit'],
    [packagingCommit, 'stable tag commit'],
  ] as const) {
    if (!COMMIT.test(value)) fail(`${label} is not a Git commit`);
  }
  if (sourceCommit !== manifest.source_revision.commit) {
    fail('source tag does not peel to Manifest source commit');
  }
  for (const commit of [sourceCommit, packagingCommit]) {
    try {
      git(actkgRoot, ['merge-base', '--is-ancestor', commit, actkgMainCommit]);
    } catch {
      fail(`${commit} is not an ancestor of ${mainRef}`);
    }
  }

  const bundleRelativePath = path.relative(actkgRoot, endpoint.bundleDir);
  if (
    !bundleRelativePath
    || bundleRelativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(bundleRelativePath)
  ) {
    fail('stable Aggregate bundle path is outside the ActKG repository');
  }
  const stableTagSumsPath = `${bundleRelativePath.split(path.sep).join('/')}/SHA256SUMS`;
  let stableTagSums: Buffer;
  try {
    stableTagSums = gitBytes(actkgRoot, [
      'show',
      `${manifest.publication.tag}:${stableTagSumsPath}`,
    ]);
  } catch {
    fail(`stable tag ${manifest.publication.tag} is missing ${stableTagSumsPath}`);
  }
  if (!stableTagSums.equals(endpoint.sha256sumsBytes)) {
    fail(`stable tag ${manifest.publication.tag} SHA256SUMS bytes drift`);
  }
  for (const name of endpoint.bundleFiles) {
    const stableTagMemberPath = `${bundleRelativePath.split(path.sep).join('/')}/${name}`;
    let stableTagMember: Buffer;
    try {
      stableTagMember = gitBytes(actkgRoot, [
        'show',
        `${manifest.publication.tag}:${stableTagMemberPath}`,
      ]);
    } catch {
      fail(`stable tag ${manifest.publication.tag} is missing ${stableTagMemberPath}`);
    }
    const currentMember = await readFile(path.join(endpoint.bundleDir, name));
    if (!stableTagMember.equals(currentMember)) {
      fail(`stable tag ${manifest.publication.tag} Bundle member bytes drift: ${name}`);
    }
  }

  const body = {
    protocol: 'act-latest-stable-aggregate-binding/1' as const,
    selectionPolicy: 'LATEST_STABLE_AGGREGATE' as const,
    actkgMainCommit,
    sourceCommit,
    sourceTag: manifest.source_revision.tag,
    packagingCommit,
    stableTag: manifest.publication.tag,
    releaseId: manifest.release.release_id,
    releaseVersion: manifest.release.release_version,
    releaseHash: manifest.release.release_hash,
    sourceDatasetHash: manifest.release.source_dataset_hash,
    bundleId: manifest.bundle_id,
    bundleDigest: manifest.bundle_digest,
    manifestSha256: endpoint.manifestSha256,
    sha256sumsSha256: endpoint.sha256sumsSha256,
    validationReportSha256: endpoint.validationReportSha256,
    schemaVersion: manifest.schema.version,
    schemaSha256: manifest.schema.sha256,
    predecessorBundleId: manifest.previous_bundle?.bundle_id ?? null,
    candidateChain: chain.map((candidate) => candidate.manifest.bundle_id),
    candidateChainEndpoints: [manifest.bundle_id],
    statistics: manifest.statistics,
    bundlePath: path.relative(actkgRoot, endpoint.bundleDir),
  };
  return {
    ...body,
    resolutionDigest: sha256(canonicalJson(body)),
  };
}
