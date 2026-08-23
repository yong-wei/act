# Issue #1515 讲义覆盖决策包（课程负责人待决）

日期：2026-08-23。本文件把 G5/R6 相关的负责人决策问题成组列出，每项给出已核实数据、选项与执行影响。批注后作为 remediation 后续批次的裁决依据。

## 负责人裁决记录（2026-08-23，D1 已决）

课程负责人对 D1 作出如下裁决（原文摘录）：

> 最优控制和 robust 控制、LQR、李雅普诺夫等不在本科课程范围。图谱仅仅为了基础控制理论体系完备，不要求讲义对齐全覆盖。建议只要覆盖你提到的经典领域即可，甚至离散控制现在也排除在大纲外了。

由此确定的定位与域级分类：

- **图谱定位**：Authority 图谱仅为基础控制理论体系完备性参考，**不要求讲义对齐其全量成员**。
- **课程范围**：经典控制领域；离散控制已移出教学大纲。

### 域级分类（依裁决）

| 分类 | 域 | 成员数 | 依据 |
|---|---|---|---|
| **课程涵盖（主干）** | root-locus | 103 | 经典领域；讲义覆盖最高（27.2%） |
| | time-domain-analysis | 572 | 经典领域 |
| | frequency-domain-analysis | 952 | 经典领域 |
| | classical-control-design | 744 | 经典领域 |
| | system-modeling | 641 | 经典领域 |
| | stability-analysis | 243 | 经典领域 |
| | nonlinear-system-analysis | 347 | 讲义 5-1/5-2 单元明确覆盖非线性边界入门（局部线性化、相平面、描述函数）；负责人未排除 |
| **课程不涵盖（排除）** | optimal-control-foundations-and-linear-quadratic-design | 200 | 负责人点名：最优控制/LQR 不在本科范围 |
| | robust-control-analysis-and-design | 702 | 负责人点名：robust 控制不在本科范围 |
| | lyapunov-stability | 141 | 负责人点名：李雅普诺夫不在本科范围 |
| | discrete-time-control-analysis | 619 | 负责人裁决：离散控制已移出大纲 |
| | discrete-time-control-design | 441 | 同上 |
| | nonlinear-control-design | 104 | 兼具模式 D（Authority 无语义占位，G1）与非线性的进阶定位；按排除处理（数据缺口使其无法审核） |
| **待负责人确认** | state-space-control-analysis-and-design | 1282 | "经典领域"若按 classical control 严格口径不含状态空间（现代控制理论）；请确认 |
| | robustness-sensitivity-analysis | 209 | 灵敏度在时域讲义有正文（提及 10%）；请确认归主干还是排除 |

排除合计（含待确认两域的最小/最大口径）：2207–3698 成员。

### 未覆盖成员的四种模式诊断（供复盘）

主干域内"未覆盖"不等于教学缺口，其构成分四种模式（详细样本见 `uncovered-concepts-by-domain.md`）：

- **模式 A：教材例题级细粒度条目**（多数大域未覆盖的主体）。样本特征："Figure 7.47 shows…"、"Example 11.8"、"例9-21变换后矩阵"、"示例系统××传递函数"、"Combined equations for t3"。Authority 的条目粒度到达教材例题/图注/推导中间步骤层（含英文残留），讲义只承载教学主线概念。结合"不要求讲义对齐全覆盖"的裁决，此类成员按"教材支撑材料"处置，不构成讲义修订需求。
- **模式 B：完整理论块缺失**。lyapunov（直接法体系）、optimal/LQR、robust——已由负责人域级裁决为课程不涵盖。
- **模式 C：域内超纲工程概念**。如 root-locus 中的"废气传感器""集总参数电路""齐格勒-尼科尔斯 PID 整定"。与正当教学缺口（"虚轴穿越""两步参数设计法"）混在主干域内，需条目级裁决。
- **模式 D：无语义数据占位**。nonlinear-control-design 全域——上游 ActKG 数据缺口（G1），与讲义无关。

对三族闭合的含义：主干域内未覆盖成员的处置路径 = 模式 A 批量规则（条目粒度准入）+ 模式 C 逐条/小批裁决；剩余真正需要讲义补写的只有模式 C 中的正当教学缺口部分。

## 数据基础（已核实，2026-08-23 修正版）

初版"精确提及 2.5%"统计有方法缺陷（display_name 多为英数 slug、description 按整段精确匹配），已废弃。修正后采用两层度量：

- 层1（高置信）：中文 display_name 或 zh-CN preferred 标签作为子串命中讲义。
- 层2（中置信）：description 首子句的 ≥6 字符中文片段命中讲义。

修正结果（7300 成员 / 33 单元学生讲义 42.8 万字符）：

| 域 | 成员 | 层1 | 层2 | 合计% |
|---|---|---|---|---|
| root-locus | 103 | 21 | 7 | 27.2% |
| time-domain-analysis | 572 | 55 | 53 | 18.9% |
| nonlinear-system-analysis | 347 | 18 | 31 | 14.1% |
| robustness-sensitivity-analysis | 209 | 17 | 4 | 10.0% |
| frequency-domain-analysis | 952 | 34 | 60 | 9.9% |
| stability-analysis | 243 | 6 | 13 | 7.8% |
| classical-control-design | 744 | 18 | 37 | 7.4% |
| system-modeling | 641 | 19 | 19 | 5.9% |
| discrete-time-control-analysis | 619 | 7 | 24 | 5.0% |
| lyapunov-stability | 141 | 7 | 0 | 5.0% |
| state-space-control-analysis-and-design | 1282 | 8 | 38 | 3.6% |
| discrete-time-control-design | 441 | 12 | 0 | 2.7% |
| robust-control-analysis-and-design | 702 | 4 | 0 | 0.6% |
| optimal-control-foundations-and-linear-quadratic-design | 200 | 0 | 0 | 0.0% |
| nonlinear-control-design | 104 | 0 | 0 | 0.0% |
| **合计** | **7300** | **226** | **286** | **7.0%** |

残余 0%/极低域的核实解释：

- **optimal-control（0%）**：讲义全语料仅 1 处泛提"最优控制"，LQR/线性二次为 0；5-x 单元主线是非线性边界/MASS/MPC/强化学习，**课程确实没有最优控制教学单元**——这是真实的课程内容边界。
- **nonlinear-control-design（0%）**：该域 Authority 源数据本身是无语义占位（见 G1：M1S 哈希名、描述为空），统计与审核都无法进行——是数据缺口，不是讲义缺口。
- **robust-control（0.6%）**："鲁棒"散点出现 13 次、"灵敏度"7 次，但 H∞/μ综合为 0——有概念引入、无系统讲授。

结构性结论（不变）：讲义自然覆盖在 3%–27% 区间，与 7300 成员仍为量级错配；"图谱即课程"不可行，D1 边界决策仍然必要。

## D1 课程教学边界（✅ 已决，2026-08-23——见顶部"负责人裁决记录"）

已裁决：图谱仅为体系完备参考、不要求讲义对齐；课程范围=经典领域（含建模/时域/频域/根轨迹/经典设计/稳定性/非线性分析入门）；最优、robust、LQR、李雅普诺夫、离散控制均在课程范围外。残余待确认：state-space 与 robustness-sensitivity 两域归属。以下原文保留供复盘。

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
