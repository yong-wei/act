## Why

在 `origin/integration` 修订 `4371d14093` 上的 720 次生成实验显示，尽管 #1816 与 #1818 已合并，规范问答安全闭环仍未形成：

- 规范状态判定准确率仅 15.0%；
- 缺少可核验权威来源的规范题中，基线组不安全确定性断言率 80.0%；
- 功能组（含 #1818 门禁）不安全确定性断言率仍为 66.7%。

仓库内复核确认两个根因：

1. **生成侧闭环缺失**。`verification-required` 的唯一执行机制是系统提示中的一行指令；最终回答的确定性后处理（`stripUnverifiedKonlingCitationMarkers` / `applyKonlingCitationFallback`）只处理引用标记，不检查规范断言。模型不遵守提示时，"官方必须、规范要求"类确定性结论原样送达学生。契约层在冻结 120 例上状态判定为 100%，因此实验的 15% 是回答层指标——门禁在生成段断裂。
2. **独立风险检测词表弱于意图分类器**。`hasIndependentNormativeRisk` 不含「国家标准、行业标准、标准格式、规范格式、规范书写、国标格式」等意图分类器的规范关键词。凡 `classifyKonlingAnswerIntent` 不走 generic 分类器的模式（如 `resource-coach` 回退 `fact-explanation`），标准问法完全绕过独立门禁，违反 #1818 spec「即使主意图误分类也必须触发降级」。

## What Changes

- 统一规范风险词表：独立检测器至少覆盖意图分类器的规范关键词，任何模式的回退意图都不能绕过 `verification-required`。
- 在引用守卫中增加回答层规范合规扫描：`verification-required` 状态下检测未加限的权威/义务断言、无权威背书的标准编号和权威链接。
- 新增确定性降级函数 `applyKonlingNormativeSafetyDegradation`：非合规回答在最终交付前整体替换为服务端降级模板（证据缺口、可回答边界、核验建议）；合规回答原样通过。
- 接入两条交付路径：流式 chat 路由的 finalize 后处理与会话消息路由的 guard 后处理。
- 系统提示补充「不合规回答将被系统整体替换」，提高首过合规率、减少用户可见替换。
- 新冻结规范回归集（标准问法、隐式问法、多意图问法、标准编号、义务词与负例）与状态混淆矩阵、降级后不安全断言率的确定性测试门禁。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `konling-agent-runtime`: 规范安全门禁从「提示约束」升级为「提示 + 最终回答确定性降级」双层执行；独立检测词表与主分类器规范词面对齐；守卫元数据暴露规范合规状态。
- `konling-study-question-intent-classification`: 新增冻结规范状态回归集及其准确率/召回率门禁。

## Impact

- `src/lib/konling-agent-runtime.ts`：独立风险检测词表、引用守卫 `normativeCompliance`、降级函数。
- `src/lib/ai-prompt-builder.ts`：`verification-required` 提示行补充替换告知。
- `src/app/api/ai/chat/route.ts`、`src/app/api/ai/sessions/[id]/messages/route.ts`：接入降级后处理与元数据。
- `src/lib/konling-normative-status-cases.json`（新增冻结回归集）与 `src/lib/__tests__/konling-normative-runtime-safety-1901.test.ts`（新增测试）。
- 不改模型供应商、检索服务、数据表与既有 120 例意图回归集；不改 `verified` 判定来源（仍仅限服务端 official-reference 高置信引用）。

## Non-Goals

- 不重构全部意图分类规则（#1903 范围）。
- 不补全答案单元引用覆盖（#1902 范围）。
- 不引入外部法规数据库或新的权威来源解析器。
- 不对非规范类回答增加新的降级路径。
