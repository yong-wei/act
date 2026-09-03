## Context

`studyQuestionRequiredSections` 返回固定中文标题；`buildKonlingSystemPrompt` 只追加 `必须覆盖: 标题、标题`，随后仍要求回答控制在 150 字以内。仓库没有语义结构评分器。Issue 引用的 3.5%→28.5% 实验数字不在仓库内，但提示弱约束、字数冲突和按标题字符串计分的错位可在代码中直接核实。

## Goals / Non-Goals

**Goals**

- 六类意图都有互斥、可教学的章节合同。
- 提示词把章节写成强制输出合同；语义等价标题有效。
- 评分器可复现：有章节边界才算覆盖；无结构长文失败。
- 简洁/详细/表格/步骤/提示偏好仍覆盖全部章节。

**Non-Goals**

- 不更换模型供应商，不在 CI 中跑 720 次在线生成。
- 不把结构达标改成降低覆盖章节数。
- 不实现规范内容的独立 fail-closed 安全门禁。

## Decisions

1. **单一章节目录。** `src/lib/konling-study-question-structure.ts` 保存 intent → `{id,title,aliases}`。runtime 仍输出 canonical `requiredSections` 标题，UI 不变。
2. **提示词短合同。** 在 study-question 分支追加：分章标题、允许别名、不得省略、优先于字数上限。不复制长示例。
3. **确定性评分。** 从 Markdown 标题、加粗单行标题或短编号标题切块；标题规范化后与 canonical/alias 匹配；每章正文非空。行内堆砌全部标题的一段长文没有标题行，判定失败。
4. **在线实验数字用夹具门禁代替。** 每类至少一份语义等价合格答、一份无结构不合格答。合格夹具通过率 100%（高于 80% 门槛）；六类合格夹具均非空即满足“非零综合通过”。内容质量用“空章节失败”约束，不伪造实验内容分。

## Risks / Trade-offs

- [别名过宽把无结构文本判过] → 只匹配标题行，不匹配段落内部子串。
- [150 字限制仍压过合同] → study-question 明确优先于字数上限。
- [表格/提示偏好冲掉章节] → 评分仍要求全部章节标题；格式只检查不得替代覆盖。

## Migration Plan

1. 落地章节目录与评分器测试（含当前提示词缺口）。
2. 改 runtime 标题来源和 prompt 合同。
3. 跑聚焦 Konling/prompt 测试与 OpenSpec 校验。

## Open Questions

None.
