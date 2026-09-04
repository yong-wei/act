## Why

fair-live-20260904-r1 实验完整功能组结构通过率为 `10/12 = 83.3%`，两条失败均来自代码调试题：回答使用了 `### 🔍 故障定位`、`### 🧠 原因分析`、`### 🛠️ 最小修复`、`### ✅ 验证方法` 这类合法章节标题，但 `structure-alias.v1` 的 `normalizeHeading` 只移除空白与少量标点，不在匹配前剥离 emoji／图标等装饰前缀，把内容完整（独立盲审通过、评分 0.95）的回答误判为缺少 `locate`/`cause`/`fix`/`verify`，形成结构评分假阴性，错误压低完整功能组综合通过率（Issue #1950）。

同一根因也影响产品路径：`detectStudyQuestionSectionHeading` 被 `konling-agent-runtime.scanKonlingAnswerUnits` 复用做答案单元章节归属（#1902 覆盖计算），带装饰前缀的标题同样无法归属章节。

## What Changes

- 评分口径新增 `structure-alias.v2`：在既有归一化（小写、NFKC、移除空白与既有标点集）之前，对标题文本做**有限、确定性**的前导装饰剥离——emoji 块（含 VS16/ZWJ/keycap 组合）、编号 token（`1.`、`1、`、`1)`、`（一）`、`一、` 等）、装饰标点块（`*#>|·~—–-` 等）与空白。剥离只作用于标题前缀，不改变「标题必须匹配 canonical 或 alias（含前缀匹配）且正文非空」的既有匹配语义。
- `structure-alias.v1` 冻结原行为，仅供回放差值基线；产品默认口径（`evaluateStudyQuestionStructure` 与 `detectStudyQuestionSectionHeading` 不显式传参时）升级为 v2。
- `replay-scoring.ts` 默认口径串改为 `structure-alias.v1,structure-alias.v2`，回放报告的 `caliberDeltas` 单独呈现 v1→v2 评分口径差值；不重跑生成模型。
- `run-fixture.ts` / `run-live.ts` 实验主口径切换为 v2（fixture 标题无装饰，输出不变）。
- 负例保持失败：缺少真实章节、只在正文提及关键词、标题语义不符（含装饰剥离后仍不匹配）的回答仍不通过；纯装饰空标题归一化后为空串不匹配。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `konling-study-question-structure-contract`: 「接受语义标题、拒绝无结构长文」的确定性评分 requirement 扩展：v2 口径在匹配前对标题做有限装饰前缀归一化，emoji／编号／标点装饰的语义等价标题命中；归一化不得把正文关键词或语义不符标题误判为必需结构。评分口径形成版本化家族（v1 冻结、v2 当前）。
- `konling-fair-baseline-replay-evaluation`: 「Default caliber is unchanged」场景更新为「产品默认口径是 structure-alias 家族的当前版本（v2）」；口径回放 requirement 扩展 v2 场景与 v1→v2 差值呈现。

### Removed Capabilities

（无）

## Impact

- 代码：`src/lib/konling-study-question-structure.ts`（口径注册、装饰剥离、口径化匹配）、`src/lib/konling-fair-experiment/`（无需结构改动，口径经既有 `calibers` 参数流动）、`scripts/konling-fair-experiment/replay-scoring.ts`（默认口径串）、`scripts/konling-fair-experiment/run-fixture.ts`、`scripts/konling-fair-experiment/run-live.ts`（主口径切 v2）；`src/lib/konling-agent-runtime.ts` 仅经由 `detectStudyQuestionSectionHeading` 默认口径间接受益，不直接改动。
- 测试：`src/lib/__tests__/konling-study-question-structure*.test.ts`（装饰正例／负例／v1 冻结回归）、`src/lib/__tests__/konling-fair-experiment-1900.test.ts`（默认口径断言更新、固定回放差值）、`src/lib/__tests__/konling-fair-experiment-entrypoints-smoke-1947.test.ts`（回放默认口径串断言更新）。
- 行为变化：带装饰前缀标题的完整回答在产品结构评分与答案单元章节归属中不再假阴性；无装饰标题的评分结果与 v1 完全一致（归一化只增不减，无装饰时为幂等）。
- 验收映射（Issue #1950）：验收 1/2/4 由装饰剥离实现与单测覆盖；验收 3 落在 v2——Issue 正文的 `structure-alias.v1` 指评分器家族当时的标识，若 v1 行为也改，验收 5 的「评分口径差值」失去对照基线，且已以 v1 名义发布的 fair-live 报告口径标识会失真（原 fair-live 回答快照被 gitignore 且运行目录已清理，固定回放以 issue 所列四标题形态构造的冻结回答文本在测试运行目录上执行）；验收 5 由 v1 冻结 + v2 回放差值满足。
- 非目标（Issue #1950）：不要求产品回答继续使用 emoji；不放宽代码调试意图的必需章节集合；不重跑 fair-live-20260904-r1 的生成侧。
