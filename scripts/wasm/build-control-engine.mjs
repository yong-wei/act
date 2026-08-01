import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const repoRoot = process.cwd();
const controlEngineRoot = path.join(repoRoot, 'rust/control-engine');
const wasmOutDir = path.join(repoRoot, 'src/resources/control-system/wasm/control_engine');
const wasmPackageFiles = ['index.js', 'index_bg.wasm', 'index.d.ts'];
const wasmBuildHashFile = path.join(wasmOutDir, '.build-hash');

if (process.env.SKIP_WASM_BUILD === '1') {
  const missing = wasmPackageFiles.filter((file) => !existsSync(path.join(wasmOutDir, file)));
  if (missing.length) {
    throw new Error(`SKIP_WASM_BUILD=1 但缺少已生成的控制分析 Wasm 文件：${missing.join(', ')}`);
  }
  console.log(`[wasm] SKIP_WASM_BUILD=1，复用已生成的控制分析 Wasm 包：${wasmOutDir}`);
  process.exit(0);
}

const rustupBin = '/opt/homebrew/opt/rustup/bin';
const basePath = [rustupBin, process.env.PATH].filter(Boolean).join(path.delimiter);

const resolveRustToolchainBin = () => {
  const candidates = [
    process.env.RUSTUP_BIN,
    '/opt/homebrew/bin/rustup',
    '/opt/homebrew/opt/rustup/bin/rustup',
    'rustup',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const rustcPath = execFileSync(candidate, ['which', 'rustc'], {
        cwd: repoRoot,
        env: { ...process.env, PATH: basePath },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      return path.dirname(rustcPath);
    } catch {
      // Try the next rustup candidate.
    }
  }
  return null;
};

const rustToolchainBin = resolveRustToolchainBin();
const env = {
  ...process.env,
  PATH: [rustToolchainBin, rustupBin, process.env.PATH].filter(Boolean).join(path.delimiter),
};

if (!existsSync(path.join(controlEngineRoot, 'Cargo.toml'))) {
  throw new Error('缺少 rust/control-engine/Cargo.toml，无法构建控制分析 Wasm。');
}

function collectFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
    })
    .sort();
}

function readCommandVersion(command) {
  try {
    return execFileSync(command, {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      shell: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function hashFile(hash, filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  hash.update(`${relativePath}\0`);
  hash.update(String(statSync(filePath).size));
  hash.update('\0');
  hash.update(readFileSync(filePath));
  hash.update('\0');
}

function computeBuildHash() {
  const hash = createHash('sha256');
  hash.update(`wasm-pack:${readCommandVersion('wasm-pack --version')}\n`);
  hash.update(`rustc:${readCommandVersion('rustc --version')}\n`);
  const inputFiles = [
    path.join(repoRoot, 'scripts/wasm/build-control-engine.mjs'),
    path.join(repoRoot, 'rust/control-engine/Cargo.toml'),
    path.join(repoRoot, 'rust/control-engine/Cargo.lock'),
    ...collectFiles(path.join(repoRoot, 'rust/control-engine/src')),
  ].filter((filePath) => existsSync(filePath));

  for (const filePath of inputFiles) {
    hashFile(hash, filePath);
  }
  return hash.digest('hex');
}

function hasCompleteWasmPackage() {
  return wasmPackageFiles.every((file) => existsSync(path.join(wasmOutDir, file)));
}

const buildHash = computeBuildHash();
const previousBuildHash = existsSync(wasmBuildHashFile)
  ? readFileSync(wasmBuildHashFile, 'utf8').trim()
  : null;

if (process.env.FORCE_WASM_BUILD !== '1' && hasCompleteWasmPackage() && previousBuildHash === buildHash) {
  console.log(`[wasm] 控制分析 Wasm 输入未变化，复用已生成包：${wasmOutDir}`);
  process.exit(0);
}

const wasmBuildOutDir = mkdtempSync(path.join(controlEngineRoot, '.wasm-pack-'));
const wasmPackArgs = [
  'build',
  'rust/control-engine',
  '--target',
  'web',
  '--release',
  '--out-dir',
  path.relative(controlEngineRoot, wasmBuildOutDir),
  '--out-name',
  'index',
];

if (readCommandVersion('wasm-opt --version') === 'unknown') {
  console.warn('[wasm] wasm-opt 不可用，跳过额外二进制优化。');
  wasmPackArgs.push('--no-opt');
}

execFileSync(
  'wasm-pack',
  wasmPackArgs,
  {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  },
);

if (existsSync(wasmOutDir)) {
  if (lstatSync(wasmOutDir).isSymbolicLink()) {
    unlinkSync(wasmOutDir);
  } else {
    rmSync(wasmOutDir, { recursive: true, force: true });
  }
}

mkdirSync(wasmOutDir, { recursive: true });
cpSync(wasmBuildOutDir, wasmOutDir, { recursive: true });
rmSync(wasmBuildOutDir, { recursive: true, force: true });
writeFileSync(wasmBuildHashFile, `${buildHash}\n`);

const missing = wasmPackageFiles.filter((file) => !existsSync(path.join(wasmOutDir, file)));
if (missing.length) {
  throw new Error(`控制分析 Wasm 构建完成后缺少输出文件：${missing.join(', ')}`);
}
