# Issue #1515 资源（Resource Corpus）侧问题清单

状态：2026-08-23 整理，供后续审核与整改。所有条目均来自本次修复执行的已核实观察。

## R1 三族关系候选 0 项可自动准入（阻断级，与 G5 联动）

- 真实 pending.jsonl 21900 行全部 `PENDING_REVIEW`：containment 的 reason 为 `no-explicit-parent-or-root-evidence`（7300），prerequisite/association 为 `awaiting-qualified-item-evidence`（各 7300）。
- 管线实测：0 行通过 qualified-evidence 门禁；全部进入 15 个域 review packs。
- 整改方向：为 containment 建立"域根 → COURSE_ROOT"的结构性证据源（域包 scope/domain 数据），为 prereq/assoc 建立讲义派生的 qualified evidence registry；否则全部依赖逐行课程所有者裁决。

## R2 后继分母尚未从活动 OSS Runtime Release 正式推导

- 本次执行用 authoring 发现清单（869 文本资源）做处理器验证；正式分母必须从生产活动 OSS Runtime Release v2 的 manifest + 显式增量推导（设计决策 2）。
- 教学资源已迁移 OSS：本地 `course-content/runtime` 是物化视图，不是生产真源。
- 整改方向：实现活动 release manifest 读取与逻辑资源分类重开（任务 1.4 的正式版）。

## R3 教材语料分布在工作树间不一致

- 主工作树 `resources/textbooks/` 6 本（其中 dorf 等经 `.git/info/exclude` 本地排除）；act-resource 工作树仅 2 本（hu-shousong 8th 400K 锚点 + exercise-analysis 89M）。
- 影响：textbook processor（任务族 5.1/5.2）在隔离工作树无法访问全量结构化 v2 语料。
- 整改方向：正式执行批次在主工作树运行，或将结构化锚点清单纳入受管 external-input 清单。

## R4 卡片身份与 Authority 身份两套体系

- 838 张卡片 frontmatter `node_id` 为课程侧中文 id（如 `Bode图_1_1`）；scope 成员为 Authority `ctc:/ctkg:` id。
- 本次 card processor 产出原子的 canonicalKey 用课程侧 id；正式 Canonical 映射（任务 7.1）需要经 crosswalk tier-A（仅 71 精确匹配）或扩课程侧节点（见 G6）。

## R5 Fun-ASR-Nano 未就绪（外部依赖）

- LM Studio 已运行（其他模型在跑），但 Fun-ASR-Nano 模型文件未下载到位、API 无该模型。
- 影响：任务族 4 全部（identity 冻结、hotword 校准/预注册、holdout 资格、ASR 媒体处理）阻塞；无权威讲稿的课程视频/音频/播客 0 处理。
- 注意：intro-video 不依赖 ASR（制作真源），但 Videos importer（任务族 3）尚未实现。

## R6 讲义资源形态待正式定版

- authoring 下 60 个 handout md（33 学生版 + 27 教师版）；denominator 语义下两者是否都算教学资源、教师版是否进后继 release 需课程所有者定版。
- 现有 31 个学生讲义已真实处理（11056 原子中含讲义与卡片）。

## R7 习题与仿真/互动资源处理未开始

- 576 个 governed 习题项的清单位置、registry 与 runtime manifest 的 launcher 真源需先盘点（任务族 6 实现前置）。
- 仿真/互动资源（registry id、版本化配置、launch anchor）同样待盘点。

## 已完成可复用资产（避免重复劳动）

- 文本处理器真实执行通过：869 资源（31 讲义 + 838 卡片）→ 11056 语义原子，处理记录与摘要已落盘（/tmp/remediation-run/text/，正式批次需转存 Git 工件目录）。
- crosswalk-full.json（7300 成员名称）已构建；15 个域 review packs 已生成。
- use-codex 审核证据两批（root-locus 30 裁决；lyapunov 11 accept + nonlinear 全 insufficient）。
