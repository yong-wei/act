# C24 readiness after C23

C23 `retire-simulation-arena-workbench-bridge` 完成后，Arena legacy barrels 才可进入 C24。

## Bridge deletion

- 删除 `src/features/simulation-arena-workbench/experience-shell-contracts.ts` 与空目录 `src/features/simulation-arena-workbench/`。
- 生产不再 import `src/features/simulation-arena-workbench`。

## Replacement

| 旧 bridge API | owner | 新入口 |
|---|---|---|
| `describeExperienceLaunch(launch)` | Platform UI | `describeExperienceLaunch(kind)` @ `src/components/platform/platform-ui-contracts.ts` |
| `buildWorkbenchExperienceContext` | Control Workbench | `getControlWorkbenchLaunchKind` + `getControlWorkbenchReturnHref` @ `src/features/control-workbench/routing.ts` |
| 未使用 payload / course wrapper / slot catalog | — | 删除，不搬文件 |

## Zero-caller

扫描 `src/` 内 `simulation-arena-workbench`：仅本 change 的 inventory/receipt 与既有 OpenSpec/docs 历史引用。生产、测试、动态 import 均为 0。

C24 **不得**把 `artifact-mappers.ts` 当 bridge 删除（C22 retained）。

## Rollback

恢复 C23 删除提交中的 `experience-shell-contracts.ts` 与两处 owner import。不得另起 shell state，不得改 official/preview、Rust/WASM、固定步长或 persistence authority。

## C24 gate

Arena `index.ts` / `domain.ts` barrels 仍保留。C24 可在本 receipt 合入后清理 legacy entrypoints。
