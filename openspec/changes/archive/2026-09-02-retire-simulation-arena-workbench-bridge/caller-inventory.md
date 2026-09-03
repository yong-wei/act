# C23 caller inventory

绑定修订：`911b6aa290`（C22 squash，inventory 起点）
绑定文件 blob：`src/features/simulation-arena-workbench/experience-shell-contracts.ts` @ `c0ff0c049d415ed2851bb201d9d272fca1831b5e`

C22 已归档：`openspec/changes/archive/2026-09-02-migrate-practice-artifact-consumers-to-existing-contract/c23-c24-readiness.md`。Artifact/Run contract 已就绪；本变更只处理 shell context 归属。

## 生产 / 测试 / 动态 callers

静态、动态 `import(` 与测试扫描结果：无 dynamic import；无 compatibility barrel。

| 导出 | 生产 caller | 测试 caller | owner | replacement | rollback |
|---|---|---|---|---|---|
| `describeExperienceLaunch` | `control-workbench-shell.tsx`、`simulations/cruise/page.tsx` | `simulation-arena-workbench-experience-ui.test.ts` | Platform UI | `describeExperienceLaunch(kind)` in `platform-ui-contracts.ts` | 恢复 helper 与两处 import |
| `buildWorkbenchExperienceContext` | `control-workbench-shell.tsx`（只用 `launch.kind`） | 同上 | Control Workbench | `getControlWorkbenchLaunchKind` + 既有 `getControlWorkbenchReturnHref` | 恢复 builder；shell 改回 `experienceContext.launch.kind` |
| `buildExperienceStatusPayloads` / replay / model relation helpers | 无 | 仅 bridge 测试 | 无生产 owner | **删除**。preview≠official 由 launch 文案与 Arena/C22 合同覆盖 | 恢复 payload helpers |
| `buildCourseLaunchExperienceContext` | 无 | 仅 bridge 测试 | lesson runtime | **删除**。`buildResourceRendererLaunchContext` 已覆盖 course-bound / standalone | 恢复 wrapper |
| slot / archetype / route / migration 常量 | 无 | 仅 bridge 测试 | 各页面 data-* | **删除**。owner 文件上的 workspace markers 仍由 source-scan 覆盖 | 恢复常量数组 |
| 其余未调用类型 | 无 | 无 | — | **删除** | 恢复文件 |

## 行为 characterization（保留）

- Arena → Workbench：`taskId` 会话 → `official-evaluation` 或 `arena-preview`；returnHref 仍走 `getControlWorkbenchReturnHref`（含 `publicationId`）。
- 自由探索 Workbench：`standalone`，返回跨域探索。
- Cruise 场景：黑箱 + 可访问 publication → `official-evaluation`；黑箱无 publication → `arena-preview`；否则 `standalone`。returnHref 仍走 Arena return + publication 查询。
- 课程 resource launch：仍由 `ResourceRenderer` / `buildResourceRendererLaunchContext` 持有；过渡层从未被课程生产路径导入。
