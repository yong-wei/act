# Tasks: issue-2084-audit-legacy-fact-identity

## 1. 审计清单（只读先行）

- [ ] 1.1 新增身份审计脚本/只读路由：复用 `projectLearningFactServingIdentity` 与 crosswalk 索引，按账号输出三分类（可确定回填/映射、只能映射到 legacy、无法确定）。
- [ ] 1.2 报告包含输入、规则、执行 revision、前后计数摘要与异常记录；重复执行结果一致。

## 2. 画像展示

- [ ] 2.1 `/api/user/profile` 及学生状态面暴露 `knowledgeIdentityCoverage`/`knowledgeIdentityLayers` 分组统计与混合版本限制说明。
- [ ] 2.2 被隔离事实的数量与受限状态在画像统计中显式呈现。

## 3. 幂等隔离

- [ ] 3.1 以审计报告为输入，对无法确定身份的事实执行零权重隔离（复用 quality-weight `profileWeight:0`/`skipProfileContribution` 机制）。
- [ ] 3.2 治理记录走 append-only `LearnerFactTransition`，按 `sourceEventId` 去重；重复执行无副作用。
- [ ] 3.3 不触碰历史行的 CANONICAL 身份列；不写新事实行（确需写行走 Legacy adapter 约束）。

## 4. 质量报告与可恢复

- [ ] 4.1 迁移前后数据质量报告（计数、分类分布、异常记录）。
- [ ] 4.2 隔离恢复路径实现并随报告交付。

## 5. 回归测试与验证

- [ ] 5.1 测试：三分类审计一致性与只读性；隔离幂等（重复执行不产生新事实/不重复计数/不改已确认来源）；隔离事实不进入高置信度推荐；画像分组统计呈现。
- [ ] 5.2 `rtk npm run test:unit`（data-governance 相关）与 `rtk npm run typecheck` 通过。
- [ ] 5.3 `openspec validate issue-2084-audit-legacy-fact-identity --type change --strict` 通过。
