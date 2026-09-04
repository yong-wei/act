## Context

正式回答的引用链路分三层：分配表构建（`buildKonlingToolRuntime` 的 `citationAllocator`）→ 标记归一化（`normalizeAndRepairKonlingCitations`）→ citation guard 与最终组装（`buildKonlingCitationGuard` / `stripUnverifiedKonlingCitationMarkers`，见 `src/app/api/ai/chat/route.ts` finalize 与 `src/app/api/ai/sessions/[id]/messages/route.ts`）。Issue #1949 指出：盲审通过的「引用支撑」可能来自形似引用的占位符，链路未证明标记解析到服务器分配的 citation identity、有效证据单元与可访问锚点。

## Goals / Non-Goals

- Goals：占位符、内部 ID、未核验/无目标条目不得以已核验引用进入正文与持久化；不可绑定编号标记的剥离覆盖全部正式回答路径；持久化引用携带 identity/来源版本/目标锚点并有回归测试锁定。
- Non-Goals：不改盲审评测判定；不重做引用跳转 UI（既有 version-bound 跳转与越权/失效提示保持）；不要求纯模型推导章节强行加引用；不改变「服务器编号 [n]」的提示协议。

## Decisions

### D1: 可核验性声明放在分配表条目上（`verifiable`）

`KonlingAssignableCitation`/`KonlingAssignedCitation` 增加只读 `verifiable: boolean`（assign 时缺省 `true`）。语义：该条目具备稳定来源身份与有效目标锚点，可作为已核验引用呈现。

- runtime 来源（`toAssignableRuntimeCitation`）：`verifiable = citation.verified === true && Boolean(citation.citationTargetId)`，与 guard 的 `isBindableAnswerUnitCitation` 同一判定。
- 检索工具分配来源：教材候选按 `Boolean(candidate.href)`（无锚点地址不可核验）；候选图谱引用恒有 href+identity，声明 `true`。

缺省 `true` 的理由：`assignKonlingCitationDisplayNumbers` 的直接调用点（测试、纯协议使用）没有 unverified 概念，表内分配即服务器信任；fail closed 的收紧点在 runtime 投影层显式声明，不需要所有调用点感知。

### D2: normalize 层对不可核验解析 fail closed

`normalizeKonlingCitations` 中 `resolved` 条目若 `verifiable === false`：删除标记、计入 `unresolvedMarkers`、不加入 `usedCitations`，由既有 verificationStatus/userNotice 机制降级（partial/unverified + 「部分引用未能核验」/「引用未能核验」）。与「未知标记」同路径处理，不新增状态机。

### D3: 剥离扩展到全部正式回答（去掉 studyQuestion 限制）

- `buildKonlingCitationGuard`：`collectUnverifiedCitationMarkers` 不再以 `studyIntent` 为前置条件。
- `stripUnverifiedKonlingCitationMarkers`：移除 `!guard.studyQuestion` 早退。

非学习问答主路径（chat route finalize）中 normalize 层（D2）已删除这些标记，strip 成为第二道防线；sessions 非流式路径（无 normalize）由此获得第一道防线。技术下标保护（`isCitationMarkerPosition` 的宽/窄读法）维持不变，`y[1]`、`values[2]` 不受影响。

### D4: 持久化与 UI 以测试锁定，不改投影结构

持久化 `konlingCitationGuard.citations` 已是 `KonlingAssignedCitation`（含 identity 的版本字段与 href/fragment 锚点）。本变更只补测试断言：有效引用持久化含 identity/版本/锚点；production 诊断置空与学生可见内容无内部 ID/路径由既有门禁以测试锁定。UI 越权/失效锚点 fail closed（`TextbookCitationLink` 的 version-bound 校验）已有实现，补最小断言。

## Risks / Trade-offs

- 数字碰撞占位符在模型恰好「瞎写对了」编号且条目可核验时仍会被采纳——这是编号引用协议的固有语义（prompt 只允许服务器编号），门禁解决的是「表内但不可核验」的子集，不引入语义级引用验证（超范围）。
- 非学习问答回答中真实存在但 unverified 的证据引用标记会被删除并显示部分核验提示——预期行为（fail closed 优先于展示完整性），盲审/评测若需区分以确定性 metadata 为准。
- sessions 非流式路径的 `[引用: X]`/内部 ID 文字标记仍不经 normalize（无 repair 调用点）——该路径无客户端调用方，作为残余风险记录，不扩大范围。

## Migration Plan

纯代码与测试变更，无 schema/迁移/数据回填。直接随 PR 交付。

## Open Questions

（无）
