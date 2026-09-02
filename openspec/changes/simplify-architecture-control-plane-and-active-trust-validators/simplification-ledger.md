# Control-Plane Simplification Receipt — simplify-architecture-control-plane-and-active-trust-validators

## Before / After 控制面 validator map（task 1.1，消费 C34 inventory）

| 控制面事实 | 唯一权威 validator（owner） | 证据 |
|-----------|---------------------------|------|
| Census 基线与 drift | `scripts/architecture-census.ts` → `src/lib/architecture-census/`（census-core.json 基线为冻结对比输入） | `architecture-census.test.ts` |
| Charter/deprecation | `scripts/architecture-charter.ts` → `src/lib/architecture-charter/` | `architecture-charter.test.ts` |
| Dependency/fitness | `scripts/architecture-fitness.ts`（allowlist/ledger 写入独立模式） | `architecture-fitness.test.ts` + budgets |
| 退役闭包（retired-stays-retired） | `scripts/architecture-closure.ts` → `src/lib/architecture-closure/`（manifest 驱动、privacy 检查 receipt） | `architecture-closure.test.ts`（807 行） |
| Toolchain boundary | `tools/boundary/cli.ts check`（只读 allowlist `allowed-product-path-reads.json`） | `independent-toolchain-execution-boundary.test.ts`（12 项含 dirty/duplicate/privacy fail-close） |
| Quality/toolchain 命令合同 | `scripts/quality-gates.ts` + `docs/architecture/quality-gates/registry.json`（33 commands/40 checks 与 package.json 零失配，本轮交叉核验） | registry + runner |
| Release/rollback 安全 | 既有唯一 validator 链（`test:runtime-release-activation-rollback`、`test:runtime-production-cutover-contract`），架构/质量结果仅为 evidence 输入 | C34 inventory release contract 断言 |
| CLI 表面 | C34 `docs/architecture/tooling-cli-inventory.json`（capture 分母哈希 fail-closed + dirty-guard） | `tooling-cli-inventory.test.ts` 14 项 |

控制面入口脚本本身已是薄入口（12–201 行）委托 `src/lib` 共享 owner——未发现可证明等价的重复 validator 实现；本轮流简化不强行合并（无谓 facade 化）。

## 删除项（task 1.2，可重建派生物/已完成系列移交/过期快照）

| 删除文件 | 大小 | 理由 | 重建/回滚 |
|----------|------|------|-----------|
| `docs/architecture/toolchain-boundary/denominator.json` | 10.7KB | write-only 生成物：仅由 `toolchain:boundary:write` 写出，`check` 只读 allowlist，全仓零读取者 | `npm run toolchain:boundary:write` 随时重建 |
| `docs/architecture/toolchain-boundary/migration-map.md` | 4KB | 已完成系列的移交表：所列 5 个 follow-up change 全部归档，caller 清单已由 `allowed-product-path-reads.json` 活配置持有 | git revert |
| `docs/architecture/toolchain-boundary/preexisting-tools-typecheck.md` | 0.9KB | 过期债务快照：引用旧修订 `3eec9726d` 与 exit:134 OOM；当前 tools graph 债务形态已不同（20 项 tsc-type-errors，stash 基线对照记录于 C34 receipt） | git revert |

## Before/after 行为证据

- `toolchain:boundary:check` 删除前后 exit code 相同（1=1，`frozen-callers.ts` path-read 失败为既有状态，stash 干净基线对照一致）；输出条目相同。
- `npm run typecheck` 0 错误；`npm run lint` 通过；quality-gates registry 与 package.json 零失配。
- 1.3 状态覆盖由既有 fixture 持有：clean/dirty/mixed（boundary dirty fail-close）、duplicate owner/denominator 冲突、privacy（absolute paths/secrets 拒绝）、receipt digest drift、qualified/blocked（boundary qualify/fail-close + C34 inventory 双比对）。

## 保留边界

`verify:commit`/`verify:push`/`typecheck`/五 graph 边界、PlatformSetting、AppShell/role/SSR/R3F、portable receipts、release/rollback 唯一安全 validator 全部不动（本 diff 仅删除 3 个零消费者文档/生成物文件）。README（同目录）不含对删除文件的引用。

## Rollback

单 commit revert；无代码、schema、权限或 receipt 变更。
