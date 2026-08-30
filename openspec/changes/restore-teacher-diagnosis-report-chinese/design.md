# Design: Restore Simplified Chinese teacher diagnosis report content

## Context

- 校验面：reportBody 中由模型生成的自然语言字段为 `summary`、`findings[].title`、`findings[].summary`、`limitations[]`；`suggestions` 不在 reportBody（交付层从 findings 确定性投影，模板已是中文）；投影标题、证据来源标签、置信度/风险等级标签均为服务端中文模板，无需处理。
- 既有失败语义（`diagnosis-generation-worker.ts`）：`DiagnosisGenerationProviderEmptyOutputError` 等"模型行为缺陷"→ `validation: false`，自动重试至 3 次；`DiagnosisGenerationValidationError` / schema 校验失败 → 不可重试。任务失败后教师可在报告历史用显式重试入口重新发起（保留原身份）。
- "Fixed governed report" 由 `c66a47cbc` 引入后从未是中文；Issue 所述"恢复原有中文文案"在本组件历史中不存在中文原文，属新设文案。

## Decision

1. **语言校验作为独立的模型行为缺陷分类，而不是证据契约违例。** 新增 `DiagnosisGenerationProviderLanguageError`，在 worker 失败分类中归入 `validation: false`（同空输出先例），错误码 `diagnosis-provider-language-mismatch`，在既有 3 次尝试预算内自动重试；耗尽后任务 FAILED，教师看到明确中文失败信息并可显式重试。理由：语言回归与"返回不可用内容"同类，重试有机会自愈；而把它归为不可重试的 validation 会让教师必须手动多次操作，收益更低。
2. **确定性校验规则（不调用模型判语言）**：每个自然语言字段必须 (a) 至少包含一个中文字符；(b) 中文字符数 ≥ 拉丁字母数。规则允许正文内嵌英文技术词（如 "Risk Flags"），拒绝英文主导段落与 limitation 技术码直出。阈值类规则只在两端极端（全中文 / 全英文）需要精确，中段用"中文不少于英文"这一可解释判据。
3. **Prompt 与校验双保险**：system prompt 增加简体中文输出要求（含技术值豁免说明），校验仍独立存在——prompt 约束是软性偏好，校验才是契约。
4. **眉题文案**：`Fixed governed report` → `固定治理报告`。与 OpenSpec/代码库既有"治理"术语一致，保持小字眉题排版不变。

## Alternatives considered

- 语言失败归为不可重试 validation：教师需手动重试，与空输出先例不一致，放弃。
- 用模型二次调用判语言：引入额外成本与非确定性，放弃。
- 只改 prompt 不加校验：契约仍无守门，回归会再次发生，违背 Issue 验收条件，放弃。
- 交付层对英文字段做运行时翻译：掩盖数据层缺陷，违反"英文结果不得保存"要求，放弃。

## Risks / trade-offs

- 中英混排极端样本可能被误拒或误放：规则对全中文（历史报告形态）与全英文（回归形态）判定精确；混排样本以"中文占比不低于英文"为准，宁拒勿放。
- 已持久化的历史报告不受影响（校验只作用于新生成路径）；历史报告本就为中文。
- 生产不存在英文报告（2026-08-29 核实），"重新生成后呈现完整中文"的验收以新报告生成路径 + 测试覆盖替代验证。

## Migration Plan

单 PR 内完成 prompt、校验、失败分类、文案与测试；无数据迁移、无 schema 变更、无配置变更。

## Open Questions

无。
