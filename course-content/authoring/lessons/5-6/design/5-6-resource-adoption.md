# 单元 5-6 资源采用单

## 单元边界

- 单元：`5-6`
- 标题：方法迁移与前沿比较：经典控制、数据驱动与策略学习的同题比较
- 课型：实践
- 学时：90分钟
- 讲义主线：围绕同一自主航行控制任务，比较经典控制、数据驱动与策略学习三条路线的进入条件、收益、风险、验证路径和工程责任。

## 资源采用表

| source_path | resource_type | target_unit | use_position | usage_mode | adoption_level | boundary_note |
| --- | --- | --- | --- | --- | --- | --- |
| `course-content/syllabus-refactor/module-skeletons.md` | syllabus | `5-6` | 讲义边界 | 改写吸收 | 必融入 | 固定 5-6 为模块 5 唯一实践课，任务是同题比较，不扩展为算法实现竞赛。 |
| `course-content/syllabus-refactor/unit-design-details/module5.md` | syllabus | `5-6` | 全文主线 | 改写吸收 | 必融入 | 提取“经典控制、数据驱动、策略学习、选择理由、风险说明、验证路径、工程责任”作为核心对象。 |
| `course-content/authoring/lessons/5-4/design/5-4-handout.md` | nearby-handout | `5-6` | 数据驱动路线证据 | 改写吸收 | 必融入 | 只承接模型驱动到数据驱动的进入条件、数据覆盖、验证和泛化代价，不重讲 MPC 细节。 |
| `course-content/authoring/lessons/5-5/design/5-5-handout.md` | nearby-handout | `5-6` | 策略学习路线证据 | 改写吸收 | 必融入 | 只承接 RL 的进入条件、收益与风险，不重复展开状态、动作、奖励和训练路线。 |
| `course-content/authoring/lessons/5-3/design/5-3-handout.md` | nearby-handout | `5-6` | 同一任务工程语境 | 改写吸收 | 可选融入 | 采用 MASS 链路中的感知、估计、规划、控制和执行责任边界，作为方法比较的任务背景。 |
| `course-content/authoring/lessons/5-6/media/raw/5-6-intro-video-prompts.md` | media-prompt | `5-6` | 导入与收束 | 改写吸收 | 必融入 | 吸收“三路线同题比较、性能与风险并列、选择说明卡”的视觉主线，不直接搬入提示词句子。 |
| `course-content/resource-library/indexes/syllabus-fusion-map.md` | resource-index | `5-6` | 资源边界判断 | 改写吸收 | 必融入 | 确认模块 5 的资源只服务边界识别和方法迁移，不把 5-6 改写为前沿专题罗列。 |
| `course-content/resource-library/civics-cases/cases/07-离散历史棱镜.md` | civics | `5-6` | 总结与工程责任 | 仅作灵感 | 可选融入 | 只吸收“工程问题推动工具迁移、方法选择需要多视角”的表达，不写成独立思政段。 |
| `course-content/resource-library/ship-control-cases/sections/7.1-7.3` | ship-case | `5-6` | 边界案例来源 | 暂不采用 | 排除 | 非线性船舶案例已主要服务 5-1/5-2，不承担 5-6 的三路线比较主线。 |
| `course-content/resource-library/ship-control-cases/sections/8.1-8.3` | ship-case | `5-6` | 离散实现背景 | 暂不采用 | 排除 | 离散系统案例只可作为数字实现背景，不把 5-6 拉回离散控制补充章。 |

## 成文决策

5-6 采用“相邻课次证据承接 + 同一任务评审表”的方式成文。讲义不新增复杂算法推导，也不把 RL 或数据驱动包装成默认升级路线；核心训练是让学习者能够在同一任务下写出可审查的方法选择说明：选择哪条路线、为什么选择、主要收益是什么、风险在哪里、如何验证、为什么暂不采用其他路线。
