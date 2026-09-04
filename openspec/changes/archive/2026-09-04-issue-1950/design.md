## Context

`src/lib/konling-study-question-structure.ts` 是知识问答结构评分的唯一真源：

- `normalizeHeading`（L91）做小写、NFKC、移除 `[\s:：#*【】\[\]()（）.-]`；emoji（Unicode Extended_Pictographic）不在移除集合。
- `headingMatchesSection`（L95）要求规范化标题 `===` canonical/alias 或以其 `startsWith`。`🔍 故障定位` 规范化为 `🔍故障定位`，两者皆不满足 → 假阴性。
- 口径分支只有 `structure-strict-title.v0` 与默认 alias（v1）；`detectStudyQuestionSectionHeading` 无口径参数，被产品 `konling-agent-runtime.scanKonlingAnswerUnits`（#1902 答案单元章节归属）复用。
- 实验链路按 `scores/<caliber>/<scorerRevision>/<arm>/` 命名空间隔离评分记录；`replayKonlingFairExperimentScoring`（aggregate.ts L403）对冻结回答重评分并在 `calibers.length >= 2` 时以第一个口径为 reference 产出 `caliber:v1->v2` 配对差值——差值机制已存在，无需改动。
- fair-live-20260904-r1 的回答快照目录被 `.gitignore`（L86）排除且本地运行目录已清理，无法对原始文件回放。

## Goals / Non-Goals

**Goals:**

- v2 口径下，`### 🔍 故障定位`、`### 🧠 原因分析`、`### 🛠️ 最小修复`、`### ✅ 验证方法` 命中 code-debugging 的四个必需章节。
- 装饰归一化有限、确定、只作用于标题前缀；正文提及关键词、语义不符标题、缺章节的负例仍失败。
- v1 冻结原行为，回放报告单独呈现 v1→v2 评分口径差值，不重跑生成模型。
- 产品路径（结构评分默认口径与答案单元章节归属）同步修复。

**Non-Goals:**

- 不要求产品回答继续使用 emoji；不放宽任何意图的必需章节集合。
- 不重跑 fair-live-20260904-r1 生成侧；不重建已清理的原始快照。
- 不为 `structure-strict-title.v0` 增加装饰归一化（它是历史对照口径，冻结）。

## Decisions

**D1：新增 `structure-alias.v2` 口径，v1 冻结，默认口径切 v2（而非直接修改 v1）。**
直接改 v1 会让已以 v1 名义发布的 fair-live 报告口径标识失真，且验收 5 要求的「评分口径差值」失去对照基线。v1 冻结为回放基线与 #1900 回放机制的设计初衷一致（口径升级不重跑生成、差值可追溯）。

**D2：装饰剥离只作用于标题前缀，采用循环 token 剥离而非扩大 `normalizeHeading` 的全局移除字符集。**
全局移除 emoji 等字符会把标题中部/尾部的装饰也删掉，扩大误匹配面；前缀剥离保持「归一化只处理标题引导装饰」的语义。剥离 token 集确定性枚举：

1. emoji 块：`[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]+`（覆盖 VS16、ZWJ 复合、keycap）；
2. 编号 token：`\d{1,3}[.、)．:：]`、`[一二三四五六七八九十]{1,3}[.、)．:：]`、`[(（]\d{1,3}[)）]`、`[(（][一二三四五六七八九十]{1,3}[)）]`；
3. 装饰标点块：`[*#>|·~—–-]+`；
4. 空白。

循环应用于标题前导直到无法剥离。每次匹配至少消费一个字符，无死循环风险。剥离后进入既有 `normalizeHeading` 与 `===`/`startsWith` 匹配，匹配语义不变。无装饰标题剥离为幂等（v1/v2 输出一致）。

**D3：口径经函数参数下传，内部函数接收 normalizer 而非全局分支。**
`evaluateStudyQuestionStructure`、`detectStudyQuestionSectionHeading` 增加可选 `caliber` 参数（默认 v2）；内部 `headingMatchesSection`/`headingEqualsSection`/`readHeading` 接收按口径选择的 `normalize` 函数。strict-title.v0 继续走既有严格相等分支。`readHeading` 的 numbered 分支要求候选与 canonical/alias 严格相等才认标题（防误判），该比较同样按口径归一化。

**D4：固定回放以冻结回答文本在测试运行目录上执行。**
原始 fair-live 快照不可得。测试以 issue 所列四个装饰标题形态构造两条 code-debugging 冻结回答（正文非空、盲审通过形态），经 `replayKonlingFairExperimentScoring` 以 `[v1, v2]` 回放，断言 v1 fail、v2 pass、`caliberDeltas` 含 `caliber:structure-alias.v1->structure-alias.v2`。fixture 生成的标题无装饰，run-fixture/run-live 主口径切 v2 后端到端输出不变。

**备选方案（拒绝）：** 在 prompt 侧禁止模型输出 emoji 标题——治标不治本，模型输出不可强制，且历史冻结回答无法重生成；全局字符集移除——见 D2 拒绝理由。

## Risks / Trade-offs

- [编号剥离误伤以数字开头的真实标题（如 `2023 规范结论`）] → 编号 token 要求后跟终止符（`.``、``)``：`），`2023 规范结论` 的 `2023` 后是空格不是终止符，不剥离；单测锁定。
- [装饰剥离后标题为空（如 `### 🔍`）误判] → 既有空串保护（`normalized` 为空返回 false）不变。
- [v1/v2 输出不一致破坏既有测试] → 无装饰输入下剥离幂等，v1/v2 输出恒等；既有 1900 端到端测试（fixture 无装饰标题）不因主口径切换改变结果。
- [默认口径切换改变产品评分行为] → 这正是修复目标（假阴性消除）；无装饰回答输出不变，带装饰回答从 fail 变 pass，方向与 issue 一致；以回归测试锁定两类输入的输出。
