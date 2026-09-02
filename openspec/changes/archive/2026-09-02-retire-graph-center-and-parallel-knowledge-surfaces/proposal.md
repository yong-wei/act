## Why

当前同时存在 `/graph-center` 的 K/A/Q 只读中心和 `/knowledge` 的 Authority 知识工作区。两者各自组合筛选、节点详情、资源覆盖和角色投影，继续保留会使学生/教师面对两个相似入口，也会让旧 `src/lib/data-governance/graph-center` 继续成为平行读取权威。M5 需要在 active Authority 已有六项 G 系列变更稳定后，明确唯一产品读取表面。

## What Changes

- **BREAKING** 退役 `/graph-center` 路由、其导航入口和仅服务于该路由的 `GraphCenterClient`/payload 组合。
- 将仍有价值的节点详情、资源入口和角色动作迁移到 `/knowledge` 或已有角色拥有的分析入口；不复制第二套 graph runtime。
- 将 candidate/legacy 读取保留为显式、受权限限制的管理员/QA 诊断能力，不进入学生 bundle，也不伪装成 active Authority。
- 删除仅保护已退役 Graph Center 路径的组件、测试和 compatibility 记录；保留 active Authority 的读取、哈希、回滚和角色隔离合同。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `graph-center-ui`: 移除重复的生产图谱中心能力，并把 `/knowledge` 固定为唯一 canonical knowledge workspace。

## Dependency and Boundary

本变更为 C20，属于 M5，必须等待现有 active Authority graph G 系列六项完成或明确解除阻塞：

- `activate-v037-bilingual-authority-graph`（locale）
- `consolidate-active-authority-graph-controls`（controls）
- `render-authority-formulas-on-graph-canvas`（formula）
- `restore-active-authority-force-runtime-parity`（force）
- `verify-active-authority-graph-parity`（parity）
- `adopt-active-authority-knowledge-workspace`（workspace）

实现不得修改 Authority selector、domain shard、ActKG schema 或生产 Authority。该依赖只约束切换时序，不授权改写上述变更。

## Impact

- 路由与导航：`src/app/graph-center/page.tsx`、`src/lib/platform-role-navigation.ts` 及平台入口测试。
- 重复产品层：`src/features/graph-center/graph-center-client.tsx` 与 `src/lib/data-governance/graph-center*` 的实际生产调用者。
- 保留并复用：`src/app/knowledge/page.tsx`、`KnowledgeGraphWorkspace`、active/candidate/legacy 权限策略及其现有 API。
- 不改变 active Authority 的 selector、hash、rollback、role isolation、snapshot/projection 语义，也不涉及 Arena 或数值运行时。
