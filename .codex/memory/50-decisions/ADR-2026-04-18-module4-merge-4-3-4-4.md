# ADR-2026-04-18：模块4合并原4-3/4-4，新的4-3固定为初始方案落地实践课

状态: active
最后更新: 2026-04-18
摘要: 模块4不再保留原 `4-3（理论） 初始方案形成` 与 `4-4（实践） 首轮验证诊断` 的分拆结构，而是正式合并为新的 `4-3（实践） 初始方案落地实践：从对象分析到结构组合与首轮验证`。该调整同时把模块4由 `8` 个单元压缩为 `7` 个单元、由 `16h` 调整为 `14h`，并明确删除学生版讲义中的防御性分拆叙事。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/50-decisions/00-index.md)
- [../40-domain/10-lesson-framework.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/10-lesson-framework.md)
下游: []
相关:
- [course-content/syllabus-refactor/main.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/main.md)
- [course-content/syllabus-refactor/blueprint.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/blueprint.md)
- [course-content/syllabus-refactor/module-skeletons.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/module-skeletons.md)
- [course-content/syllabus-refactor/unit-design-details/module4.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/unit-design-details/module4.md)

## 结论

- 原 `4-3 / 4-4` 正式合并为新的 `4-3（实践） 初始方案落地实践：从对象分析到结构组合与首轮验证`。
- 模块4后半链顺延改号为：
  - 原 `4-5` -> 新 `4-4`
  - 原 `4-6` -> 新 `4-5`
  - 原 `4-7` -> 新 `4-6`
  - 原 `4-8` -> 新 `4-7`
- 模块4总学时由 `16h` 调整为 `14h`。
- 学生版讲义主线明确改为：
  - 任务表达
  - 结构选型
  - 初始方案落地
  - 多目标权衡
  - 方案修正
  - 场景迁移
  - 双场景比较
- “方案卡字段学”“失败三分类”“故意失败再归因”不再作为学生版正文骨架；如需保留，只能降位到教师诊断或侧栏提示。

## 触发原因

- 原 `4-3` 与 `4-4` 的内容量都不足以独立撑满一整课，分拆后反而逼迫文档制造大量过渡、预案和诊断框架，导致讲义拖沓。
- 用户明确指出，模块4更合理的直接设计逻辑应当是：对象分析后，结合 `4-2` 的结构选型知识，直接形成方案并验证，而不是额外插入一整课“初始方案形成”再故意失败。
- 从课程职责看，文档需要讲清基本原理和设计步骤，而不是穷尽一切可能犯错的情形。
- 从学时治理看，合并 `4-3 / 4-4` 是当前最自然、最不伤主干能力的一次减载动作。

## 落地方式

- `main.md` 改写模块4骨架，并记录本轮合并后显性编排由 `76h` 压到 `74h`，仍需后续继续回收 `2h`。
- `blueprint.md` 改写模块4单元表、教学说明、考核映射与思政映射中的课次编号。
- `module-skeletons.md` 改写模块4逻辑链、单元表与场景约束。
- `module4.md` 重写为新的精简版本，删除旧的防御性分拆叙事，并以学生版讲义优先重新约束四类产物。

## 对后续制作的影响

- 后续若继续制作 `4-3` 讲义、教案或互动课，必须直接按“对象分析 -> 结构组合 -> 参数方向 -> 首轮验证 -> 问题清单”展开，不得恢复原 `4-3 / 4-4` 的二段式写法。
- 后续若继续制作旧目录下的 [course-content/authoring/lessons/4-4/design/handout.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/4-4/design/handout.md) 及相关素材，应先判断其内容是并入新的 `4-3`，还是重编号为新的 `4-4 / 4-5` 一部分，不能继续把它当作独立旧课次维持。
- 合并后全课程显性编排仍为 `74h`，说明模块4减载虽成立，但不足以单独完成全课程 `72h` 口径校正；后续还需再确定一处 `2h` 回收位置。
