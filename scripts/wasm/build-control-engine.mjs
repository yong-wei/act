import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const wasmOutDir = path.join(repoRoot, 'src/resources/control-system/wasm/control_engine');
const wasmPackageFiles = ['index.js', 'index_bg.wasm', 'index.d.ts'];

if (process.env.SKIP_WASM_BUILD === '1') {
  const missing = wasmPackageFiles.filter((file) => !existsSync(path.join(wasmOutDir, file)));
  if (missing.length) {
    throw new Error(`SKIP_WASM_BUILD=1 但缺少已生成的控制分析 Wasm 文件：${missing.join(', ')}`);
  }
  console.log(`[wasm] SKIP_WASM_BUILD=1，复用已生成的控制分析 Wasm 包：${wasmOutDir}`);
  process.exit(0);
}

const rustupBin = '/opt/homebrew/opt/rustup/bin';
const basePath = `${rustupBin}:${process.env.PATH ?? ''}`;

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
  PATH: [rustToolchainBin, rustupBin, process.env.PATH].filter(Boolean).join(':'),
};

if (!existsSync(path.join(repoRoot, 'rust/control-engine/Cargo.toml'))) {
  throw new Error('缺少 rust/control-engine/Cargo.toml，无法构建控制分析 Wasm。');
}

execFileSync(
  'wasm-pack',
  [
    'build',
    'rust/control-engine',
    '--target',
    'web',
    '--release',
    '--out-dir',
    wasmOutDir,
    '--out-name',
    'index',
  ],
  {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  },
);
