# C24 caller inventory

绑定修订：`36f5670795`（claim branch 起点，`origin/integration` HEAD）

上游依赖就绪：C22 归档 `2026-09-02-migrate-practice-artifact-consumers-to-existing-contract`（PR #1853，`c23-c24-readiness.md`）；C23 归档 `2026-09-02-retire-simulation-arena-workbench-bridge`（PR #1857，`c24-readiness.md` 明确 C24 gate 打开）。

## 入口矩阵

静态 `from '@/features/arena…'`、动态 `import('…@/features/arena…')`、`require()`、route、operator 脚本与测试扫描结果：

| 入口 | 生产 caller | 测试 caller | 动态 import | operator | 裁决 |
|---|---|---|---|---|---|
| `index.ts`（root barrel） | 0 | 仅 2 处源码字符串反向断言（非 import） | 0 | 0 | **删除** |
| `domain.ts` | `app/arena/page.tsx`、`app/arena/challenges/[taskId]/page.tsx`、`app/simulations/cruise/page.tsx`、`arena/teacher/teacher-arena-config.tsx`、`interactive/multi-representation-linkage/{arena-submit-panel,model}` | 0 | 0 | 0 | **保留**（有真实消费者；Non-Goals 保护） |
| `client.ts` | 0 | 0 | 0 | 0 | **保留**（显式 client-safe 公共边界；Non-Goals 保护，删除须另有 spec） |
| `server.ts` | 0 | 仅源码字符串反向断言（plant-adapter/registry 测试） | 0 | 0 | **保留**（server-only 公共合同 + server evaluation/leaderboard/persistence/odyssey 的显式分层；Non-Goals 保护） |

测试字符串引用明细（删除 barrel 后需同步更新）：

- `src/features/arena/__tests__/arena-boundary.test.ts`：`expect(source('src/features/arena/index.ts')).not.toContain("export * from './adapters/plant-adapter'")`。
- `src/features/arena/__tests__/arena-plant-adapter-registry.test.ts`：读取 `index.ts` 源码断言不含 plant-adapter re-export。
- `arena-boundary.test.ts` / `arena-entry-ui.test.ts` 中 `not.toContain("from '@/features/arena'")` 为消费者侧反向断言，保留。

## Barrel re-export 目标能力去向

删除 root barrel 不删除任何能力；每个 re-export 目标模块保留并由直接路径消费：

| Barrel 行 | 目标模块的其他入口 |
|---|---|
| `display-labels` | `arena-hall.tsx`、control-workbench、multi-representation-linkage 等直接 import |
| `evaluation/*`（scoring、protocol、metric-*、whitebox-evaluator） | 模块文件保留；服务端由 `server.ts` re-export（evaluator/control-analysis-service）或测试直接路径消费 |
| `leaderboards/*` | `server.ts` re-export + `challenge-detail.tsx`（honors-showcase）直接 import |
| `submissions/*` | `server.ts` re-export；测试直接路径 |
| `teacher/*` | `server.ts` re-export + `app/api/teacher/arena/preview/route.ts` 直接 import |
| `odyssey/bridge` | `server.ts` re-export + `app/actions/control-odyssey.ts` 直接 import |
| `workbench/*`、`types`、`filtering`、`stats`、`data/seed-challenges`、`arena-events` | `domain.ts` re-export（C22 retained：`artifact-mappers.ts` 不得当 bridge 删除） |
| `telemetry` | `client.ts` re-export |

## Replacement / rollback

- Replacement：生产代码已按 C22/C23 迁移到 `@/features/arena/domain`、具体模块路径或跨域 owner API；本变更零生产迁移。
- Rollback：恢复删除提交中的 `index.ts` 与两处测试断言；不重建第二 Arena authority，不改变 official/preview、hidden-input、leaderboard 或 persistence 语义。
- Zero-caller check：`arena-boundary.test.ts` 断言 `index.ts` 不存在（防止 umbrella barrel 回归），并扫描生产代码不得出现 `from '@/features/arena'` 精确 import。
