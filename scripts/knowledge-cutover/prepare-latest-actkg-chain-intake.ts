#!/usr/bin/env tsx

import { createHash } from 'node:crypto';
import {
  cp,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { canonicalJson } from '../actkg-release/authoritative-release';
import {
  CTKG_SCHEMA_VERSION,
  isBundleContractSupported,
  isSchemaIdentitySupported,
} from '../actkg-release/bundle-compatibility-registry';
import {
  resolveLatestStableAggregateWithCandidates,
  loadLatestStableAggregateAdmittedEndpoint,
  type LatestStableAggregateBinding,
  type LatestStableAggregateAdmittedEndpoint,
  type LatestStableAggregateCandidate,
} from '../actkg-release/latest-stable-aggregate';

type JsonObject = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(`prepare-latest-actkg-chain-intake: ${message}`);
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

export function validateReleaseVersionSegment(
  value: unknown,
  label = 'release_version',
): string {
  const releaseVersion = string(value, label);
  if (
    releaseVersion === '.'
    || releaseVersion === '..'
    || releaseVersion.includes('/')
    || releaseVersion.includes('\\')
    || releaseVersion.includes('\u0000')
  ) {
    fail(`${label} must be a single safe path segment`);
  }
  return releaseVersion;
}

function hash(value: unknown, label: string): string {
  const result = string(value, label);
  if (!/^[0-9a-f]{64}$/u.test(result)) fail(`${label} must be a lowercase SHA-256`);
  return result;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`${label} must be a non-negative integer`);
  }
  return value;
}

function artifactRecordCount(bytes: Buffer, mediaType: string): number | null {
  if (mediaType !== 'application/x-ndjson' && mediaType !== 'application/ndjson') return null;
  return bytes.toString('utf8').split(/\r?\n/u).filter((line) => line.length > 0).length;
}

function validateBundleMemberPath(value: unknown, label: string): string {
  const relative = string(value, label);
  if (
    path.posix.isAbsolute(relative)
    || path.posix.normalize(relative) !== relative
    || relative.includes('\\')
    || relative.includes('\u0000')
    || relative.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    fail(`${label} must be a normalized confined POSIX path`);
  }
  return relative;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseArgs(argv: string[]): {
  actkgRoot: string;
  mainRef: string;
  bindingPath: string;
  repoRoot: string;
  outputRoot: string;
  admittedEndpointPath?: string;
  predecessorRootClosurePath?: string;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      fail(`invalid argument near ${key ?? '<end>'}`);
    }
    if (values.has(key)) fail(`duplicate option ${key}`);
    values.set(key, value);
  }
  const allowed = new Set([
    '--actkg-root',
    '--main-ref',
    '--binding',
    '--repo-root',
    '--output-root',
    '--admitted-endpoint',
    '--predecessor-closure',
  ]);
  for (const key of values.keys()) {
    if (!allowed.has(key)) fail(`unknown option ${key}`);
  }
  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) fail(`missing ${key}`);
    return value;
  };
  return {
    actkgRoot: path.resolve(required('--actkg-root')),
    mainRef: values.get('--main-ref') ?? 'origin/main',
    bindingPath: path.resolve(required('--binding')),
    repoRoot: path.resolve(required('--repo-root')),
    outputRoot: path.resolve(required('--output-root')),
    admittedEndpointPath: values.has('--admitted-endpoint')
      ? path.resolve(required('--admitted-endpoint'))
      : undefined,
    predecessorRootClosurePath: values.has('--predecessor-closure')
      ? sourceRelative(values.get('--predecessor-closure'), '--predecessor-closure')
      : undefined,
  };
}

function repoRelative(repoRoot: string, absolute: string, label: string): string {
  const relative = path.relative(repoRoot, absolute);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`${label} must be inside repoRoot`);
  }
  return relative.split(path.sep).join('/');
}

function sourceRelative(value: unknown, label: string): string {
  const raw = string(value, label).replaceAll('\\', '/');
  if (path.posix.isAbsolute(raw)) fail(`${label} must be repository-relative`);
  const normalized = path.posix.normalize(raw);
  if (normalized === '..' || normalized.startsWith('../')) fail(`${label} escapes its repository`);
  return normalized;
}

async function requireAbsent(filePath: string, label: string): Promise<void> {
  try {
    await lstat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  fail(`${label} already exists; intake attempts are immutable and cannot be rerun`);
}

async function assertOutputRoot(repoRoot: string, outputRoot: string): Promise<void> {
  const rootPath = path.resolve(repoRoot);
  const rootReal = await realpath(rootPath).catch(() => fail(`repoRoot does not exist: ${repoRoot}`));
  const lexicalRelative = path.relative(rootPath, outputRoot);
  if (!lexicalRelative || lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
    fail('outputRoot must be inside repoRoot');
  }
  let ancestor = outputRoot;
  while (true) {
    try {
      const resolvedAncestor = await realpath(ancestor);
      if (resolvedAncestor !== rootReal) {
        repoRelative(rootReal, resolvedAncestor, 'outputRoot ancestor');
      }
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) fail('outputRoot has no existing parent inside repoRoot');
      ancestor = parent;
    }
  }
  await requireAbsent(outputRoot, 'outputRoot');
}

function bindingIdentity(binding: LatestStableAggregateBinding): JsonObject {
  const {
    resolutionDigest: _resolutionDigest,
    resolvedAt: _resolvedAt,
    ...body
  } = binding;
  return body;
}

async function loadFrozenBinding(filePath: string): Promise<{
  binding: LatestStableAggregateBinding;
  bytes: Buffer;
}> {
  const bytes = await readFile(filePath);
  const row = object(JSON.parse(bytes.toString('utf8')), 'binding');
  const { status: _status, iteration: _iteration, gates: _gates, ...body } = row;
  const binding = body as unknown as LatestStableAggregateBinding;
  hash(binding.resolutionDigest, 'binding.resolutionDigest');
  string(binding.bundlePath, 'binding.bundlePath');
  string(binding.bundleId, 'binding.bundleId');
  validateReleaseVersionSegment(binding.releaseVersion, 'binding.releaseVersion');
  if (!Array.isArray(binding.candidateChain) || binding.candidateChain.length < 2) {
    fail('binding.candidateChain must contain a closed chain');
  }
  return { binding, bytes };
}

function assertBindingMatches(
  expected: LatestStableAggregateBinding,
  actual: LatestStableAggregateBinding,
): void {
  if (
    expected.resolutionDigest !== actual.resolutionDigest
    || canonicalJson(bindingIdentity(expected)) !== canonicalJson(bindingIdentity(actual))
  ) {
    fail('live ActKG resolution no longer matches the frozen binding');
  }
}

type SourcePlan = {
  source: string;
  targetRelative: string;
  digest: string;
  label: string;
};

async function directoryDigest(directory: string): Promise<string> {
  const rows: string[] = [];
  const walk = async (current: string, relative: string): Promise<void> => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const child = path.join(current, entry.name);
      if (entry.isSymbolicLink()) fail(`source directory contains symlink: ${childRelative}`);
      if (entry.isDirectory()) {
        await walk(child, childRelative);
      } else if (entry.isFile()) {
        rows.push(`${childRelative}\u0000${sha256(await readFile(child))}`);
      } else {
        fail(`source directory contains non-regular entry: ${childRelative}`);
      }
    }
  };
  await walk(directory, '');
  return sha256(rows.join('\n'));
}

async function registerPlan(
  plans: Map<string, SourcePlan>,
  source: string,
  targetRelative: string,
  label: string,
): Promise<void> {
  const resolvedSource = await realpath(source).catch(() => fail(`${label} source is missing`));
  const sourceStat = await stat(resolvedSource).catch(() => null);
  if (!sourceStat?.isDirectory()) fail(`${label} source is not a directory`);
  const digest = await directoryDigest(resolvedSource);
  const existing = plans.get(targetRelative);
  if (existing && existing.digest !== digest) {
    fail(`target path collision with different source bytes: ${targetRelative}`);
  }
  if (!existing) plans.set(targetRelative, {
    source: resolvedSource,
    targetRelative,
    digest,
    label,
  });
}

type FoundStandardComponent = {
  directory: string;
  manifest: JsonObject;
  manifestBytes: Buffer;
};

async function findStandardComponent(
  actkgRoot: string,
  bundleId: string,
): Promise<FoundStandardComponent> {
  const matches: FoundStandardComponent[] = [];
  const releasesRoot = path.join(actkgRoot, 'releases');
  for (const entry of (await readdir(releasesRoot, { withFileTypes: true }))
    .filter((candidate) => candidate.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const directory = path.join(releasesRoot, entry.name);
    const manifestBytes = await readFile(path.join(directory, 'bundle-manifest.json')).catch(() => null);
    if (!manifestBytes) continue;
    const manifest = object(JSON.parse(manifestBytes.toString('utf8')), `${entry.name} Manifest`);
    if (manifest.bundle_id === bundleId) matches.push({ directory, manifest, manifestBytes });
  }
  if (matches.length !== 1) fail(`expected one standard component ${bundleId}, found ${matches.length}`);
  return matches[0]!;
}

export async function validateBundleDirectory(
  directory: string,
  expected: { bundleId: string; bundleDigest?: string; manifestSha256?: string },
): Promise<FoundStandardComponent> {
  const manifestBytes = await readFile(path.join(directory, 'bundle-manifest.json'));
  const manifest = object(JSON.parse(manifestBytes.toString('utf8')), 'component Manifest');
  if (manifest.bundle_id !== expected.bundleId) fail(`component bundle_id drift: ${expected.bundleId}`);
  if (expected.bundleDigest && manifest.bundle_digest !== expected.bundleDigest) {
    fail(`component bundle_digest drift: ${expected.bundleId}`);
  }
  if (expected.manifestSha256 && sha256(manifestBytes) !== expected.manifestSha256) {
    fail(`component Manifest hash drift: ${expected.bundleId}`);
  }
  const contractVersion = string(manifest.bundle_contract_version, 'component bundle_contract_version');
  if (!isBundleContractSupported(contractVersion)) {
    fail(`component Bundle contract is unregistered: ${contractVersion}`);
  }
  const schema = object(manifest.schema, 'component schema');
  const schemaVersion = string(schema.version, 'component schema.version');
  const schemaSha256 = hash(schema.sha256, 'component schema.sha256');
  if (
    schemaVersion !== CTKG_SCHEMA_VERSION
    || !isSchemaIdentitySupported(schemaVersion, schemaSha256)
  ) {
    fail(`component Schema identity is unregistered: ${schemaVersion}/${schemaSha256}`);
  }
  const digestBody = structuredClone(manifest);
  delete digestBody.bundle_digest;
  const recomputedBundleDigest = sha256(canonicalJson(digestBody));
  if (manifest.bundle_digest !== recomputedBundleDigest) {
    fail(`component bundle_digest cannot be recomputed: ${expected.bundleId}`);
  }
  const sumsBytes = await readFile(path.join(directory, 'SHA256SUMS'));
  const rows = new Map<string, string>();
  const foldedRows = new Map<string, string>();
  for (const [index, line] of sumsBytes.toString('utf8').trimEnd().split('\n').entries()) {
    const match = /^([0-9a-f]{64}) {2}(.+)$/u.exec(line);
    if (!match) fail(`invalid component SHA256SUMS row ${index + 1}`);
    const memberPath = validateBundleMemberPath(match[2], `component SHA256SUMS row ${index + 1}`);
    const folded = memberPath.normalize('NFKC').toLocaleLowerCase('en-US');
    if (rows.has(memberPath) || foldedRows.has(folded)) {
      fail(`invalid component SHA256SUMS row ${index + 1}`);
    }
    rows.set(memberPath, match[1]);
    foldedRows.set(folded, memberPath);
  }
  if (!Array.isArray(manifest.artifacts)) fail(`component Manifest artifacts are missing: ${expected.bundleId}`);
  const declaredArtifacts = new Set<string>();
  const foldedArtifacts = new Map<string, string>();
  for (const [index, value] of manifest.artifacts.entries()) {
    const artifact = object(value, `component artifacts[${index}]`);
    const artifactPath = validateBundleMemberPath(
      artifact.path,
      `component artifacts[${index}].path`,
    );
    const folded = artifactPath.normalize('NFKC').toLocaleLowerCase('en-US');
    if (
      artifactPath === 'bundle-manifest.json'
      || artifactPath === 'SHA256SUMS'
      || declaredArtifacts.has(artifactPath)
      || foldedArtifacts.has(folded)
    ) {
      fail(`component Artifact path is invalid: ${expected.bundleId}/${artifactPath}`);
    }
    declaredArtifacts.add(artifactPath);
    foldedArtifacts.set(folded, artifactPath);
    const bytes = await readFile(path.join(directory, ...artifactPath.split('/')));
    const declaredHash = hash(artifact.sha256, `component artifacts[${index}].sha256`);
    const byteLength = nonNegativeInteger(
      artifact.byte_length,
      `component artifacts[${index}].byte_length`,
    );
    const mediaType = string(artifact.media_type, `component artifacts[${index}].media_type`);
    const recordCount = artifact.record_count === null
      ? null
      : nonNegativeInteger(artifact.record_count, `component artifacts[${index}].record_count`);
    if (sha256(bytes) !== declaredHash || rows.get(artifactPath) !== declaredHash) {
      fail(`component Artifact hash drift: ${expected.bundleId}/${artifactPath}`);
    }
    if (bytes.byteLength !== byteLength) {
      fail(`component Artifact byte length drift: ${expected.bundleId}/${artifactPath}`);
    }
    if (artifactRecordCount(bytes, mediaType) !== recordCount) {
      fail(`component Artifact record count drift: ${expected.bundleId}/${artifactPath}`);
    }
  }
  const files: string[] = [];
  const walk = async (current: string, relative: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const child = path.join(current, entry.name);
      if (entry.isSymbolicLink()) fail(`component directory contains symlink: ${childRelative}`);
      if (entry.isDirectory()) {
        await walk(child, childRelative);
      } else if (entry.isFile()) {
        if (childRelative !== 'SHA256SUMS') files.push(childRelative);
      } else {
        fail(`component directory contains non-regular entry: ${childRelative}`);
      }
    }
  };
  await walk(directory, '');
  files.sort();
  const manifestClosedFiles = ['bundle-manifest.json', ...declaredArtifacts].sort();
  if (canonicalJson(files) !== canonicalJson(manifestClosedFiles)) {
    fail(`component file set does not close over Manifest artifacts: ${expected.bundleId}`);
  }
  if (canonicalJson(files) !== canonicalJson([...rows.keys()].sort())) {
    fail(`component SHA256SUMS does not close over ${expected.bundleId}`);
  }
  for (const [name, digest] of rows) {
    if (sha256(await readFile(path.join(directory, name))) !== digest) {
      fail(`component artifact hash drift: ${expected.bundleId}/${name}`);
    }
  }
  return { directory, manifest, manifestBytes };
}

function targetReleaseDirectory(reference: JsonObject, label: string): string {
  const releaseVersion = validateReleaseVersionSegment(
    reference.release_version,
    `${label}.release_version`,
  );
  return path.posix.join('releases', releaseVersion);
}

type ChainLock = {
  lock_version: 'actkg-release-set-lock/v3';
  release_set_id: string;
  bundle: {
    controlled_path: string;
    bundle_id: string;
    bundle_revision: number;
    bundle_digest: string;
    manifest_raw_sha256: string;
  };
  release: {
    release_id: string;
    release_version: string;
    release_hash: string;
    source_dataset_hash: string;
  };
  compatibility: {
    bundle_contract_version: string;
    schema_version: string;
    schema_sha256: string;
  };
  source_revision: { commit: string; tag: string };
  components: JsonObject[];
};

function lockFileName(candidate: LatestStableAggregateCandidate): string {
  const stem = candidate.bundleId.replace(/^ctb:/u, '').replaceAll(':', '-');
  return `release-set.lock.v3.${stem}.json`;
}

async function buildLock(
  candidate: LatestStableAggregateCandidate,
  actkgRoot: string,
  repoRoot: string,
  outputRoot: string,
  plans: Map<string, SourcePlan>,
): Promise<ChainLock> {
  const manifest = candidate.manifest;
  const components = manifest.components;
  if (!Array.isArray(components)) fail(`${candidate.bundleId} Manifest components must be an array`);
  const aggregateReleaseVersion = validateReleaseVersionSegment(
    candidate.releaseVersion,
    `${candidate.bundleId}.release_version`,
  );
  const aggregateTarget = path.posix.join('releases', aggregateReleaseVersion);
  await registerPlan(
    plans,
    path.join(actkgRoot, candidate.bundlePath),
    aggregateTarget,
    `${candidate.bundleId} aggregate Bundle`,
  );
  const lockComponents: JsonObject[] = [];
  for (const [index, value] of components.entries()) {
    const component = object(value, `${candidate.bundleId}.components[${index}]`);
    const label = `${candidate.bundleId}.components[${index}]`;
    const referenceKind = component.reference_kind === undefined
      ? 'legacy_exact'
      : string(component.reference_kind, `${label}.reference_kind`);
    const releaseId = string(component.release_id, `${label}.release_id`);
    const targetRelative = targetReleaseDirectory(component, label);
    if (referenceKind === 'legacy_exact') {
      const componentPath = sourceRelative(component.component_path, `${label}.component_path`);
      const sourceFile = path.resolve(actkgRoot, componentPath);
      const releasesRoot = await realpath(path.join(actkgRoot, 'releases'));
      const sourceReal = await realpath(sourceFile).catch(() => fail(`${label} source is missing`));
      if (!sourceReal.startsWith(`${releasesRoot}${path.sep}`)) fail(`${label} source escapes releases root`);
      const sourceStat = await stat(sourceReal);
      if (!sourceStat.isFile()) fail(`${label} source is not a regular file`);
      const releaseRawSha256 = hash(component.release_raw_sha256, `${label}.release_raw_sha256`);
      if (sha256(await readFile(sourceReal)) !== releaseRawSha256) fail(`${label} Release bytes drift`);
      await registerPlan(plans, path.dirname(sourceReal), targetRelative, `${label} legacy_exact`);
      lockComponents.push({
        reference_kind: 'legacy_exact',
        release_id: releaseId,
        controlled_path: repoRelative(repoRoot, path.join(outputRoot, targetRelative), `${label} controlled_path`),
        release_json_name: path.basename(sourceReal),
        release_raw_sha256: releaseRawSha256,
      });
      continue;
    }
    if (referenceKind !== 'standard_bundle') fail(`${label} unsupported reference_kind ${referenceKind}`);
    const bundleId = string(component.bundle_id, `${label}.bundle_id`);
    const bundleDigest = hash(component.bundle_digest, `${label}.bundle_digest`);
    const manifestSha256 = hash(component.manifest_sha256, `${label}.manifest_sha256`);
    const found = await findStandardComponent(actkgRoot, bundleId);
    const validated = await validateBundleDirectory(found.directory, {
      bundleId,
      bundleDigest,
      manifestSha256,
    });
    const foundRelease = object(validated.manifest.release, `${label}.source.release`);
    if (string(foundRelease.release_id, `${label}.source.release_id`) !== releaseId) {
      fail(`${label} component release_id drift`);
    }
    if (string(foundRelease.release_version, `${label}.source.release_version`)
      !== string(component.release_version, `${label}.release_version`)) {
      fail(`${label} component release_version drift`);
    }
    await registerPlan(plans, validated.directory, targetRelative, `${label} standard_bundle`);
    lockComponents.push({
      reference_kind: 'standard_bundle',
      release_id: releaseId,
      controlled_path: repoRelative(repoRoot, path.join(outputRoot, targetRelative), `${label} controlled_path`),
      bundle_id: bundleId,
      bundle_digest: bundleDigest,
      manifest_raw_sha256: manifestSha256,
    });
  }
  const aggregateControlledPath = repoRelative(
    repoRoot,
    path.join(outputRoot, aggregateTarget),
    `${candidate.bundleId} bundle controlled_path`,
  );
  return {
    lock_version: 'actkg-release-set-lock/v3',
    release_set_id: `actkg-authoritative-candidate-${candidate.bundleDigest}`,
    bundle: {
      controlled_path: aggregateControlledPath,
      bundle_id: candidate.bundleId,
      bundle_revision: candidate.bundleRevision,
      bundle_digest: candidate.bundleDigest,
      manifest_raw_sha256: candidate.manifestSha256,
    },
    release: {
      release_id: candidate.releaseId,
      release_version: candidate.releaseVersion,
      release_hash: candidate.releaseHash,
      source_dataset_hash: candidate.sourceDatasetHash,
    },
    compatibility: {
      bundle_contract_version: candidate.bundleContractVersion,
      schema_version: candidate.schemaVersion,
      schema_sha256: candidate.schemaSha256,
    },
    source_revision: {
      commit: candidate.sourceCommit,
      tag: candidate.sourceTag,
    },
    components: lockComponents,
  };
}

export type PrepareLatestActkgChainIntakeOptions = {
  actkgRoot: string;
  mainRef: string;
  bindingPath: string;
  repoRoot: string;
  outputRoot: string;
  admittedEndpointPath?: string;
  predecessorRootClosurePath?: string;
};

export async function prepareLatestActkgChainIntake(
  options: PrepareLatestActkgChainIntakeOptions,
): Promise<JsonObject> {
  const actkgRoot = path.resolve(options.actkgRoot);
  const repoRoot = path.resolve(options.repoRoot);
  const outputRoot = path.resolve(options.outputRoot);
  const bindingPath = path.resolve(options.bindingPath);
  await assertOutputRoot(repoRoot, outputRoot);
  const frozen = await loadFrozenBinding(bindingPath);
  const admittedEndpoint: LatestStableAggregateAdmittedEndpoint | undefined = options.admittedEndpointPath
    ? await loadLatestStableAggregateAdmittedEndpoint(path.resolve(options.admittedEndpointPath))
    : frozen.binding.admittedEndpoint;
  const predecessorRootClosurePath = options.predecessorRootClosurePath
    ?? frozen.binding.predecessorRootClosure?.path;
  const start = await resolveLatestStableAggregateWithCandidates({
    actkgRoot,
    mainRef: options.mainRef,
    admittedEndpoint,
    predecessorRootClosurePath,
  });
  assertBindingMatches(frozen.binding, start.binding);
  const admittedBundleId = start.binding.admittedEndpoint?.bundleId;
  const admittedIndex = admittedBundleId === undefined
    ? -1
    : start.activeCandidates.findIndex((candidate) => candidate.bundleId === admittedBundleId);
  if (admittedBundleId !== undefined && admittedIndex < 0) {
    fail(`admitted endpoint bundleId is not an active candidate: ${admittedBundleId}`);
  }
  const candidates = admittedBundleId === undefined
    ? start.activeCandidates
    : start.activeCandidates.slice(admittedIndex + 1);
  if (candidates.length === 0) fail('no post-baseline candidates to stage');
  if (start.binding.candidateChain.length !== start.activeCandidates.length) {
    fail('binding candidateChain does not match verified activeCandidates');
  }
  const closure = start.binding.predecessorRootClosure;
  if (!closure) fail('predecessor root closure is missing from the frozen binding');
  const closureSource = path.resolve(actkgRoot, sourceRelative(
    closure.path,
    'predecessorRootClosure.path',
  ));
  const closureBytes = await readFile(closureSource);
  const bindingBytes = frozen.bytes;
  const plans = new Map<string, SourcePlan>();
  const locks: Array<{ candidate: LatestStableAggregateCandidate; lock: ChainLock; lockName: string }> = [];
  for (const candidate of candidates) {
    const lock = await buildLock(candidate, actkgRoot, repoRoot, outputRoot, plans);
    locks.push({ candidate, lock, lockName: lockFileName(candidate) });
  }
  await mkdir(path.dirname(outputRoot), { recursive: true });
  const stagingRoot = await mkdtemp(path.join(
    path.dirname(outputRoot),
    `.${path.basename(outputRoot)}.tmp-`,
  ));
  try {
    const closureTarget = path.join(stagingRoot, 'metadata', 'predecessor-closure.json');
    const bindingTarget = path.join(stagingRoot, 'metadata', 'latest-stable-aggregate-binding.json');
    await mkdir(path.join(stagingRoot, 'releases'), { recursive: false });
    await mkdir(path.join(stagingRoot, 'metadata'), { recursive: false });
    for (const plan of [...plans.values()].sort((left, right) => left.targetRelative.localeCompare(right.targetRelative))) {
      if (await directoryDigest(plan.source) !== plan.digest) fail(`source drift before copying ${plan.label}`);
      await cp(plan.source, path.join(stagingRoot, plan.targetRelative), {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
      if (await directoryDigest(path.join(stagingRoot, plan.targetRelative)) !== plan.digest) {
        fail(`staged bytes drift while copying ${plan.label}`);
      }
      if (await directoryDigest(plan.source) !== plan.digest) fail(`source drift during copying ${plan.label}`);
    }
    await cp(closureSource, closureTarget, { force: false, errorOnExist: true });
    await cp(bindingPath, bindingTarget, { force: false, errorOnExist: true });
    for (const plan of plans.values()) {
      if (await directoryDigest(plan.source) !== plan.digest) fail(`source drift after copying ${plan.label}`);
    }
    if (!(await readFile(bindingPath)).equals(bindingBytes) || !(await readFile(closureSource)).equals(closureBytes)) {
      fail('frozen binding or predecessor closure drifted during intake');
    }
    if (!(await readFile(bindingTarget)).equals(bindingBytes) || !(await readFile(closureTarget)).equals(closureBytes)) {
      fail('staged binding or predecessor closure bytes drifted during intake');
    }
    const end = await resolveLatestStableAggregateWithCandidates({
      actkgRoot,
      mainRef: options.mainRef,
      admittedEndpoint,
      predecessorRootClosurePath,
    });
    assertBindingMatches(frozen.binding, end.binding);
    for (const { lockName, lock } of locks) {
      await writeFile(path.join(stagingRoot, lockName), `${JSON.stringify(lock, null, 2)}\n`);
    }
    const entries = await Promise.all(locks.map(async ({ candidate, lock, lockName }, index) => ({
      order: index + 1,
      lockPath: repoRelative(repoRoot, path.join(outputRoot, lockName), 'receipt lockPath'),
      lockSha256: sha256(await readFile(path.join(stagingRoot, lockName))),
      releaseSetId: lock.release_set_id,
      releaseId: candidate.releaseId,
      releaseVersion: candidate.releaseVersion,
      releaseHash: candidate.releaseHash,
      bundleId: candidate.bundleId,
      bundleDigest: candidate.bundleDigest,
    })));
    const receipt = {
      protocol: 'act-latest-stable-aggregate-chain-intake/1',
      outputRoot: repoRelative(repoRoot, outputRoot, 'receipt outputRoot'),
      bindingPath: repoRelative(
        repoRoot,
        path.join(outputRoot, 'metadata', 'latest-stable-aggregate-binding.json'),
        'receipt bindingPath',
      ),
      predecessorClosurePath: repoRelative(
        repoRoot,
        path.join(outputRoot, 'metadata', 'predecessor-closure.json'),
        'receipt predecessorClosurePath',
      ),
      predecessorClosureArtifactHash: closure.artifactHash,
      resolutionDigest: end.binding.resolutionDigest,
      chain: entries,
    };
    await writeFile(path.join(stagingRoot, 'chain-intake-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    await rename(stagingRoot, outputRoot);
    return receipt;
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

async function main(): Promise<void> {
  const receipt = await prepareLatestActkgChainIntake({
    ...parseArgs(process.argv.slice(2)),
  });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
