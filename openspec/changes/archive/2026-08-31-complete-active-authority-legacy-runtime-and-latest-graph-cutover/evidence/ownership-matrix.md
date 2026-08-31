# 写所有权矩阵（任务 1.2）

| 能力 | 所有者 | 本变更允许 | 本变更禁止 |
| --- | --- | --- | --- |
| ActKG 捕获 / Bundle 导入 | #1509 provider | 只读重开 | 改捕获、另写候选 |
| Teaching Projection / domain fragments 生成 | provider | 只读哈希校验并喂给 active 视图 | 发明关系、改 composed manifest |
| Runtime Release 发布 / blob-view select | provider | 读 active identity | `deploy:runtime`、改 lifecycle desired |
| 生产 selector 写入 / 停服事务 / 补偿 | provider | 读 `current.json` 与 coordinated receipt | 写任何 `current.json`、journal、mutation |
| `/knowledge` 共享 Force Graph 运行时 | 本变更（2–4 节已由 PR #1709 合入） | 维持共享编排 | 恢复 active SVG / 第二套 layout |
| `act-knowledge-surface/v1` latest-cutover 校验 | 本变更 | 扩展只读 envelope | 第二套 assembler / 客户端选 release |
| 产品验收与 app-only 部署 | 本变更 6.4–6.8 | `scripts/build.sh` + `deploy:app --skip-build` | 把镜像部署当成 cutover 完成 |

规范性不重叠：provider spec 拥有 mutation；本变更 `active-authority-coherent-runtime-readiness` 只拥有消费侧 fail-closed 与产品证据。

## 7.4 校验

- `rtk openspec validate complete-active-authority-legacy-runtime-and-latest-graph-cutover --type change --strict`：通过。
- provider change `coordinate-latest-authority-and-active-oss-cutover` 已归档到 `openspec/changes/archive/2026-08-30-coordinate-latest-authority-and-active-oss-cutover/`；活动 `openspec/changes/` 中不再有同名 live 目录，CLI 按 change-id 校验会落到“无 delta”的过期索引，不能当作本变更引入的规范冲突。
- 写所有权：本变更未新增 `scripts/knowledge-cutover` / `scripts/runtime-release` 跟踪文件，未改任何 `current.json` 选择器，只读重开 provider 密封候选 `control-theory-engineering-v0.37-r4-c5`。
