# 模块4后半链重构为显式带优化思想的控制器设计链

状态: active
最后更新: 2026-04-20
摘要: 记录模块4在 `4-4` 及之后不再重复经典设计步骤，而是基于已确定经典结构、性能指标与优化工具形成控制器优化设计链的决策。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/50-decisions/00-index.md)
下游:
- []
相关:
- [course-content/syllabus-refactor/decisions.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/decisions.md)
- [course-content/syllabus-refactor/unit-design-details/module4.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/unit-design-details/module4.md)
- [ADR-2026-04-18-module4-merge-4-3-4-4.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/50-decisions/ADR-2026-04-18-module4-merge-4-3-4-4.md)

## 结论

- 模块4仍以经典结构控制器设计为核心，包括 `PI / PD / PID / 超前 / 滞后 / 前馈 / 复合校正`。
- `4-3` 负责让经典结构与经典设计方法落地，输出固定结构、参数起点、首轮证据、问题清单与参数优化入口卡。
- `4-4` 之后不再重复经典整定语言，而是围绕性能指标、控制量代价、权重偏好、约束表达与工具求解展开控制器优化设计。
- 主线调整为：
  - `4-4`：固定结构下的优化建模；
  - `4-5`：参数约束翻译与带约束参数优化实践；
  - `4-6`：固定结构优化边界、结构编码入口与场景迁移；
  - `4-7`：完整工程设计闭环实践。

## 关键事实

- `4-1` 轻量补入 `ITSE` 与控制量代价，与已有 `ISE / IAE / ITAE` 一起作为后续目标函数和约束表达的评价语言。
- `4-4 / 4-5` 的主工具层为 `fminsearch / fminunc / fmincon / 罚函数`，重点是目标函数、约束、初值与结果解释，不讲成优化算法理论课。
- `Pareto` 只保留基本概念和最小案例，用于说明多目标之间没有唯一绝对最优。
- `ga / pso` 后移到 `4-6 / 4-7`，只作为结构编码、复杂搜索和固定结构失效后的入口，不前移为 `4-4 / 4-5` 的并列主线。

## 后续影响

- 后续制作 `4-4 / 4-5 / 4-6 / 4-7` 的讲义、教案、互动课程设计和媒体清单时，应优先读取 `course-content/syllabus-refactor/unit-design-details/module4.md`。
- 若旧文档仍出现“问题清单驱动修正、先权衡再修正再迁移、双场景比较”等旧口径，应以本 ADR 和 `course-content/syllabus-refactor/decisions.md` 中 2026-04-20 条目为准。
