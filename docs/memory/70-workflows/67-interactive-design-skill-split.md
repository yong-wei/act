# 互动课程设计技能拆分与三层边界

状态: active
最后更新: 2026-04-16
摘要: 记录作者态互动课程设计从 `lesson` 技能中独立拆分后的稳定边界，明确 `lesson / interactive-design / interactive-lesson` 三者的职责划分与切换时机，避免后续再次把互动设计规则、实现规则和课程正文规则混写在同一个技能里。
上游:
- [00-index.md](00-index.md)
下游: []
相关:
- [../../.agents/skills/lesson/SKILL.md](../../../.agents/skills/lesson/SKILL.md)
- [../../.agents/skills/interactive-design/SKILL.md](../../../.agents/skills/interactive-design/SKILL.md)
- [../../.agents/skills/interactive-lesson/SKILL.md](../../../.agents/skills/interactive-lesson/SKILL.md)
- [../../AGENTS.md](../../../AGENTS.md)

## 结论

- `lesson` 只负责讲义、知识图谱/知识卡片、BOPPPS 与多媒体。
- `interactive-design` 只负责作者态双轨互动设计：`interactive-page.md` 与 `interactive-contract.yaml`。
- `interactive-lesson` 只负责把双轨设计落成课堂代码与 runtime 行为。

## 为什么要拆

`3-7` 的复盘表明，旧口径把互动设计约束混写在 `lesson` 中，会同时带来两个问题：

1. 设计层约束不够聚焦，像“例题题面必须完整、步骤逐步显影、教师的发放/浏览/显影/答案控制必须分离、学生作答默认隐藏且按小卡片逐步提交”这类规则没有被写成独立硬约束。
2. 实现层容易滑回通用壳：统一信息块、统一文本框、统一提交按钮、统一“释放互动/显示答案”双开关。

因此必须把“作者态互动设计”单独抽出，避免 `lesson` 同时承担正文制作与互动页面设计。

## 当前稳定边界

### `lesson`

适用：

- 讲义正文
- 教师版课堂讲义
- `manifest.json`
- `graph/*.jsonl`
- `sequence.json`
- `boppps.md`
- `multimedia.md`

不再负责：

- `interactive-page.md`
- `interactive-contract.yaml`

### `interactive-design`

适用：

- 讲义证据单元映射为页面步骤
- 例题模块、推导显影、曲线面板与比较页拆分
- 学生默认状态与教师控制语义
- 页面顺序、公式/表格/图片排布

固定参考：

- `worked-example-modules.md`
- `curve-interaction-panels.md`
- `page-sequence-and-activity-controls.md`

### `interactive-lesson`

适用：

- 师生端页面代码
- 会话同步
- 教师聚合
- 提交反馈
- 埋点与运行时课程实现

新增实现侧红线：

- 不得把原理/定理模块、例题模块、作答模块合并成统一工作区壳
- 不得把教师控制退化成单一“释放互动 / 显示答案”
- 不得把多步骤作答收缩成统一大表单
- 不得跳过方法页而只保留比较页

## 切换规则

- 用户要写讲义、教案、知识图谱或多媒体：进入 `lesson`
- 用户要写 `interactive-page.md` / `interactive-contract.yaml`：进入 `interactive-design`
- 用户要把设计稿实现成前端课堂：进入 `interactive-lesson`
- 若实现阶段发现缺的是例题显影节奏、作答卡粒度、浏览权限或图文顺序，先退回 `interactive-design`，不要在实现阶段自行发明默认规则

## 兼容处理

- `/.agents/skills/lesson/references/step6-interactive-page.md` 已改为迁移提示页，用于兼容历史链接。
- `AGENTS.md` 已把项目专用技能清单更新为 `interactive-design + interactive-lesson + lesson` 的三层结构。
