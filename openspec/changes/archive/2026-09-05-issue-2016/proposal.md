## Why

2026-09-05 三臂公平实验中普通基线（plain-baseline）按设计不启用章节结构合同，其「结构与质量联合通过率」必然为 0，但该指标此前被称为泛化的「综合通过率」，容易被误读为知识正确率 0%；PPT、CSV、工作簿与 Markdown 也未统一说明该 0% 的结构性来源，存在错误结论风险。

## What Changes

- 全部人类可见载体（Markdown 幻灯片、CSV、xlsx 工作簿、JSON 派生说明）统一把 composite 指标显示为「结构与质量联合通过率」，并注明公式：结构通过且盲审质量非 major-error。
- 普通基线旁显示固定解释：未启用结构合同；联合通过率 0% 不代表知识正确率 0%。
- 跨组质量比较以「盲审质量通过率」为主要质量指标；结构率与联合率作为能力指标分别报告（幻灯片行名保持分列，不合并）。
- 引用类指标在 0/0 时显示 N/A，不再显示 0%。
- 内部 schema key `composite` 与冻结 official.json 数据保持原样，不做改写。

## Capabilities

### Modified Capabilities

- `konling-fair-baseline-replay-evaluation`: 导出载体的 composite 指标人类可见命名、普通基线解释与 0/0 N/A 语义。

## Impact

- `src/lib/konling-fair-experiment/export.ts`：summaryRows/slides/delta 显示名映射与 notes JSON 派生。
- 新增导出命名与解释回归测试；不改写冻结真源、不改盲审或结构评分算法。
