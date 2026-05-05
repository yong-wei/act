# 单元 5-6 资源采用单

## 单元边界

- 单元：`5-6`
- 标题：方法迁移与前沿比较：经典控制、数据驱动与策略学习的同题比较
- 课型：实践
- 学时：90 分钟
- 主案例：疫苗/生物制剂冷链仓库温控
- 讲义主线：围绕同一冷链任务，比较经典 PI/PID、数据驱动热负荷预测补偿和策略学习监督层三条路线的收益、风险、验证路径和工程责任。

## 资源采用表

| source_path | resource_type | target_unit | use_position | usage_mode | adoption_level | boundary_note |
| --- | --- | --- | --- | --- | --- | --- |
| `course-content/syllabus-refactor/module-skeletons.md` | syllabus | `5-6` | 讲义边界 | 改写吸收 | 必融入 | 固定 5-6 为模块 5 唯一实践课，任务是同题比较，不扩展为算法实现竞赛。 |
| `course-content/syllabus-refactor/unit-design-details/module5.md` | syllabus | `5-6` | 全文主线 | 改写吸收 | 必融入 | 提取“经典控制、数据驱动、策略学习、选择理由、风险说明、验证路径、工程责任”作为核心对象。 |
| `course-content/authoring/lessons/5-4/design/5-4-handout.md` | nearby-handout | `5-6` | 数据驱动路线语言 | 改写吸收 | 必融入 | 只承接模型驱动到数据驱动的进入条件、数据覆盖、验证和泛化代价，不重讲 MPC 或数据驱动算法细节。 |
| `course-content/authoring/lessons/5-5/design/5-5-handout.md` | nearby-handout | `5-6` | 策略学习路线语言 | 改写吸收 | 必融入 | 只承接策略学习的进入条件、收益、样本代价、安全验证和部署风险，不展开训练算法。 |
| `course-content/authoring/lessons/5-3/design/5-3-handout.md` | nearby-handout | `5-6` | 复杂系统责任语言 | 仅作灵感 | 可选融入 | 只借“控制动作处在更大系统链路中，需要责任分层”这一判断，不采用原案例作为 5-6 主素材。 |
| `https://www.cdc.gov/vaccines/hcp/storage-handling/index.html` | official-background | `5-6` | 温区事实 | 改写吸收 | 必融入 | 用于固定冷藏场景的 2°C-8°C 温区、储存处理与异常处置背景，正文不扩写成法规材料。 |
| `https://www.cdc.gov/vaccines/hcp/imz-best-practices/storage-handling-immunobiologics.html` | official-background | `5-6` | 质量责任背景 | 改写吸收 | 必融入 | 用于支撑免疫生物制品储运责任和温度管理背景，只写入任务约束。 |
| `https://www.who.int/teams/immunization-vaccines-and-biologicals/essential-programme-on-immunization/supply-chain/controlled-temperature-chain-%28ctc%29` | official-background | `5-6` | 边界事实 | 改写吸收 | 可选融入 | 用于说明离开标准冷链条件需有明确批准、条件和责任边界，不作为本课温控指标来源。 |
| `course-content/authoring/lessons/5-6/media/raw/generate_5_6_cold_chain_benchmark.m` | local-simulation | `5-6` | 数值证据 | 直接复用图片 | 必融入 | 固定种子 `5606` 生成三场景三路线日志、指标和模型参数，是讲义指标表的唯一数值来源。 |
| `course-content/authoring/lessons/5-6/media/raw/render_5_6_cold_chain_figures.py` | local-render | `5-6` | 图表证据 | 直接复用图片 | 必融入 | 读取 Octave 输出渲染运行日志、二状态模型、三路线对照和风险-验证矩阵。 |
| `course-content/resource-library/indexes/syllabus-fusion-map.md` | resource-index | `5-6` | 资源边界判断 | 改写吸收 | 必融入 | 确认模块 5 资源只服务边界识别和方法迁移，不把 5-6 改写为前沿专题罗列。 |
| `course-content/resource-library/civics-cases/cases/07-离散历史棱镜.md` | civics | `5-6` | 总结与工程责任 | 仅作灵感 | 可选融入 | 只吸收“工程问题推动工具迁移、方法选择需要多视角”的表达，不写成独立价值段落。 |
| `course-content/resource-library/ship-control-cases/sections/7.1-7.3` | ship-case | `5-6` | 边界案例来源 | 暂不采用 | 排除 | 这些资源已经主要服务模块 5 前段边界识别，不承担本课冷链同题比较主线。 |
| `course-content/resource-library/ship-control-cases/sections/8.1-8.3` | ship-case | `5-6` | 离散实现背景 | 暂不采用 | 排除 | 离散系统案例只可作为数字实现背景，不把 5-6 拉回离散控制补充内容。 |

## 成文决策

5-6 采用“外部事实背景 + 本地固定种子仿真 + 同题评审表”的方式成文。外部官方资料只承担温区和冷链责任背景；教学结论来自二状态热模型、48 小时运行日志和三路线指标。5-4 与 5-5 只作为方法语言承接，帮助解释数据驱动和策略学习的进入条件、验证代价与安全边界，不再作为案例素材来源。
