## Context

当前 `/graph-center` 由 `GraphCenterPage` 组装 `buildGraphCenterPayload` 和 `GraphCenterClient`，同时提供资源覆盖、学习者/班级 overlay、筛选和动作；`/knowledge` 由 `KnowledgeGraphWorkspace` 包装 `KnowledgeGraphSystem`，并已承载 active Authority、受限 candidate 和 legacy 诊断模式。两条链路都能成为图谱入口，且 Graph Center 的数据治理组合无法替代 active Authority 的有界 shard 读取合同。

本变更依赖 C20 所列 G 系列六项 active Authority 变更。它只处理产品入口和重复组合层，不触碰 active Authority 的实现或发布控制面。

## Goals / Non-Goals

**Goals:**

- 为学生和教师保留一个可发现、可访问、角色隔离的知识读取入口。
- 在迁移后证明每个仍需保留的 Graph Center 动作有一个 canonical owner 和调用路径。
- 让 candidate/legacy 继续是明确的 admin/QA 诊断状态，并保持与 active、rollback 的 hash 身份隔离。
- 以零生产调用者证明结束旧路由、旧组件和仅属旧路径的测试。

**Non-Goals:**

- 不重建或调整 active Authority graph、force graph、formula rendering、locale、parity、workspace contract。
- 不修改 selector、domain shard、schema、production Authority、数据库或发布物。
- 不删除 `/knowledge` 的 active/legacy/candidate 数据合同，不把 Graph Center overlay 塞回 active graph。
- 不借本变更简化 `active-authority-graph.tsx` 或任何尚未完成 G 系列审查的代码。

## Decisions

### 1. `/knowledge` is the sole product knowledge workspace

迁移后平台导航、学生入口和教师知识入口只指向 `/knowledge`。需要保留的图谱节点、资源和学习动作调用现有 active Authority/read-model API；缺少等价动作时，进入已有角色拥有的分析页面，而不是新增 Graph Center 兼容卡片。

### 2. Candidate and legacy stay explicit and role-scoped

仅当现有 candidate access policy 和 controlled verification 同时允许时，才保留诊断入口。普通学生读取不得看到 candidate/legacy 入口或 payload；管理员/QA 诊断仍显示受控状态。任何模式切换必须保留各自 session、selector/hash 和回滚身份，不能把诊断读提升为 active。

### 3. Delete only after caller closure

先扫描路由、导航、教师分析、AI context、脚本和测试调用者。只有 `GraphCenterPage`、`GraphCenterClient`、Graph Center payload builder 及其测试的生产调用者全部迁移或明确不再需要，才删除旧文件；仍被角色分析或治理工具使用的纯数据函数先迁入其真实 owner，再决定删除。

### 4. Do not emulate active Authority through a redirecting data layer

`/knowledge` 的 bounded server responses、现有 presentation、resource eligibility、snapshot/projection/hash 校验继续作为唯一 authority。迁移代码不得把完整 Graph Center payload 重新包装成 active graph，也不得在前端截断完整图谱来模拟 progressive loading。

## Risks / Trade-offs

- [Risk] 深链接或教师分析仍指向 `/graph-center`。→ 先完成调用者清单和针对每类入口的迁移测试；未迁移入口阻止删除，不用静默丢失角色动作。
- [Risk] 删除 Graph Center 时误删 active graph 测试或资源入口。→ 以生产/测试 caller 分类为准，只删除旧入口特有覆盖，保留 active Authority、resource eligibility 和角色隔离测试。
- [Risk] candidate/legacy 被误展示为 active。→ 保持现有 policy、模式身份和 hash/rollback 断言，并增加跨模式不可混读的负向测试。

## Migration Plan

1. 在六项 G 系列依赖完成前只做静态 caller inventory，不改 active Authority。
2. 为 `/knowledge` 的 active、candidate、legacy 和关键角色动作补齐 characterization，记录 Graph Center 行为中必须保留的可见结果。
3. 逐一迁移生产导航、教师/AI context 和资源动作；随后删除 Graph Center route、client、无消费者 payload 组合及旧入口测试。
4. 在 1440px 与 320px 角色浏览器路径验证 `/knowledge`，执行 focused tests、typecheck、严格 OpenSpec 校验和 selector/shard/schema 零差异检查。

回滚以恢复本变更提交为界；回滚不得改变 active selector、生产 Authority 或历史 hash，也不得重新开放第二套 graph runtime。

## Open Questions

无。若 caller inventory 仍存在未归属动作，变更保持 blocked，不能用兼容重定向掩盖未完成迁移。
