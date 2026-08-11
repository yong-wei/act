const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Invoked as: node engine.cjs plan archive transactionId authorityRoot
const planPath = process.argv[2];
const archivePath = process.argv[3];
const transactionId = process.argv[4];
const authorityRoot = process.argv[5];
const AUTHORITY_PREFIX = 'course-content/authoring/knowledge/authority/';
const PLAN_CONTRACT = 'act-production-knowledge-cutover-plan/v1';
if (!planPath || !archivePath || !transactionId || !authorityRoot) {
  process.stderr.write('ERROR: cleanup identity delete requires plan archive transactionId authorityRoot\n');
  process.exit(1);
}

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  fail('plan contains an unsupported value');
}

function normalizeArchivePath(rawName) {
  if (typeof rawName !== 'string' || rawName.includes('\0')) {
    fail(`cleanup archive path contains NUL or is not a string: ${String(rawName)}`);
  }
  let name = rawName.replace(/^\.\//u, '');
  const hadTrailingSlash = name.endsWith('/');
  if (hadTrailingSlash) name = name.replace(/\/+$/u, '');
  if (name === '' || name === '.') return { skip: true };
  if (name.startsWith('/') || path.posix.isAbsolute(name)) {
    fail(`cleanup archive path is absolute: ${rawName}`);
  }
  const segments = name.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail(`cleanup archive path is unsafe: ${rawName}`);
  }
  if (segments.includes('__MACOSX') || name === '__MACOSX' || name.startsWith('__MACOSX/')) {
    fail(`cleanup archive rejects __MACOSX path: ${name}`);
  }
  const base = segments[segments.length - 1];
  if (base === 'current.json' || base === '.DS_Store') {
    fail(`cleanup archive rejects forbidden basename: ${name}`);
  }
  return { skip: false, name, hadTrailingSlash };
}

function ancestorPaths(relativePath) {
  const parts = relativePath.split('/');
  const out = [];
  for (let i = 1; i < parts.length; i += 1) {
    out.push(parts.slice(0, i).join('/'));
  }
  return out;
}

function isStrictAppleDoubleBase(base) {
  return base.startsWith('._') && base.length >= 3;
}

function appleDoubleCompanionPath(relativePath) {
  const base = path.posix.basename(relativePath);
  if (!isStrictAppleDoubleBase(base)) return null;
  const companionBase = base.slice(2);
  const dir = path.posix.dirname(relativePath);
  const prefix = dir === '.' ? '' : dir;
  if (companionBase === '.') {
    return prefix === '' ? '.' : prefix;
  }
  return prefix ? `${prefix}/${companionBase}` : companionBase;
}

function isAncestorDirectory(candidateDir, sealedFilePath) {
  if (candidateDir === '.') return true;
  return sealedFilePath === candidateDir || sealedFilePath.startsWith(`${candidateDir}/`);
}

function readArchiveMembers(archiveFile) {
  const script = `
import hashlib, json, sys, tarfile
members = []
with tarfile.open(sys.argv[1], "r:*") as tf:
    for member in tf.getmembers():
        name = member.name
        if member.issym():
            kind = "symlink"
            digest = None
        elif member.islnk():
            kind = "hardlink"
            digest = None
        elif member.isdir():
            kind = "dir"
            digest = None
        elif member.isreg():
            handle = tf.extractfile(member)
            data = handle.read() if handle is not None else b""
            kind = "file"
            digest = hashlib.sha256(data).hexdigest()
        else:
            kind = "special"
            digest = None
        members.append({"name": name, "kind": kind, "digest": digest, "size": int(member.size)})
print(json.dumps(members))
`;
  try {
    const raw = execFileSync('python3', ['-c', script, archiveFile], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(raw);
  } catch (error) {
    fail(`cleanup cannot inspect authority archive members: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function walkHost(root) {
  /** @type {Map<string, { kind: 'file' | 'dir', sha256?: string }>} */
  const host = new Map();
  const visit = (absDir, relDir) => {
    let names;
    try {
      names = fs.readdirSync(absDir);
    } catch (error) {
      fail(`cleanup cannot read host Authority path ${relDir || '.'}: ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const name of names.sort()) {
      const childRel = relDir ? `${relDir}/${name}` : name;
      const childAbs = path.join(absDir, name);
      let st;
      try {
        st = fs.lstatSync(childAbs);
      } catch (error) {
        fail(`cleanup cannot lstat host path ${childRel}: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (st.isSymbolicLink()) fail(`cleanup host Authority contains symlink: ${childRel}`);
      if (st.isDirectory()) {
        host.set(childRel, { kind: 'dir' });
        visit(childAbs, childRel);
        continue;
      }
      if (st.isFile()) {
        const digest = sha256(fs.readFileSync(childAbs));
        host.set(childRel, { kind: 'file', sha256: digest });
        continue;
      }
      fail(`cleanup host Authority contains special node: ${childRel}`);
    }
  };
  visit(root, '');
  return host;
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
if (plan.contract !== PLAN_CONTRACT) fail('cleanup sealed plan contract mismatch');
if (plan.transactionId !== transactionId) fail('cleanup sealed plan transactionId mismatch');
if (typeof plan.planHash !== 'string' || !/^[a-f0-9]{64}$/u.test(plan.planHash)) {
  fail('cleanup sealed plan hash is invalid');
}
const { planHash, ...body } = plan;
if (sha256(canonicalJson(body)) !== planHash) fail('cleanup sealed plan hash mismatch');

const authorityFiles = Array.isArray(plan.files)
  ? plan.files.filter((file) => file && file.group === 'authority')
  : [];
if (authorityFiles.length === 0) fail('cleanup sealed plan has no authority files');

/** @type {Map<string, string>} */
const sealedFiles = new Map();
for (const file of authorityFiles) {
  if (typeof file.path !== 'string' || !file.path.startsWith(AUTHORITY_PREFIX)) {
    fail(`cleanup sealed plan authority path is invalid: ${file?.path ?? '<missing>'}`);
  }
  if (typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(file.sha256)) {
    fail(`cleanup sealed plan authority hash is invalid: ${file.path}`);
  }
  const relative = file.path.slice(AUTHORITY_PREFIX.length);
  const normalized = normalizeArchivePath(relative);
  if (normalized.skip) fail(`cleanup sealed plan authority path resolves empty: ${file.path}`);
  if (sealedFiles.has(normalized.name)) fail(`cleanup sealed plan has duplicate authority path: ${normalized.name}`);
  if (path.posix.basename(normalized.name).startsWith('._')) {
    fail(`cleanup sealed plan must not seal AppleDouble path as authority data: ${normalized.name}`);
  }
  sealedFiles.set(normalized.name, file.sha256);
}

const sealedPaths = [...sealedFiles.keys()];
const archiveMembers = readArchiveMembers(archivePath);
/** @type {Map<string, { kind: 'file' | 'dir', sha256?: string }>} */
const expected = new Map();
/** @type {Set<string>} */
const seenNames = new Set();
/** @type {Set<string>} */
const archiveDirs = new Set();

for (const member of archiveMembers) {
  const normalized = normalizeArchivePath(member.name);
  if (normalized.skip) continue;
  const { name } = normalized;
  if (seenNames.has(name)) fail(`cleanup archive has duplicate canonical path: ${name}`);
  seenNames.add(name);

  if (member.kind === 'symlink' || member.kind === 'hardlink' || member.kind === 'special') {
    fail(`cleanup archive rejects ${member.kind} member: ${name}`);
  }
  if (member.kind === 'dir') {
    archiveDirs.add(name);
    continue;
  }
  if (member.kind !== 'file' || typeof member.digest !== 'string') {
    fail(`cleanup archive member is not a regular file or directory: ${name}`);
  }

  const base = path.posix.basename(name);
  if (isStrictAppleDoubleBase(base)) {
    const companion = appleDoubleCompanionPath(name);
    if (companion == null) fail(`cleanup archive AppleDouble name is invalid: ${name}`);
    const sealedCompanion = companion !== '.' && sealedFiles.has(companion);
    const ancestorCompanion =
      companion === '.' ||
      sealedPaths.some((sealedPath) => isAncestorDirectory(companion, sealedPath));
    if (!sealedCompanion && !ancestorCompanion) {
      fail(`cleanup archive AppleDouble is not a sealed-file or sealed-ancestor companion: ${name}`);
    }
    expected.set(name, { kind: 'file', sha256: member.digest });
    continue;
  }

  const sealedHash = sealedFiles.get(name);
  if (!sealedHash) {
    fail(`cleanup archive contains unsealed non-metadata regular file: ${name}`);
  }
  if (sealedHash !== member.digest) {
    fail(`cleanup archive hash mismatch for sealed file: ${name}`);
  }
  expected.set(name, { kind: 'file', sha256: member.digest });
}

for (const [sealedPath, sealedHash] of sealedFiles.entries()) {
  const entry = expected.get(sealedPath);
  if (!entry || entry.kind !== 'file') {
    fail(`cleanup archive missing sealed regular file: ${sealedPath}`);
  }
  if (entry.sha256 !== sealedHash) {
    fail(`cleanup archive sealed file digest mismatch: ${sealedPath}`);
  }
  for (const ancestor of ancestorPaths(sealedPath)) {
    const existing = expected.get(ancestor);
    if (existing && existing.kind !== 'dir') {
      fail(`cleanup expected path kind conflict at ${ancestor}`);
    }
    expected.set(ancestor, { kind: 'dir' });
  }
}

for (const [expectedPath, entry] of expected.entries()) {
  if (entry.kind !== 'file') continue;
  for (const ancestor of ancestorPaths(expectedPath)) {
    const existing = expected.get(ancestor);
    if (existing && existing.kind !== 'dir') {
      fail(`cleanup expected path kind conflict at ${ancestor}`);
    }
    expected.set(ancestor, { kind: 'dir' });
  }
}

for (const archiveDir of archiveDirs) {
  const entry = expected.get(archiveDir);
  if (!entry || entry.kind !== 'dir') {
    fail(`cleanup archive contains unsealed directory: ${archiveDir}`);
  }
}

if (expected.size === 0) fail('cleanup expected map is empty');

const host = walkHost(authorityRoot);
if (host.size === 0) fail('cleanup host Authority store is empty; requires retained failed extraction');

for (const [hostPath, hostEntry] of host.entries()) {
  const want = expected.get(hostPath);
  if (!want) fail(`cleanup host Authority has unexpected path: ${hostPath}`);
  if (want.kind !== hostEntry.kind) {
    fail(`cleanup host Authority type mismatch at ${hostPath}: expected ${want.kind}`);
  }
  if (want.kind === 'file') {
    if (hostEntry.sha256 !== want.sha256) {
      fail(`cleanup host Authority hash mismatch at ${hostPath}`);
    }
  }
}

for (const expectedPath of expected.keys()) {
  if (!host.has(expectedPath)) {
    fail(`cleanup host Authority missing expected path: ${expectedPath}`);
  }
}

const filePaths = [...expected.entries()]
  .filter(([, entry]) => entry.kind === 'file')
  .map(([name]) => name)
  .sort();
const dirPaths = [...expected.entries()]
  .filter(([, entry]) => entry.kind === 'dir')
  .map(([name]) => name)
  .sort((left, right) => right.split('/').length - left.split('/').length || right.localeCompare(left));

for (const relativePath of filePaths) {
  const abs = path.join(authorityRoot, relativePath);
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch (error) {
    fail(`cleanup pre-unlink lstat failed for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    fail(`cleanup pre-unlink type changed for ${relativePath}`);
  }
  const digest = sha256(fs.readFileSync(abs));
  if (digest !== expected.get(relativePath).sha256) {
    fail(`cleanup pre-unlink hash mismatch for ${relativePath}`);
  }
  try {
    fs.unlinkSync(abs);
  } catch (error) {
    fail(`cleanup unlink failed for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const relativePath of dirPaths) {
  const abs = path.join(authorityRoot, relativePath);
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch (error) {
    fail(`cleanup pre-rmdir lstat failed for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (st.isSymbolicLink() || !st.isDirectory()) {
    fail(`cleanup pre-rmdir type changed for ${relativePath}`);
  }
  try {
    fs.rmdirSync(abs);
  } catch (error) {
    fail(`cleanup rmdir failed for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const leftovers = fs.readdirSync(authorityRoot);
if (leftovers.length !== 0) {
  fail(`cleanup did not restore empty Authority host store; leftovers: ${leftovers.join(',')}`);
}

process.stdout.write('cleanup_identity_delete=ok\n');
