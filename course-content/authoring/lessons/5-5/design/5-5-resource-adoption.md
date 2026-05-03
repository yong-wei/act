# 单元 5-5 资源采用单

## 单元边界

- 单元：`5-5`
- 标题：从显式控制器到策略学习：强化学习的进入条件、收益与风险
- 课型：理论
- 学时：90分钟
- 讲义主线：当显式控制器结构难以预先写出时，解释策略学习的合法入口，并同时比较收益、样本代价、可解释性、安全验证和部署风险。

## 资源采用表

| source_path | resource_type | target_unit | use_position | usage_mode | adoption_level | boundary_note |
| --- | --- | --- | --- | --- | --- | --- |
| `course-content/syllabus-refactor/module-skeletons.md` | syllabus | `5-5` | 讲义边界 | 改写吸收 | 必融入 | 固定 5-5 为理论课，强化学习只作为方法迁移终点，不写成算法推导课。 |
| `course-content/syllabus-refactor/unit-design-details/module5.md` | syllabus | `5-5` | 全文主线 | 改写吸收 | 必融入 | 提取“显式控制律与学习策略、收益、样本代价、可解释性、安全验证、部署风险”六个核心对象。 |
| `course-content/authoring/lessons/5-4/design/5-4-handout.md` | nearby-handout | `5-5` | 前置概念与过渡 | 改写吸收 | 必融入 | 只承接模型驱动到数据驱动的迁移逻辑，不重讲 MPC 和数据驱动控制细节。 |
| `course-content/authoring/lessons/5-3/design/5-3-handout.md` | nearby-handout | `5-5` | 工程案例语境 | 改写吸收 | 可选融入 | 复用复杂自主航行链路、规划与控制接口、执行约束语境，避免把 5-5 写成抽象 AI 介绍。 |
| `course-content/authoring/lessons/5-5/media/raw/5-5-intro-video-prompts.md` | media-prompt | `5-5` | 导入语境 | 改写吸收 | 必融入 | 保留“前沿不取消责任，反而提高责任”的风险约束口径。 |
| `course-content/resource-library/indexes/syllabus-fusion-map.md` | resource-index | `5-5` | 资源边界判断 | 仅作灵感 | 可选融入 | 当前资源库没有直接服务策略学习的主骨架素材；旧船舶 7.x/8.x 与离散 8.x 只服务 5-1/5-2。 |
| `course-content/resource-library/ship-control-cases/indexes/section-map.md` | ship-case-index | `5-5` | 边界审查 | 暂不采用 | 排除 | 船舶非线性与离散案例不能承担 5-5 策略学习主线，避免主线回退到旧非线性/离散章节。 |
| `course-content/resource-library/civics-cases/integration-points.md` | civics-index | `5-5` | 总结语气参照 | 仅作灵感 | 可选融入 | 只保留工程责任和系统观念，不写脱离专业问题的独立思政段。 |

## 成文决策

5-5 采用“课程框架自建主线 + 相邻课次证据承接”的方式成文。现有资源库不提供可直接改写为策略学习讲义的成稿材料，因此讲义不从旧课件或船舶案例拼贴内容，而围绕一个自主航行任务建立判断链：显式控制律可写性下降、策略学习进入条件、收益与风险并存、部署前验证责任增加。
