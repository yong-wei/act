# Issue #1515 讲义覆盖决策包（课程负责人待决）

日期：2026-08-23。本文件把 G5/R6 相关的负责人决策问题成组列出，每项给出已核实数据、选项与执行影响。批注后作为 remediation 后续批次的裁决依据。

## 数据基础（已核实）

- Authority v0.22 active-domain scope：7300 成员，15 个域。
- 课程学生讲义：33 单元，约 42.8 万字符。
- 名称精确提及统计（成员 label 或 description ≥4 字符片段在讲义语料中出现）：**7300 成员仅 184（2.5%）被提及**；最高的 root-locus 域 15%，多数域 0–3%。
- 该统计是严格下界（用词差异导致漏报）。语义级实测参照：lyapunov 域 141 成员中仅约 10 个成员能从讲义建立有证据的三族关系（约 7%）。
- 结论：**7300 成员与 33 单元讲义是结构性规模错配**，不是局部缺口。

## D1 课程教学边界（根本决策，其余决策依赖它）

Authority 图谱是完整控制理论工程域；这门课的教学范围是它的哪个子集？

- **选项 A：讲义即课程**。以现有讲义覆盖为准；未覆盖成员走课程级排除。
  - 影响：三族闭合可较快达成，但 scope 需重新密封（排除成员 → 新 scope/新 allocation → 增量重跑），且每个排除需"教学大纲不涵盖"类证据。
- **选项 B：图谱即课程**。扩编讲义覆盖 7300 成员。
  - 影响：33 单元需扩至远超当前规模，工作量以月计；不建议。
- **选项 C：分层边界（推荐）**。本科主干域全量覆盖，拓展域显式不讲授。
  - 主干候选：root-locus、time-domain-analysis、frequency-domain-analysis、classical-control-design、system-modeling、stability-analysis、lyapunov-stability、discrete-time-control-analysis/design、state-space-control-analysis-and-design。
  - 拓展候选（裁决为课程不涵盖）：robust-control-analysis-and-design（702）、optimal-control-foundations-and-linear-quadratic-design（200）、nonlinear-system-analysis（347）、nonlinear-control-design（104，且该域源数据本身是无语义占位，见 G1）、robustness-sensitivity-analysis（209，可争议——灵敏度分析在本科有讲授）。
  - 影响：需要你逐域确认主干/拓展划分；主干域内未覆盖成员仍需 D3 补讲义或 D2 裁决。

## D2 未覆盖成员的裁决形式与证据标准

- spec 约束：NO_RELATION 与课程级排除都必须有证据，不得无证据裁决；缺证据 ≠ 无关系。
- 待决：接受什么形态的证据支撑"本课程不涵盖"？
  - 候选：培养方案/教学大纲条目引用（`syllabus:<条目>`）；课程所有者签发的域级排除决定（一次裁决覆盖整域成员，逐域一条而非逐成员 21900 条）。
- 建议采用**域级排除决定**（每拓展域一条、附大纲证据），避免逐成员裁决的不可行工作量。

## D3 主干域讲义补写的范围、深度与顺序（若 D1 选 C）

- 深度待决：每个未覆盖成员最少需要"一段可取证的讲义正文"（定义/推导/应用任一即可作为三族证据锚点），还是完整教学展开？
  - 建议最低标准：一段 ≥2 句、含概念名与至少一个教学关系（定义依赖/推导顺序/应用场景）的正文。
- 顺序建议（按缺口与课程价值）：
  1. **root-locus（103 成员，提及 15%）**：质量最好、规模最小，建议作为首个完成三族闭合的样板域，验证全流程。
  2. **lyapunov-stability（141，5%）**：稳定性是本科核心；当前讲义缺李雅普诺夫函数/直接法/矩阵方程正文。
  3. **time-domain-analysis（572，8%）** 与 **frequency-domain-analysis（952，3%）**。
  4. **classical-control-design（744，2%）**、**state-space-control-analysis-and-design（1282，1%）**。
- 待决：是否接受此顺序；state-space 1282 成员是否降级为部分覆盖（仅核心成员）。

## D4 教师版讲义定版（R6）

- authoring 下有 33 学生版 + 27 教师版 handout md。教师版是否属于后继 release 的教学资源分母？
  - 候选：仅学生版进分母（推荐——学生可见的教学面）；教师版作为私有教学参考不入正式分母。

## D5 课程侧 Canonical 节点扩充（G6 联动）

- 课程侧 canonical-nodes.json 仅 220 节点（与 7300 成员精确匹配 71）。补讲义时是否同步建立课程侧节点，使关系证据能落到课程身份而非仅 `src:讲义#标题` 引用？
  - 建议：是——每补一个成员的讲义正文，同步登记一个课程节点（owner_lesson 指向所在单元）。

## D6 执行节奏

- 建议先完成 root-locus 样板域全流程（补齐剩余 88 个未覆盖成员的讲义正文或裁决 → 全域 309 行三族裁决 → 正式决策应用 → 闭合收据），验证流程后再按 D3 顺序推进其余域。
- Fun-ASR-Nano 下载完成后，ASR 资格链路（identity 冻结 → hotword 校准/预注册 → holdout）可与讲义补写并行。

## 负责人批注区

（在各项下方直接批注：选 A/B/C；域划分确认；证据标准确认；顺序调整；教师版定版；节点扩充是/否。）
