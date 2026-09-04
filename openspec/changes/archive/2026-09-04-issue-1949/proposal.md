## Why

知识问答与讲解模块的核心价值是「准确、可追溯、可核查」。fair-live-20260904-r1 实验的 36 条回答盲审全部通过，但盲审说明出现「引用标记虽为占位符」「引用标记虽为模拟」等判断：当前链路允许形似引用的文本标记进入正式回答并呈现为已核验，却没有证明这些标记解析到服务器分配的 citation identity、有效证据单元和可访问锚点（Issue #1949）。

根因是引用门禁在三层之间存在缝隙：

1. **分配表丢失可核验性**：`toAssignableRuntimeCitation` 将 runtime citation 投影为 assigned 表时丢弃 `verified` 与 `citationTargetId`。`normalizeKonlingCitations` 对 `[N]`/`[引用: X]`/内部 ID 标记的解析只证明「编号或标题在表内」，不证明该条目具备稳定来源身份与有效目标锚点。unverified 或无目标的条目被数字碰撞命中后，以已核验标记保留在正文并进入持久化 citations。
2. **不可绑定标记剥离仅限学习问答**：`stripUnverifiedKonlingCitationMarkers` 在 `guard.studyQuestion` 缺失时直接原样返回，`collectUnverifiedCitationMarkers` 同样只在 study intent 下计算。非学习问答的正式回答没有第二道防线。
3. **持久化引用缺少可核验性断言**：持久化的 citations 虽携带 identity 与 href 结构，但没有门禁与回归测试锁定「稳定 citation identity、来源版本与目标锚点」三元组，也无法在 UI 端区分「已核验引用」与「表内但不可核验的条目」。

## What Changes

- 引用协议（`konling-citation-protocol.ts`）为服务器分配的每条引用增加只读 `verifiable` 声明：具备稳定来源身份与有效目标锚点（runtime 来源为 `verified === true && citationTargetId` 非空；检索工具分配来源按 href/identity 完整性声明）。
- `normalizeKonlingCitations` 对解析成功但 `verifiable` 为假的标记按未核验处理：删除标记、计入未核验集合、verificationStatus 降级并显示部分/全部未核验提示（fail closed）。
- `collectUnverifiedCitationMarkers` 与 `stripUnverifiedKonlingCitationMarkers` 不再限于学习问答：所有正式回答路径都剥离不可绑定编号标记。
- 持久化 citations 投影保持并锁定 identity（含来源版本）与目标锚点字段；学生可见内容不暴露内部 citation ID、路径或检索诊断的既有门禁以回归测试锁定。
- 补充回归测试：有效引用、占位符碰撞、未知编号、失效锚点、越权来源（UI 权限受限 fail closed）与部分核验失败。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `konling-agent-runtime`: 正式回答的引用核验门禁从「标记在分配表内」升级为「标记解析到可核验的受治理引用」；不可绑定标记的剥离从学习问答扩展到全部正式回答；持久化引用必须携带稳定 identity、来源版本与目标锚点。

### Removed Capabilities

（无）

## Impact

- 代码：`src/lib/konling-citation-protocol.ts`、`src/lib/konling-citation-repair.ts`、`src/lib/konling-agent-runtime.ts`、`src/app/api/ai/chat/route.ts`（若需透传）；测试 `src/lib/__tests__/konling-citation-protocol.test.ts` 及 guard 相关测试。
- 行为变化：unverified/无目标锚点的表内条目被 `[N]` 命中时不再以已核验标记留在正文；非学习问答回答中的不可绑定编号标记被删除并触发部分核验提示。既有「有效引用、未知编号删除、部分核验提示」行为保持不变。
- 非目标（Issue #1949）：不要求纯模型推导章节强行添加引用；不以模型盲审文本替代确定性引用解析；不改变盲审评测本身的判定；不在本变更中重做引用跳转 UI（既有 version-bound 跳转与越权提示保持）。
