# 课程资源库正式融入框架

更新时间：2026-03-28

## 1. 目的

`course-content/resource-library/` 中的资源不再只作为“可参考资料”，而是作为课程重构与课程制作过程中的**正式候选输入源**。本框架用于回答三个问题：

1. 哪类资源适合在哪个层级使用；
2. 资源进入课程前需要经过什么筛选；
3. 资源进入讲义、教案、互动页、多媒体时应如何转写，而不是直接拼贴。

## 2. 资源角色定义

| 资源类型 | 目录 | 正式角色 | 典型用途 | 不应承担的角色 |
| --- | --- | --- | --- | --- |
| 课件提取资源 | `course-content/resource-library/pptx/` | 表达参考源 | 概念讲解顺序、图示骨架、例题组织、历史课件中的可复用图 | 直接充当新课讲义正文或互动页成稿 |
| 课程思政案例 | `course-content/resource-library/civics-cases/` | 价值引导源 | 导入、过渡、总结、工程责任与系统观念嵌入点 | 孤立贴标签、脱离专业问题单独讲政治 |
| 船舶特色案例 | `course-content/resource-library/ship-control-cases/` | 工程场景源 | 建模、分析、校正、边界讨论中的工程实例与图示 | 取代当前单元主线、把整课变成案例阅读课 |
| 既有习题资源 | 现有习题库与题源 | 训练校准源 | 校准单元训练强度、题型边界与例题难度 | 倒逼大纲越界、把“能出题”误当“该讲到” |

## 3. 基本原则

1. 先服从单元能力边界，再决定是否接入资源。
2. 资源只提供候选证据、候选图示和候选场景，不直接决定课程结构。
3. 不要求每个单元都同时接入 `pptx + 思政 + 船舶 + 习题` 四类资源；没有合适资源时，应明确写“本单元不强行接入”。
4. 凡从资源库吸收的公式、图示、结论和案例，都仍需服从现有技能约束：控制计算用 `python3 + control` 验证，线框图走 `tikz-control-draw`，讲义主线必须重写。
5. 资源使用必须可追溯，至少能回答“来自哪里、为什么用、用在什么位置、为什么没直接照搬”。

## 4. 正式读取顺序

### 4.1 大纲重构场景

1. 先读 `course-content/syllabus-refactor/` 现行蓝图文件。
2. 再读本文件，明确资源角色与筛选规则。
3. 先读统一转译层：`course-content/resource-library/indexes/syllabus-fusion-map.md`。
4. 再按任务层级选择性读取资源索引：
   - `pptx`：`course-content/resource-library/pptx/README.md`
   - 思政：`course-content/resource-library/civics-cases/integration-points.md`
   - 思政映射：`course-content/resource-library/civics-cases/indexes/unit-mapping.md`
   - 船舶：`course-content/resource-library/ship-control-cases/indexes/section-map.md`
5. 只有在候选资源通过边界审查后，才下钻到具体 `README.md`、`extracted.md`、`cases/*.md`、`sections/*.md`。

### 4.2 课程制作场景

1. 先读单元边界：`module-skeletons.md`、`unit-design-details.md`、对应 `module*.md`。
2. 再读本文件。
3. 先查 `course-content/resource-library/indexes/syllabus-fusion-map.md`，锁定候选资源簇。
4. 根据单元目标选择性读取：
   - `pptx/README.md` 与相关课件提取包的 `README.md` / `extracted.md`
   - `civics-cases/integration-points.md`、`indexes/unit-mapping.md` 与相关案例文件
   - `ship-control-cases/indexes/section-map.md` 与相关章节文件
5. 选材完成后，才开始写讲义、教案、互动页和媒体规格。

## 5. 单元级资源评审单

当任务进入模块、单元或 2 学时课堂时，必须先形成一张“资源评审单”。推荐字段如下：

| 字段 | 含义 |
| --- | --- |
| `source_path` | 资源来源文件路径 |
| `resource_type` | `pptx` / `civics` / `ship-case` / `exercise` |
| `target_unit` | 拟接入的模块/单元/课次 |
| `use_position` | 导入 / 正文 / 例题 / 对比 / 总结 / 互动任务 / 拓展 / 练习 |
| `usage_mode` | `改写吸收` / `直接复用图片` / `仅作灵感` / `暂不采用` |
| `adoption_level` | `必融入` / `可选融入` / `排除` |
| `boundary_note` | 为什么适合或为什么不适合当前边界 |

## 6. 产物级转写规则

| 产物 | 优先吸收资源 | 推荐转写方式 | 禁止做法 |
| --- | --- | --- | --- |
| `handout.md` | `pptx`、船舶案例、部分思政 | 把图示骨架、案例片段、例题组织改写成当前单元主线中的段落、图注和例题 | 直接照抄旧课件页序、直接粘贴案例原文 |
| `boppps.md` | 思政案例、船舶案例、习题资源 | 写成导入提问、误判点、讨论任务、课堂收束语 | 把思政案例写成脱离专业内容的独立段落 |
| `interactive-page.md` | `pptx` 图示、船舶场景、精选习题 | 把值得互动的比较、预测、验证、读图任务做成页面步骤 | 把所有资源都变成“展示卡片”，没有教学动作 |
| `multimedia.md` | `pptx` 图、船舶案例图、既有媒体 | 规划重绘、复用、再验证和新媒体制作 | 直接引用低质量旧图且不做版面检查 |
| 练习/作业 | 既有习题、船舶案例数据 | 在当前边界内改编题面、参数、场景 | 用后续模块知识给当前单元出题 |

## 7. 模块级推荐倾向

| 模块 | 优先资源 | 推荐策略 |
| --- | --- | --- |
| 模块1 | `pptx`、轻量思政 | 用于总图建立、导入表达和课程气质，不堆砌细节 |
| 模块2 | `pptx`、船舶建模/时域/频域案例、基础习题 | 强化对象建立链，优先服务建模对象、时域对象、频域对象、图形对象 |
| 模块3 | 根轨迹/零极点/稳态误差相关 `pptx`、船舶根轨迹与频域案例 | 服务结构机理层的读图、对比、机理翻译 |
| 模块4 | 校正类 `pptx`、船舶频域校正案例、设计型习题 | 服务选型、初始方案、失败诊断和优化比较 |
| 模块5 | 船舶非线性/离散案例、边界型思政材料 | 服务边界意识、方法迁移与前沿比较，而不是补经典主干 |

## 8. 当前可直接利用的现有索引

- `course-content/resource-library/indexes/syllabus-fusion-map.md`
- `course-content/resource-library/pptx/README.md`
- `course-content/resource-library/civics-cases/integration-points.md`
- `course-content/resource-library/civics-cases/indexes/unit-mapping.md`
- `course-content/resource-library/ship-control-cases/indexes/section-map.md`

其中 `syllabus-fusion-map.md` 是正式入口，其他索引作为下钻层使用。后续如需更强自动化，再增补统一 `integration-registry`。

## 9. 最低追溯要求

无论在大纲重构还是课程制作中，只要采用了资源库内容，最终都至少要能追溯以下信息：

1. 资源来自哪个文件；
2. 采用的是哪种方式：改写吸收、直接复用图片、仅作灵感；
3. 落在了哪个产物、哪个位置；
4. 为什么没有直接照搬原资源。
