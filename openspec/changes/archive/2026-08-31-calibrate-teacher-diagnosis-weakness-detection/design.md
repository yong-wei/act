## Context

诊断生成链路（`generateGovernedDiagnosisReport`）把冻结的受治理证据（assignmentSubmissions、assessmentSessions、riskFlags、competencySnapshots、knowledgeProgress）交给结构化 provider，产出 `teacher-diagnosis-report-body.v1`。实验（Issue #1728）证明该契约对过度诊断没有稳定约束：误报多于漏报，弱点集合完全匹配率仅 54.17%。

关键数据事实：`KnowledgeProgress.progress` 为 0–100、`status` ∈ {NOT_STARTED, IN_PROGRESS, COMPLETED}、每学生每节点至多一行；assignment 与 assessment 证据是整次分数，没有知识节点粒度映射。因此"知识点薄弱"唯一可确定性锚定的证据是进度行本身；"学完但测评差"的归因属于模型推断，无法确定性验证。

## Goals / Non-Goals

**Goals:**

- 知识点薄弱判定获得确定性精确率下界：不满足最小绝对弱势证据的节点判定在生成时即被拒绝。
- 健康场景知识节点级假阳性率结构性归零（无弱势节点时知识点 findings 必须为空）。
- "相对最低但正常"的节点不得被自动判为薄弱。
- 证据缺失或冲突时降低结论强度并显式说明限制。
- 保持真实弱点的召回通道：整体成绩、风险分布等非知识类发现不受节点门禁约束。

**Non-Goals:**

- 不取消模型诊断或改为纯规则排名（提示词仍承担多源综合与表述）。
- 不修改学生画像、作业、测评与知识进度的事实真源。
- 不在本变更内建立完整评测门禁（由 #1729 承载）。
- 不改变既有语言门、归因门、证据引用门与 sourceCoverage 契约。

## Decisions

1. **薄弱判定锚定绝对弱势进度行**。弱势行定义为 `status === 'NOT_STARTED' || (progress < 40 && status !== 'COMPLETED')`。班级诊断要求节点弱势行数 ≥ `max(3, ceil(0.2 × 该节点有进度记录的学生数))`；学生诊断要求目标学生该节点行为弱势行。阈值 40 与 20% 源自实验中正常/薄弱分布的经验分界，作为常量进入 spec 场景。知识点发现的判定范围与既有归因门语义一致（引用 `knowledge-progress` 证据的发现）；只填 `knowledgeNodeId` 而不引用进度证据的发现沿用归因门的非知识发现豁免，不重复扩大两道门的边界。
2. **确定性校准门禁作为模型行为缺陷处理**。新增 `DiagnosisFindingCalibrationError`，worker 分类为 `validation:false, code: 'diagnosis-finding-calibration-invalid'`，走既有 3 次重试预算；重试耗尽即作业失败，不持久化过度诊断报告。与语言门（#1711）、归因门（#1712）同层。
3. **"学完但测评差"保留为非知识类发现通道**。assessment/assignment 无节点粒度，若允许其单独支撑知识点薄弱，健康场景的相对低分仍可经该路径误报。整体性问题由不带 knowledgeNodeId 的发现表达（既有 schema 与提示词已支持），召回不丢失，精确率获得结构性下界。
4. **覆盖降级为确定性双约束**。任一知识点 finding 引用节点的进度行覆盖学生数 < 全体学生数时：报告 `confidence` 必须不是 `high`，且 `limitations` 非空（由提示词指示写明缺失影响，校验只强制"存在说明"）。取 `ceil` 与 `<` 全体比较避免浮点边界歧义。
5. **提示词分层指令与门禁互补**。提示词负责：判定标准表述（绝对弱势 vs 相对较低但正常）、空 findings 的鼓励输出、证据冲突时写入 limitations 并降低 confidence、数据缺失时显式说明。门禁负责：可确定性验证的硬下界。两者共同保证验收条件，不重复实现。
6. **空 findings 是合法输出**。schema 已允许 `findings: []`；投影端首要弱点回退文案已存在（"未形成可稳定识别的主要薄弱点"）。本变更仅确认全链路（历史投影、delivery 投影、PDF）对空 findings 的行为，必要时修正越界或误导性展示。

## Risks / Trade-offs

- 硬阈值 40/20% 可能把个别"高进度低掌握"的真实节点薄弱挡在知识点通道外 → 该信息仍可经非知识类发现进入报告；#1729 评测门禁复测召回率，若召回跌破 80% 再校准阈值而非放宽门禁语义。
- 模型可能在健康场景反复输出知识点 findings 直至重试耗尽 → 门禁失败原因明确，作业失败优于静默误报；实验中模型对明确指令遵循率高，重试内收敛预期成立。
- 学生诊断样本小（1 行/节点），阈值语义弱化为"该生该节点绝对弱势" → 与教师对单个学生的直觉一致，可接受。
