/**
 * Immutable ActKG v0.22 publication mirror.
 *
 * The upstream work tree is deliberately never read.  The mirror is built
 * from the pinned publication tag's Git tree and `git cat-file` blobs only;
 * the source tag is admitted separately as provenance.  A receipt is written
 * beside (not inside) the controlled Bundle so the v2 loader can require the
 * Bundle file set to be exactly the upstream Manifest file set.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import {
  REVIEWED_V0_22_IDENTITIES,
  REVIEWED_V0_22_V2_REGISTRY,
  type PublicBundleV2Registry,
} from './bundle-compatibility-registry-v022';
import { admitPublicBundleV2 } from './public-bundle-v2-admission';
import { canonicalJson, sha256 } from './authoritative-release';

export const V022_PUBLICATION_PATH =
  'releases/control-theory-engineering-v0.22-r5' as const;
export const V022_ACT_CONTROLLED_PATH =
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.22-r5' as const;

const COMMIT = /^[a-f0-9]{40}$/u;
const SAFE_RELATIVE = /^[A-Za-z0-9._/-]+$/u;
const RECEIPT_CONTRACT = 'actkg-v022-release-mirror/1' as const;

export interface MirroredGitTreeEntry {
  path: string;
  mode: string;
  gitObject: string;
  byteLength: number;
  rawSha256: string;
}

export interface ActkgV022MirrorReceipt {
  contract: typeof RECEIPT_CONTRACT;
  publicationRevision: { tag: string; commit: string };
  sourceRevision: { tag: string; commit: string };
  upstreamRepository: { repositoryId: string; remoteUrl: string };
  publicationPath: typeof V022_PUBLICATION_PATH;
  controlledPath: string;
  manifestRawSha256: string;
  sha256sumsRawSha256: string;
  bundleDigest: string;
  treeDigest: string;
  files: MirroredGitTreeEntry[];
}

export interface MirrorPinnedV022ReleaseOptions {
  upstreamGitRoot: string;
  repoRoot?: string;
  controlledPath?: string;
  receiptPath?: string;
  registry?: PublicBundleV2Registry;
}

export interface MirrorPinnedV022ReleaseResult {
  outputPath: string;
  receiptPath: string;
  receipt: ActkgV022MirrorReceipt;
  reused: boolean;
}

function fail(message: string): never {
  throw new Error(`ActKG v0.22 mirror rejected: ${message}`);
}

function runGit(root: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    }).trim();
  } catch {
    fail(`git ${args.join(' ')} could not be resolved`);
  }
}

function readGitBlob(root: string, object: string): Buffer {
  try {
    return execFileSync('git', ['cat-file', 'blob', object], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    fail(`Git blob ${object} could not be read`);
  }
}

function parseTree(root: string, commit: string): MirroredGitTreeEntry[] {
  const raw = execFileSync(
    'git',
    ['ls-tree', '-r', '-l', '-z', commit, '--', V022_PUBLICATION_PATH],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const entries: MirroredGitTreeEntry[] = [];
  for (const record of raw.split('\0').filter(Boolean)) {
    const match = /^(\d{6}) blob ([a-f0-9]{40})\s+(\d+)\t(.+)$/u.exec(record);
    if (!match) fail(`publication tag contains an unsupported tree entry: ${record}`);
    const [, mode, gitObject, byteLengthRaw, absolutePath] = match;
    if (!mode || !gitObject || !byteLengthRaw || !absolutePath) fail('invalid Git tree entry');
    const relativePath = absolutePath.slice(`${V022_PUBLICATION_PATH}/`.length);
    if (!SAFE_RELATIVE.test(relativePath) || relativePath.startsWith('/') || relativePath.includes('..')) {
      fail(`publication tree path is unsafe: ${relativePath}`);
    }
    const bytes = readGitBlob(root, gitObject);
    const byteLength = Number(byteLengthRaw);
    if (bytes.byteLength !== byteLength) fail(`Git tree size drift for ${relativePath}`);
    entries.push({
      path: relativePath,
      mode,
      gitObject,
      byteLength,
      rawSha256: sha256(bytes),
    });
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  if (entries.length === 0) fail('publication tag tree is empty');
  return entries;
}

function expectedReceiptBytes(receipt: ActkgV022MirrorReceipt): Buffer {
  return Buffer.from(`${canonicalJson(receipt)}\n`, 'utf8');
}

async function assertExistingMirror(
  outputPath: string,
  receiptPath: string,
  expected: ActkgV022MirrorReceipt,
): Promise<void> {
  const stored = JSON.parse(await readFile(receiptPath, 'utf8')) as ActkgV022MirrorReceipt;
  if (canonicalJson(stored) !== canonicalJson(expected)) {
    fail('existing mirror receipt differs from the pinned publication');
  }
  for (const entry of expected.files) {
    const target = path.join(outputPath, entry.path);
    const file = await readFile(target).catch(() => null);
    if (!file || file.byteLength !== entry.byteLength || sha256(file) !== entry.rawSha256) {
      fail(`existing mirror byte drift for ${entry.path}`);
    }
    const mode = (await lstat(target)).mode & 0o777;
    if (mode !== (Number.parseInt(entry.mode, 8) & 0o777)) fail(`existing mirror mode drift for ${entry.path}`);
  }
}

/** Mirror a pinned publication tag into a tracked ACT authoring boundary. */
export async function mirrorPinnedV022Release(
  options: MirrorPinnedV022ReleaseOptions,
): Promise<MirrorPinnedV022ReleaseResult> {
  const registry = options.registry ?? REVIEWED_V0_22_V2_REGISTRY;
  const upstreamGitRoot = path.resolve(options.upstreamGitRoot);
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const controlledPath = options.controlledPath ?? V022_ACT_CONTROLLED_PATH;
  const outputPath = path.resolve(repoRoot, controlledPath);
  const receiptPath = path.resolve(
    options.receiptPath ?? `${outputPath}.mirror-receipt.json`,
  );

  const admission = admitPublicBundleV2({ upstreamGitRoot, registry });
  const publicationCommit = admission.publicationRevision.commit;
  if (publicationCommit !== registry.publicationCommit || !COMMIT.test(publicationCommit)) {
    fail('publication commit is not the registered v0.22 commit');
  }
  const entries = parseTree(upstreamGitRoot, publicationCommit);
  const manifest = entries.find((entry) => entry.path === 'bundle-manifest.json');
  const sums = entries.find((entry) => entry.path === 'SHA256SUMS');
  if (!manifest || !sums) fail('publication tree must contain Manifest and SHA256SUMS');
  if (manifest.rawSha256 !== registry.manifestRawSha256) fail('Manifest raw hash is not registered');
  if (sums.rawSha256 !== registry.sha256sumsRawSha256) fail('SHA256SUMS raw hash is not registered');
  const schema = entries.find((entry) => entry.path === 'ctkg.schema.json');
  if (!schema) fail('publication tree must contain ctkg.schema.json');
  if (schema.rawSha256 !== registry.schemaRawSha256) {
    fail('v0.22 schema hash is not the admitted v0.18 Schema 0.3.0 hash');
  }

  const bundleDigest = registry.bundleDigest;
  const treeDigest = createHash('sha256')
    .update(canonicalJson(entries))
    .digest('hex');
  const receipt: ActkgV022MirrorReceipt = {
    contract: RECEIPT_CONTRACT,
    publicationRevision: { ...admission.publicationRevision },
    sourceRevision: { ...admission.sourceRevision },
    upstreamRepository: { ...admission.upstreamRepository },
    publicationPath: V022_PUBLICATION_PATH,
    controlledPath,
    manifestRawSha256: manifest.rawSha256,
    sha256sumsRawSha256: sums.rawSha256,
    bundleDigest,
    treeDigest,
    files: entries,
  };

  const existingOutput = await lstat(outputPath).catch(() => null);
  const existingReceipt = await lstat(receiptPath).catch(() => null);
  if (existingOutput || existingReceipt) {
    if (!existingOutput?.isDirectory() || !existingReceipt?.isFile()) {
      fail('partial mirror output exists; immutable mirror was not overwritten');
    }
    await assertExistingMirror(outputPath, receiptPath, receipt);
    return { outputPath, receiptPath, receipt, reused: true };
  }

  const parent = path.dirname(outputPath);
  await mkdir(parent, { recursive: true });
  const tempPath = `${outputPath}.staging-${process.pid}`;
  await rm(tempPath, { recursive: true, force: true });
  await mkdir(path.join(tempPath, 'components'), { recursive: true });
  try {
    for (const entry of entries) {
      const bytes = readGitBlob(upstreamGitRoot, entry.gitObject);
      const target = path.join(tempPath, entry.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { mode: Number.parseInt(entry.mode, 8) });
      await chmod(target, Number.parseInt(entry.mode, 8));
    }
    await rename(tempPath, outputPath);
    await writeFile(receiptPath, expectedReceiptBytes(receipt), { mode: 0o644 });
  } catch (error) {
    await rm(tempPath, { recursive: true, force: true });
    await rm(outputPath, { recursive: true, force: true });
    await rm(receiptPath, { force: true });
    throw error;
  }

  return { outputPath, receiptPath, receipt, reused: false };
}

export const V022_MIRROR_IDENTITIES = Object.freeze({
  publicationTag: REVIEWED_V0_22_IDENTITIES.publicationTag,
  publicationCommit: REVIEWED_V0_22_IDENTITIES.publicationCommit,
  sourceTag: REVIEWED_V0_22_IDENTITIES.sourceTag,
  sourceCommit: REVIEWED_V0_22_IDENTITIES.sourceCommit,
  bundleDigest: REVIEWED_V0_22_IDENTITIES.bundleDigest,
});

function requiredOption(argv: readonly string[], name: string): string {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) fail(`missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const result = await mirrorPinnedV022Release({
    upstreamGitRoot: requiredOption(argv, '--upstream-git-root'),
    repoRoot: requiredOption(argv, '--repo-root'),
    ...(argv.includes('--controlled-path')
      ? { controlledPath: requiredOption(argv, '--controlled-path') }
      : {}),
    ...(argv.includes('--receipt-path')
      ? { receiptPath: requiredOption(argv, '--receipt-path') }
      : {}),
  });
  process.stdout.write(`${canonicalJson({
    outputPath: path.relative(path.resolve(result.outputPath, '..'), result.outputPath),
    receiptPath: path.relative(path.resolve(result.receiptPath, '..'), result.receiptPath),
    reused: result.reused,
    receipt: result.receipt,
  })}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
