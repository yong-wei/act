## Context

诊断报告 `cmti6cg9o000ug6jx7cuea04o`（2026-09-01）暴露两个叠加缺陷：

1. **生成端语义缺口**：`buildDiagnosisProviderToolResults` 的 `riskFlags` 投影只给模型记录数组，`sourceCoverage`/输入摘要只提供 `studentIds.length` 与 `riskFlags.length`。模型无从知道风险标志是"命中集合"，把 52/100 读成覆盖率。system prompt（`DIAGNOSIS_PROVIDER_SYSTEM_PROMPT_LINES`）对知识进度、作业测评冲突均有明确指令，唯独没有风险标志语义说明。
2. **投影端回退缺口**：`buildConfidenceReasons` 在 `confidence !== 'high'` 且无法生成结构化原因时，回退为"报告没有提供可验证的置信度原因 / 补充可核验证据后，重新生成诊断"；`buildAvailability` 对 `medium` 固定显示"证据部分可用 / 覆盖或归因仍不完整"。模型用自然语言 limitations 表达的真实冲突（作业测评正常 vs 知识进度长期滞后）没有结构化入口，被通用文案掩盖。

## Decisions

- **输入投影分离命中数与覆盖数**：provider 工具结果中的风险标志聚合携带 `flaggedStudentCount`（命中学生数）与 `diagnosedStudentCount`（被诊断学生总数）等显式命名字段，不复用 `coverage` 词汇；逐条记录保持现有别名投影。
- **提示词声明稀疏语义**：system prompt 增加一条简体中文指令：风险标志是稀疏命中集合，数量为命中学生数而非覆盖人数，不得据此生成"风险数据仅覆盖 N 名学生"类限制。
- **确定性校验拦截误述**：新增生成后校验（沿用既有模型行为缺陷/重试语义），对 limitations/summary 中"风险…覆盖…百分比/人数"模式的表述做确定性拦截。模式校验只拦截覆盖误述这一类已知缺陷，不做通用自然语言审查。
- **结构化置信原因：证据冲突**：报告投影新增"证据冲突"置信原因类型——当模型声明了跨来源冲突类 limitation 且各证据组覆盖完整时，状态卡片显示"证据存在冲突"语义与教师复核动作；仅当确实没有任何已知原因时才保留通用回退文案。
- **基准场景**：在 #1729 的 benchmark 中新增场景类 `sparse-risk-flags-with-cross-source-conflict`：100 学生、52 条命中标志、作业/测评覆盖完整、跨来源冲突；ground truth 要求 confidence ≤ medium 且 limitations 不含覆盖误述。

## Risks / Trade-offs

- 自然语言模式拦截存在绕过空间（模型换措辞）。缓解：输入投影与提示词先行消除诱因，校验兜底；benchmark live 评测观察复发率。
- 历史报告不回写，旧报告仍可能显示通用文案——按 Issue 非目标处理，以新报告验证。

## Open Questions

（无）
