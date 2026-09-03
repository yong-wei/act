## Context

`scanKonlingAnswerUnits`（`src/lib/konling-agent-runtime.ts`）按行扫描学习问答回答：markdown 标题命中 `STUDY_QUESTION_SECTIONS[intent]` 时切换章节，代码块与围栏行跳过，`[n]` marker 在非技术下标位置且对应 `verified && citationTargetId` 的引用时产生绑定。覆盖统计把 evidence-required 章节内全部非空行作为分母。prompt 侧 `ai-prompt-builder.ts` 已有「逐单元引用映射」指令与 6 个可绑定编号。

主实验精确率达标而覆盖率 35.1%，说明 marker→citation 通路健康，问题集中在「哪些行算需证据单元」的分母定义与模型引用行为的供给提示。

## Goals

- 覆盖率分母只包含 substantive 需证据单元，与 spec 的「substantive answer unit」语义一致。
- 每个未绑定需证据单元都有可分类的缺失原因。
- 漂移与重复堆叠进入 guard 诊断，不改变绑定布尔语义。
- prompt 给模型完整的可绑定编号供给与复用规则。
- 六个意图的冻结回归：分类、覆盖计算、原因归类全部可单测。

## Non-Goals

- 不重写扫描器为句法分析器；行级扫描保持。
- 不新增评测端点或聚合管道；guard 数据面即报告数据面。
- 不调整严格综合通过条件与意图分类。
- 不在本 change 内完成真实模型主实验复测。

## Decisions

1. **Substantive 判定用保守的结构性排除规则，不用「像结论」的包含规则。** 默认每一行都是 substantive；只有明确匹配结构性模式才排除：
   - 引导头：去 markdown 前缀后以 `：` 或 `:` 结尾。
   - 短过渡：无终止标点（`。；;！!？?`）且修剪后长度 ≤ 20 字符。
   - 纯数学展示行：整行无 CJK 字符且为数学环境（`$$...$$`、`\[...\]`、`\begin{...}` 行）或 LaTeX 公式行。
   - 分隔线（`---`、`***`、`___`）。
   宁可分母略大，也不把真实结论行错误排除；规则全部可冻结回归。

2. **缺失原因按行内证据链判定，取首个可确定原因。** 行内无可信 marker → `no-marker`；有 marker 但编号无对应 citation → `marker-unassigned`；citation `verified !== true` → `citation-unverified`；缺 `citationTargetId` → `citation-no-target`。以 `missingReasons: Array<{ reason, count }>` 附加在 `answerUnitCoverage`，与既有 `ratio`、`sections` 同层。

3. **漂移与重复只做诊断，不改变覆盖语义。** 有效 marker 出现在 model-derived 章节或无章节区域记入 `answer-citation-drift` 诊断计数；同一行同编号重复 ≥ 2 次记入 `answer-citation-duplicate`。单元 `bound` 保持布尔，重复堆叠天然不虚增覆盖率（既有绑定去重语义不变）。

4. **Prompt 增强只做供给与规则说明，不重写输出合同。** 可绑定编号从 `slice(0, 6)` 扩为全量（verified + citationTargetId 过滤保持）；追加「同一编号可复用于多个结论单元」与「无可用证据的结论必须改述为待核验/证据缺口，不得省略引用或虚构编号」。输出合同、章节结构与其他指令不变。

5. **`KonlingAnswerUnitRecord` 增加 `substantive` 字段而不是丢弃结构行。** units 全集保留（消费方可见结构行），requiredUnits 只取 substantive 行；向后兼容，API 序列化不破坏。

## Rejected Alternatives

- **按句号切分句子级单元**：中文技术回答大量使用公式与列表，句号切分会把 LaTeX 行拆碎且与行级 marker 位置错位。
- **LLM 二次判定每行需证据性**：引入额外模型调用、不可冻结回归且时延不可接受。
- **仅靠 prompt 提升覆盖率**：分母定义不修，任何模型行为改进都会被过渡行稀释，且无法解释 35.1% 的构成。
- **在评测侧重算覆盖**：评测与线上 guard 口径会分叉，正是本 change 要消除的。

## Verification Strategy

- 单测（vitest，`src/lib/__tests__/`）：六个意图各一个冻结回归——合成「典型模型输出」（引导头 + 过渡行 + 公式行 + 结论行 + 部分 `[n]`）断言 substantive 分类、requiredUnits、ratio 与 missingReasons；全结论行带 `[n]` 的输出断言 ratio = 1；重复堆叠与漂移断言诊断输出且覆盖不虚增；`marker-unassigned` / `citation-unverified` / `citation-no-target` 三类原因各有触发用例。
- prompt 契约测试：可绑定编号全量暴露与复用/缺口说明存在。
- 既有 `konling-study-question-citation-coverage-1819.test.ts`、`konling-agent-runtime.test.ts` 相关用例保持通过（invalid strip、降级、fail-closed 不回归）。
- `npm run typecheck`、`openspec validate --strict`、`git diff --check`。
- 真实模型 85% 覆盖率门槛：留给后续主实验复测，PR 验证记录中如实标注。
