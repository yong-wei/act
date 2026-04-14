import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const rustupBin = '/opt/homebrew/opt/rustup/bin';
const env = {
  ...process.env,
  PATH: `${rustupBin}:${process.env.PATH ?? ''}`,
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
    path.join(repoRoot, 'src/resources/control-system/wasm/control_engine'),
    '--out-name',
    'index',
  ],
  {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  },
);
