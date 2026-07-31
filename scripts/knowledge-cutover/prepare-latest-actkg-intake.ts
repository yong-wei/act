#!/usr/bin/env tsx

import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256 } from '../actkg-release/authoritative-release';
import {
  resolveLatestStableAggregate,
  type LatestStableAggregateBinding,
} from '../actkg-release/latest-stable-aggregate';

type JsonObject = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(`prepare-latest-actkg-intake: ${message}`);
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

function parseArgs(argv: string[]): {
  actkgRoot: string;
  bindingPath: string;
  outputRoot: string;
  mainRef: string;
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
  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) fail(`missing ${key}`);
    return value;
  };
  return {
    actkgRoot: path.resolve(required('--actkg-root')),
    bindingPath: path.resolve(required('--binding')),
    outputRoot: path.resolve(required('--output-root')),
    mainRef: values.get('--main-ref') ?? 'origin/main',
  };
}

function bindingIdentity(binding: LatestStableAggregateBinding): JsonObject {
  const { resolutionDigest: _, ...body } = binding;
  return body;
}

async function loadBinding(filePath: string): Promise<LatestStableAggregateBinding> {
  const row = object(JSON.parse(await readFile(filePath, 'utf8')), 'binding');
  const required = [
    'resolutionDigest',
    'releaseVersion',
    'releaseId',
    'releaseHash',
    'sourceDatasetHash',
    'bundleId',
    'bundleDigest',
    'manifestSha256',
    'schemaVersion',
    'schemaSha256',
    'sourceCommit',
    'sourceTag',
    'bundlePath',
  ];
  for (const key of required) string(row[key], `binding.${key}`);
  const { status: _status, iteration: _iteration, gates: _gates, ...binding } = row;
  return binding as LatestStableAggregateBinding;
}

async function findStandardComponent(
  actkgRoot: string,
  bundleId: string,
): Promise<{ directory: string; manifest: JsonObject }> {
  const releasesRoot = path.join(actkgRoot, 'releases');
  const matches: Array<{ directory: string; manifest: JsonObject }> = [];
  for (const entry of await readdir(releasesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(releasesRoot, entry.name);
    const bytes = await readFile(path.join(directory, 'bundle-manifest.json')).catch(
      () => null,
    );
    if (!bytes) continue;
    const manifest = object(JSON.parse(bytes.toString('utf8')), 'component Manifest');
    if (manifest.bundle_id === bundleId) matches.push({ directory, manifest });
  }
  if (matches.length !== 1) {
    fail(`expected one standard component ${bundleId}, found ${matches.length}`);
  }
  return matches[0];
}

async function writeImmutable(filePath: string, content: string): Promise<void> {
  const existing = await readFile(filePath, 'utf8').catch(() => null);
  if (existing !== null && existing !== content) {
    fail(`immutable intake artifact drift at ${filePath}`);
  }
  if (existing === null) await writeFile(filePath, content);
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

export type PrepareLatestActkgIntakeOptions = {
  actkgRoot: string;
  bindingPath: string;
  outputRoot: string;
  mainRef: string;
};

export async function prepareLatestActkgIntake(
  args: PrepareLatestActkgIntakeOptions,
): Promise<JsonObject> {
  const expected = await loadBinding(args.bindingPath);
  const resolved = await resolveLatestStableAggregate({
    actkgRoot: args.actkgRoot,
    mainRef: args.mainRef,
  });
  if (
    resolved.resolutionDigest !== expected.resolutionDigest
    || JSON.stringify(bindingIdentity(resolved))
      !== JSON.stringify(bindingIdentity(expected))
  ) {
    fail('live ActKG resolution no longer matches the frozen binding');
  }

  const sourceBundle = path.join(args.actkgRoot, resolved.bundlePath);
  const targetBundlePath = path.posix.join('releases', resolved.releaseVersion);
  const manifest = object(
    JSON.parse(await readFile(path.join(sourceBundle, 'bundle-manifest.json'), 'utf8')),
    'latest Manifest',
  );
  const components = manifest.components;
  if (!Array.isArray(components)) fail('latest Manifest components must be an array');
  const copyPlans: Array<{
    source: string;
    target: string;
    targetPath: string;
    label: string;
  }> = [{
    source: sourceBundle,
    target: path.join(args.outputRoot, targetBundlePath),
    targetPath: targetBundlePath,
    label: 'aggregate target directory',
  }];
  const lockComponents: JsonObject[] = [];
  for (const [index, value] of components.entries()) {
    const component = object(value, `components[${index}]`);
    const referenceKind = string(
      component.reference_kind,
      `components[${index}].reference_kind`,
    );
    const releaseId = string(component.release_id, `components[${index}].release_id`);
    if (referenceKind === 'legacy_exact') {
      const componentPath = string(
        component.component_path,
        `components[${index}].component_path`,
      );
      const sourceFile = path.resolve(args.actkgRoot, componentPath);
      if (!sourceFile.startsWith(`${path.resolve(args.actkgRoot, 'releases')}${path.sep}`)) {
        fail(`legacy component escapes releases root: ${componentPath}`);
      }
      const directoryName = path.basename(path.dirname(sourceFile));
      const targetDirectoryPath = path.posix.join('releases', directoryName);
      copyPlans.push({
        source: path.dirname(sourceFile),
        target: path.join(args.outputRoot, targetDirectoryPath),
        targetPath: targetDirectoryPath,
        label: `legacy component target ${targetDirectoryPath}`,
      });
      lockComponents.push({
        reference_kind: 'legacy_exact',
        release_id: releaseId,
        controlled_path: targetDirectoryPath,
        release_json_name: path.basename(sourceFile),
        release_raw_sha256: string(
          component.release_raw_sha256,
          `components[${index}].release_raw_sha256`,
        ),
      });
      continue;
    }
    if (referenceKind !== 'standard_bundle') {
      fail(`unsupported component reference_kind ${referenceKind}`);
    }
    const bundleId = string(component.bundle_id, `components[${index}].bundle_id`);
    const found = await findStandardComponent(args.actkgRoot, bundleId);
    const releaseVersion = string(
      found.manifest.release && object(found.manifest.release, 'component release').release_version,
      `components[${index}].release_version`,
    );
    const targetDirectoryPath = path.posix.join('releases', releaseVersion);
    copyPlans.push({
      source: found.directory,
      target: path.join(args.outputRoot, targetDirectoryPath),
      targetPath: targetDirectoryPath,
      label: `standard component target ${targetDirectoryPath}`,
    });
    lockComponents.push({
      reference_kind: 'standard_bundle',
      release_id: releaseId,
      controlled_path: targetDirectoryPath,
      bundle_id: bundleId,
      bundle_digest: string(
        component.bundle_digest,
        `components[${index}].bundle_digest`,
      ),
      manifest_raw_sha256: string(
        component.manifest_sha256,
        `components[${index}].manifest_sha256`,
      ),
    });
  }

  const seenTargetPaths = new Set<string>();
  for (const plan of copyPlans) {
    if (seenTargetPaths.has(plan.targetPath)) {
      fail(`duplicate intake target path ${plan.targetPath}`);
    }
    seenTargetPaths.add(plan.targetPath);
  }
  await requireAbsent(args.outputRoot, 'intake output root');
  await mkdir(args.outputRoot, { recursive: false });
  await mkdir(path.join(args.outputRoot, 'releases'), { recursive: false });
  for (const plan of copyPlans) {
    await requireAbsent(plan.target, plan.label);
  }
  for (const plan of copyPlans) {
    await cp(plan.source, plan.target, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
  }

  const lock = {
    lock_version: 'actkg-release-set-lock/v3',
    release_set_id: `actkg-authoritative-candidate-${resolved.resolutionDigest.slice(0, 16)}`,
    compatibility: {
      bundle_contract_version: string(
        manifest.bundle_contract_version,
        'manifest.bundle_contract_version',
      ),
      schema_version: resolved.schemaVersion,
      schema_sha256: resolved.schemaSha256,
    },
    source_revision: {
      commit: resolved.sourceCommit,
      tag: resolved.sourceTag,
    },
    release: {
      release_id: resolved.releaseId,
      release_version: resolved.releaseVersion,
      release_hash: resolved.releaseHash,
      source_dataset_hash: resolved.sourceDatasetHash,
    },
    bundle: {
      controlled_path: targetBundlePath,
      bundle_id: resolved.bundleId,
      bundle_revision: Number(manifest.bundle_revision),
      bundle_digest: resolved.bundleDigest,
      manifest_raw_sha256: resolved.manifestSha256,
    },
    components: lockComponents,
  };
  const lockPath = path.join(args.outputRoot, 'release-set.lock.v3.latest.json');
  await writeImmutable(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  const receipt = {
    protocol: 'act-latest-stable-aggregate-intake/1',
    resolutionDigest: resolved.resolutionDigest,
    releaseSetId: lock.release_set_id,
    releaseId: resolved.releaseId,
    bundleId: resolved.bundleId,
    bundleDigest: resolved.bundleDigest,
    lockPath: path.basename(lockPath),
    lockSha256: sha256(await readFile(lockPath)),
    stagedRoot: args.outputRoot,
  };
  await writeImmutable(
    path.join(args.outputRoot, 'intake-receipt.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  return receipt;
}

async function main(): Promise<void> {
  const receipt = await prepareLatestActkgIntake({
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
