# 4-6 互动实现对照表

生成时间：2026-04-24T13:05:01+08:00

本轮实现以 `course-content/runtime/lessons/4-6/interactive-manifest.json` 为页面编排真源，并用 `interactive-contract.yaml` 校验步骤、模板、互动类型、教师控制、预览路径与 AI 页面目标。

| 步骤 | 标题 | 模板 | 互动 | runtime 模块兑现 | 实现位置 | 状态 |
|---|---|---|---|---|---|---|
| step-01 | 从 4-5 可用解到驱逐舰失配：为什么这次不能只说“再调一调参数” | `migration_boundary_hero_board` | `none` | 公式卡、失配图、问题聚焦与桥接结论 | `src/lib/unit-4-6-course.ts`；共享 manifest renderer | 严格实现 |
| step-02 | 本次课程目标：完成这轮迁移判断后应能做到什么 | `objective_chain_board` | `none` | 目标标题、五条目标、桥接句 | 同上 | 严格实现 |
| step-03 | 迁移场景任务重排：客船与驱逐舰到底换了什么 | `scenario_reorder_compare_board` | `activity_card_set` | 迁移公式、原生表、双作答卡 | 共享内容渲染 + 共享活动渲染 | 严格实现 |
| step-04 | 固定结构迁移后的失配信号：拖尾、航迹偏离与职责过载如何同时出现 | `mismatch_evidence_board` | `teacher_reveal_only` | 旧权重、旧总代价、失配图、三层显影 | 共享内容渲染 + 教师显影控制 | 严格实现 |
| step-05 | 驱逐舰专用代价函数：为什么比较对象必须重写 | `objective_rewrite_board` | `activity_card_set` | 新旧目标、五项职责表、双作答卡 | 共享内容渲染 + 共享活动渲染 | 严格实现 |
| step-06 | 何时把结构选择正式抬成问题本身 | `structure_entry_board` | `teacher_reveal_only` | 过载链、三层引入条件、五类结构 | 共享内容渲染 + 教师显影控制 | 严格实现 |
| step-07 | 五类结构的统一编码：先判结构，再解释参数 | `structural_encoding_workspace` | `teacher_reveal_only` | 编码公式、码本表、解码显影、双作答卡 | 共享内容渲染 + 共享活动渲染 | 严格实现 |
| step-08 | 四类方案比较矩阵：先问目标是否对题，再问结构是否够用 | `four_scheme_compare_board` | `teacher_reveal_only` | 方案矩阵、主比较图、问题矩阵表、比较显影 | 共享内容渲染 + 教师显影控制 | 严格实现 |
| step-09 | 结构搜索证据与专项验证：总代价更低为什么仍不自动等于可交付 | `boundary_probe_board` | `teacher_reveal_only` | 收敛图、专项验证图、控制器公式、控制效果图、判断卡 | 共享内容渲染 + 共享活动渲染 | 严格实现 |
| step-10 | 后测：目标错位、结构边界与统一编码是否已经连成链 | `posttest_board` | `quiz_group` | 后测标题、三题独立作答、提交说明 | 共享活动渲染 | 严格实现 |
| step-11 | 总结：从任务重排到结构编码入口的完整判断链 | `summary_exit_board` | `none` | 五条总结、主线链条、4-7 去向 | 共享内容渲染 | 严格实现 |

硬闸门核对：

- `must_be_visible: true` 模块缺 renderer 时，`interactive-manifest-renderer.tsx` 会输出可见错误面板，并由单元测试捕获。
- 4-6 课程级 `step-panels.tsx` 只装配 manifest 模块与活动 registry，不再保存课程级超大页面分支。
- 学生页只更新隐藏式全局 AI 页面上下文，不渲染页内 AI 入口。
- 后测 `step-10` 与总结 `step-11` 分离。
- 正式页面媒体路径只使用 `/course-runtime/lessons/4-6/media/...`。
