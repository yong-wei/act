/**
 * 公平实验三入口冒烟（Issue #1947）。
 *
 * 子进程 tsx 真实加载入口模块图，不调用任何真实供应商：
 * - fixture runner 在临时目录全量确定性运行（生成、评分、汇总、manifest）；
 * - replay-scoring 对冻结快照真实回放（不触发生成）；
 * - run-live 无 opt-in 环境变量时守卫退出——能打印提示即证明含
 *   `@/lib/ai/provider-runtime` 的完整模块图加载成功（本次修复对象）。
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const scriptsDir = path.join(repoRoot, 'scripts', 'konling-fair-experiment');
const shim = path.join(repoRoot, 'scripts', 'konling-blind-audit', 'server-only-shim.mjs');
const tsxBin = path.join(repoRoot, 'node_modules', '.bin', 'tsx');

const workDir = mkdtempSync(path.join(tmpdir(), 'konling-fair-smoke-1947-'));
const runId = 'smoke-1947';

function runEntrypoint(script: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    tsxBin,
    [
      '--tsconfig', path.join(repoRoot, 'tsconfig.json'),
      '--import', shim,
      path.join(scriptsDir, script), ...args,
    ],
    { cwd: workDir, encoding: 'utf8', env: { ...process.env, ...env } },
  );
}

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('konling fair experiment entrypoint smoke (#1947)', () => {
  it('fixture runner completes deterministically and records manifest revisions', () => {
    // #1952 起默认题库为分层 V2 + 分级盲审 rubric。
    const result = runEntrypoint('run-fixture.ts', ['--run-id', runId]);
    expect(result.status).toBe(0);

    const manifest = JSON.parse(
      readFileSync(
        path.join(workDir, 'artifacts', 'konling-fair-experiment', runId, 'manifest.snapshot.json'),
        'utf8',
      ),
    );
    const config = manifest.payload.config;
    expect(typeof config.gitRevision).toBe('string');
    expect(config.gitRevision.length).toBeGreaterThan(0);
    expect(typeof config.scorerRevision).toBe('string');
    expect(config.scorerRevision.length).toBeGreaterThan(0);
    expect(manifest.payload.bank.version).toBe('fair-experiment-v2');
    expect(manifest.payload.bank.itemCount).toBe(18);
    expect(config.audit.promptVersion).toBe('konling-blind-audit-graded.v2');
    expect(config.audit.scoreVersion).toBe('rubric-graded.v2');
  }, 60_000);

  it('fixture runner keeps the frozen v1 bank selectable (#1952)', () => {
    const result = runEntrypoint('run-fixture.ts', ['--run-id', `${runId}-v1`, '--bank', 'v1']);
    expect(result.status).toBe(0);
    const manifest = JSON.parse(
      readFileSync(
        path.join(workDir, 'artifacts', 'konling-fair-experiment', `${runId}-v1`, 'manifest.snapshot.json'),
        'utf8',
      ),
    );
    expect(manifest.payload.bank.version).toBe('fair-experiment-v1');
    expect(manifest.payload.bank.itemCount).toBe(6);
    expect(manifest.payload.config.audit.promptVersion).toBe('konling-blind-audit.v1');
    expect(manifest.payload.config.audit.scoreVersion).toBe('rubric.v1');
  }, 60_000);

  it('replay-scoring replays the frozen fixture run without generation', () => {
    // 不传 --calibers/--bank：默认口径串为冻结 v1 + 当前 v2（#1950）、
    // 默认题库 V2 与 fixture 运行一致（#1952），哈希门禁通过。
    const result = runEntrypoint('replay-scoring.ts', ['--run-id', runId]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('status:');
    expect(result.stdout).toContain('caliberDeltas:');
  }, 60_000);

  it('live runner loads its module graph and refuses without explicit opt-in', () => {
    const result = runEntrypoint('run-live.ts', [], { KONLING_FAIR_EXPERIMENT_LIVE: '' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('KONLING_FAIR_EXPERIMENT_LIVE=1');
    // 加载失败（如失效导入）会在 stderr 抛模块解析错误，而非守卫提示。
    expect(result.stderr).not.toContain('Cannot find module');
  }, 60_000);
});
