# Tasks: issue-1947-live-runner

## 1. 导入修复

- [ ] 1.1 将 `scripts/konling-fair-experiment/run-live.ts` 的 `@/lib/ai-client` 导入改为 `@/lib/ai/provider-runtime`（三个函数同名同签名）

## 2. 提交门禁

- [ ] 2.1 新增 `tsconfig.konling-scripts.json`（extends `tsconfig.base.json`，仅 include `scripts/konling-fair-experiment/**` 与 `scripts/konling-blind-audit/**`，排除 fixtures/tests）
- [ ] 2.2 在 `package.json` 增加 `typecheck:konling-scripts` 命令（`tsc --noEmit -p tsconfig.konling-scripts.json`），并追加进 `verify:commit` 与 `verify:push`
- [ ] 2.3 验证门禁：故意恢复失效导入时命令失败（TS2307），修复后命令通过

## 3. 运行时冒烟测试

- [ ] 3.1 新增 `src/lib/__tests__/konling-fair-experiment-entrypoints-smoke-1947.test.ts`：子进程 tsx 在 tmpdir 中全量运行 fixture runner，断言 exit 0、complete 汇总与 manifest 的 `gitRevision` / `scorerRevision` 非空
- [ ] 3.2 同测试对 fixture 产物运行 `replay-scoring.ts --run-id <同 runId>`，断言 exit 0 与 complete 状态
- [ ] 3.3 同测试无 opt-in 环境变量运行 `run-live.ts`，断言 exit 非 0 与 opt-in 提示文本（证明 provider runtime 模块图可加载）

## 4. 验证与收尾

- [ ] 4.1 运行新冒烟测试与既有相关测试（`konling-fair-experiment-1900`、`konling-blind-audit-resume-1820`）确认行为保留
- [ ] 4.2 `npm run typecheck` 零错误、`lint` 零告警、`openspec validate issue-1947-live-runner --strict` 通过
- [ ] 4.3 完整 diff Local Review 后提交并推送
