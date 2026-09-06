## 1. 协议与运行时

- [x] 1.1 `src/lib/konling-citation-protocol.ts`：`KonlingAssignableCitation` 增加可选 `verifiable?: boolean`；`assignKonlingCitationDisplayNumbers`/`createKonlingCitationAllocator` 将其固化为 `readonly verifiable: boolean`（缺省 `true`），冻结语义与现有字段一致。
- [x] 1.2 `src/lib/konling-agent-runtime.ts` `toAssignableRuntimeCitation`：`verifiable: citation.verified === true && Boolean(citation.citationTargetId)`。
- [x] 1.3 `src/lib/konling-agent-runtime.ts` 检索工具分配点：教材候选 `verifiable: Boolean(candidate.href)`；候选图谱引用 `verifiable: true`。

## 2. 归一化 fail closed

- [x] 2.1 `src/lib/konling-citation-repair.ts` `normalizeKonlingCitations`：解析成功但 `resolved.verifiable === false` 的标记按未核验处理（删除、计入 unresolvedMarkers、不进入 usedCitations、verificationStatus/userNotice 走既有降级）。
- [x] 2.2 确认 `normalizeAndRepairKonlingCitations` 的 repair 请求载荷不泄漏新增字段（repair 只收 displayNumber/sourceType/displayTitle，天然不含 verifiable/identity）。

## 3. 剥离扩展

- [x] 3.1 `src/lib/konling-agent-runtime.ts` `buildKonlingCitationGuard`：`collectUnverifiedCitationMarkers` 去掉 `!studyIntent` 前置。
- [x] 3.2 `stripUnverifiedKonlingCitationMarkers`：移除 `!guard.studyQuestion` 早退，保留空集快路径与技术下标保护。

## 4. 回归测试

- [x] 4.1 `konling-citation-protocol.test.ts`：有效引用（保留标记且持久化项含 identity 版本字段与锚点）、数字碰撞 unverified 条目（删除 + partial + notice）、教材候选无锚点（verifiable=false → 删除）、部分核验失败（partial + 「部分引用未能核验」）。
- [x] 4.2 guard 层测试：非 studyQuestion 场景下 `unverifiedCitationMarkers` 收集不可绑定编号，`stripUnverifiedKonlingCitationMarkers` 剥离且保留技术下标（`y[1]`、代码块内 `[1]`）。
- [x] 4.3 既有测试全量通过：`konling-citation-protocol`、`konling-answer-unit-citation-coverage-1902`、`konling-study-question-citation-coverage-1819`、chat/sessions 相关路由测试。

## 5. 验证与交付

- [x] 5.1 `rtk npm run test:unit`（相关套件）与 `rtk npm run typecheck` 零错误。
- [x] 5.2 完整 diff Local Review：实现不越出 change 范围，无未解释行为变化。
- [x] 5.3 `openspec validate issue-1949 --strict` 通过后与实现、主 specs 同步、archive 放入同一 PR 交付。
