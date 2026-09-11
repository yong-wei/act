# Proposal: issue-2084-audit-legacy-fact-identity

映射 GitHub Issue: #2084「对历史 LearningFact 缺失知识身份执行可审计迁移或隔离」。

## Why

Issue 经代码核查判定**部分属实**，须先修正其隐含诊断：防伪装（serving 永不重解释历史字节、spec 禁止回填、DB CHECK 约束）与防进入高置信度个性化（混合版本证据在推荐引擎 fail-closed，`engine.ts:948-998`）在 #1116/#1275 已实现，实际行为比 Issue 要求的更保守——整个混合账号直接无推荐，而非仅隔离不可恢复的事实。

真实缺口有四：① 历史事实身份的三分类可审计清单不存在（唯一相关物 `verify-canonical-learning-fact-identity.mjs` 是生产者静态门禁，非数据审计）；② 可追溯、幂等的迁移/隔离操作不存在；③ 画像侧不展示按知识身份分组的统计与混合版本限制（`knowledgeIdentityCoverage`/`knowledgeIdentityLayers` 已在特征缓存内算出，但 `/api/user/profile` 不 select 身份列，无任何 API/UI 呈现）；④ 迁移前后数据质量报告与可恢复方案不存在。

## What Changes

- 新增历史事实身份审计清单（只读先行）：按账号把历史事实分为「可确定回填/映射」「只能映射到 legacy」「无法确定」三类，输出含执行 revision、前后计数摘要、异常记录的不可变报告。
- 对无法可靠恢复身份的事实执行幂等隔离（零权重上下文，复用既有 quality-weight 机制），以 append-only 治理记录保持可审计；重复执行不产生新事实、不重复计数、不改变已确认来源。
- 画像 API 与学生端状态面展示按知识身份分组的统计与混合版本限制；推荐引擎行为保持不变（已 fail-closed）。
- 提供迁移前后数据质量报告、回归测试与可恢复方案。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `canonical-knowledge-learning-fact-identity`: 新增需求——历史事实身份审计清单与幂等隔离；明确不修改「Historical facts remain Legacy-bound」的禁回填条款。
- `student-evidence-status`: 新增需求——画像状态面展示按知识身份分组的统计与混合版本限制。

## Impact

- 代码：新增审计脚本/只读路由（复用 `projectLearningFactServingIdentity` 与 crosswalk 索引）、quality-weight 零权重隔离、`/api/user/profile` 及学生状态面展示、数据质量报告。
- 数据：隔离走既有治理列与 append-only `LearnerFactTransition` 记录；不向历史行写 CANONICAL 列。
- 依赖关系：与 #2080（缓存读取修复）相邻，建议 #2080 先行；CANONICAL 身份回填（若确有需要）须单独立项并以修订「Historical facts remain Legacy-bound」spec 条款为前提，且依赖写入权威切换（#1117）先行——本 change 不含回填。与进行中的课程 Runtime 发布无关。
- 非目标：不删除混合身份标记、不为历史记录随意补字段、不修改 crosswalk 的读时解析语义。
