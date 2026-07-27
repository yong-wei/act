## Context

图谱页面会注入页面上下文，但现有知识工具查询旧 Prisma 节点。候选页面必须使用同一 ReleaseSet，且只影响当前会话回答。

## Goals / Non-Goals

**Goals:**

- 让候选页面控灵理解当前 ReleaseSet、选中对象和图谱筛选。
- 提供聚焦的 Canonical 搜索、详情和邻居工具。
- 保持候选问答可诊断、只读、无学习状态副作用。

**Non-Goals:**

- 不新增全平台万能工具集。
- 不迁移正式 RAG 或 SAR。
- 不产生事实、画像、推荐或路径动作。

## Decisions

1. 页面上下文使用 Canonical ID 与 ReleaseSet identity，不以名称建立 Legacy 对应。
2. 工具复用 Repository 和 `act.node-detail.v2`，邻居查询保留谓词、方向和治理等级。
3. 候选来源进入回答诊断；证据不足仍按现有回答可信性合同处理。
4. 服务端禁止候选工具进入任何写入型 action、path execution 或 learner-state producer。
5. 离开候选页面继续追加新的当前页面上下文，不篡改既有会话历史结构。
6. 本变更负责消费候选图谱的公开激活门禁；未通过完整候选控灵验收时不得对普通用户开放。

## Risks / Trade-offs

- [模型把候选内容当正式教学状态] → 系统上下文标明 candidate，工具层拒绝副作用。
- [工具上下文过大] → 只暴露页面所需搜索、详情和有限邻居，不载入完整 Release。
- [回答与画布版本漂移] → 每次工具结果携带 ReleaseSet identity。

## Migration Plan

在受控候选图谱启用专用页面工具集；通过服务端测试证明写入型工具不可达，再执行跨页面会话和选中对象浏览器验收。全部验收通过后打开候选图谱公开门禁并设为迁移期默认视图。

## Open Questions

无。
