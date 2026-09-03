## Why

2026-09-03 在 `origin/integration` 修订 `4371d14` 上的 720 次主实验显示：引用精确率 96.6%（已达标），但答案单元追溯覆盖率仅 35.1%，严格综合通过率 5.6%。引用编号大多有效，可多数需要证据的关键结论没有与服务器分配的引用建立可验证绑定。

根因在覆盖分母与绑定诊断的结构缺口，而不是缺少行级扫描：

- `scanKonlingAnswerUnits` 把 evidence-required 章节内**所有非空行**都计为需覆盖单元——引导头（「下面分几点说明：」）、短过渡行、纯公式展示行都进入分母，而 spec 语义是「substantive answer unit」。分母被结构性文本稀释，即使模型在每个关键结论后放了 `[n]`，ratio 仍被未引用的过渡行拉低。
- 未绑定单元没有原因分类，无法区分「模型没放编号」「编号未分配」「引用未验证」「引用缺 target」。
- 引用漂移（有效编号出现在 model-derived 章节或无章节区域而证据章节仍缺引用）与重复堆叠（`[1][1]`）没有诊断输出。
- prompt 只暴露 6 个可绑定编号且未说明同一编号可复用；需证据单元多于可见编号时模型自然集中少量引用。

## What Changes

- 在答案单元扫描中落实 substantive 判定：引导头、短过渡行、纯数学展示行与分隔线不再进入需证据分母；其余陈述行仍全部计入。
- 为每个未绑定的需证据单元输出缺失原因分类（`no-marker` / `marker-unassigned` / `citation-unverified` / `citation-no-target`），随 `answerUnitCoverage` 一起返回。
- 在 citation guard 诊断中输出引用漂移计数（有效 marker 出现在 model-derived 或无章节区域）与重复堆叠计数；重复堆叠不虚增单元覆盖（既有布尔绑定语义保持）。
- prompt 保守增强：暴露全部可绑定编号（不再截断为 6 个），并明确同一编号可复用于多个结论单元、无证据结论必须改述为证据缺口而不是省略或虚构编号。
- 保持既有不变量：未经服务器分配/验证/带 target 的编号仍被标记并剥离；未覆盖的 evidence-required 章节仍触发低置信降级；normative fail-closed 章节仍不进入覆盖统计。

## Capabilities

### Modified Capabilities

- `konling-agent-runtime`: answer-unit 覆盖测量从「章节内全部非空行」收敛为「substantive 需证据单元」，并补充缺失原因、漂移与重复诊断场景。

## Impact

- 修改 `src/lib/konling-agent-runtime.ts` 的 `scanKonlingAnswerUnits`、覆盖统计与 guard 诊断；`src/lib/ai-prompt-builder.ts` 的可绑定编号与复用说明。
- 扩展 `KonlingAnswerUnitRecord` 与 `KonlingAnswerUnitCitationCoverage` 结构（新增字段向后兼容）。
- 回归测试覆盖六个 study-question 意图的 substantive 分类、缺失原因、漂移与重复堆叠。
- 不改变 invalid marker 剥离、低置信降级与 normative fail-closed 行为；不增加外部检索数据源；不放宽严格综合通过条件。
- 真实模型上的 85% 覆盖率门槛需要主实验复测；本 change 交付可冻结回归的单测级证据（分类正确性与合成输出上的覆盖率计算），真实评测留给后续实验并如实记录。
