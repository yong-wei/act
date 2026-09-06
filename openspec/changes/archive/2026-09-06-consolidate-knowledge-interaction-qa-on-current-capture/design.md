## Context

调查基于 `integration` 的 `a8b2435b6`。商业 UI 脚本的 `validateKnowledgeGraphInteractionStateEvidence`（1990–2104 行）单独读取 #485 文件，要求 1425×900 PNG、layoutVersion 为字符串 0 和旧 deterministic harness。当前产品捕获已包含 `desktop-hover-click-drag-dark`、详情和显式 relayout 状态，其中记录 beforeDrag、afterDrag、afterHover。两条链重复表达交互稳定性，却使用不同年代的数据格式。

## Goals / Non-Goals

合并检查来源，删除旧 reader 和格式分支，使工具及测试总代码净减少。保留现行交互稳定性要求、当前证据真实性及隐私要求；不修改图谱交互、不处理其他现存 QA 失败、不搬迁历史证据。

## Decisions

1. 使用既有产品 QA 状态矩阵作为当前交互输入，在现有 validator 中比较实际观测。需要补充的选择前后、关闭详情或悬停采样直接加入现有状态，不增加第二份文件、命令或 registry。
2. 删除 #485 路径常量、独立 validator、调用点及其专属源码/旧 fixture 断言。保留 `knowledge-graph-interaction-state.test.ts` 的有效纯函数行为用例和现役 force 浏览器测试。
3. 稳定性按同次捕获、同模式的节点坐标/布局与选择、固定状态比较，不要求永远为某个初始版本或节点数量。Legacy 显式 relayout 与 Active reflow 的固定语义分别遵循现行实现，不拿一种模式的断言套另一种。
4. 成功必须来自实际指针、拖动与详情操作。`sourceEvidence.hoverDoesNotRelayout=true` 等写死值、缺少 before/after 或未执行操作均不能满足验收。错误观测继续失败，不修改结果标记以消除红测试。
5. 在完成说明列出删除的检查和测试，并汇总所有受影响脚本/测试的前后行数；仅移动代码不算完成。

## Risks / Trade-offs

当前 QA 曾暴露节点可读性、移动端遮挡和 Escape 问题。这些结果仍由原检查报告，不属于本次格式整理的豁免项。新增行为比较若发现产品缺陷，应如实说明，不能顺手扩大产品修改范围。

## Migration Plan

先用既有状态证明新检查拒绝缺失和错误观测，再删除旧 reader；本地捕获一次当前交互回归，无生产部署。
