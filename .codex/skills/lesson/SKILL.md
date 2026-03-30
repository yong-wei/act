---
name: lesson
description: 面向“自动控制原理”课程创作完整教学内容包——讲义、知识图谱节点、BOPPPS 课案、互动页面蓝图与多模态资源；在正式制作前先执行运行时知识图谱与知识卡片到作者态的全量同步、合并与冲突检测，并按 `course-content/syllabus-refactor/module-skeletons.md` 与 `unit-design-details/` 的最新边界生成新编号课次。当用户提到要创作、写、生成某个单元或课次（如“2-2”“4-1”“下一单元”），或要求生成 handout/讲义、BOPPPS/教案、interactive-page/互动课、知识节点、多媒体资源、时域/频域/根轨迹图、方框图/信号流图/电路图/机械结构图中任何一项时，都应激活本技能；创作时需遵守 `$`/`$$` 公式规范、LaTeX 渲染、`python control` 验证与 `tikz-control-draw` 线框图流程。
---

# lesson — 自动控制原理课程内容创作技能

## 产物体系（按依赖顺序）

### 理论课（默认课型）

```
讲义（核心基础）
    ├── 知识图谱与知识卡片（manifest / graph / sequence）
    ├── BOPPPS 课案
    ├── 互动页面蓝图（直接引用图谱与卡片编排）
    └── 多模态资源 + AI 提示词
```

### 实践课（课型标注为“实践”时）

```
讲义（同样是核心主线）
    ├── 知识图谱与知识卡片（manifest / graph / sequence）
    ├── BOPPPS 课案（明确不少于 45 分钟学生实践训练）
    ├── 互动页面蓝图（用步骤与工作区承接实践训练）
    └── 多模态资源 + 平台模块约束说明（按需要制作，不默认跳过）
```

**保存路径**：`course-content/authoring/lessons/[单元编号]/design/`（`handout.md` / `boppps.md` / `interactive-page.md` / `multimedia.md`）
**讲义双产物**：学生版讲义固定为 `handout.md` / `handout.pdf`，教师版课堂讲义固定为 `teacher-handout.md` / `teacher-handout.pdf`
**图谱数据**：`course-content/authoring/lessons/[单元编号]/graph/`（`nodes.jsonl` / `relations.jsonl`）
**媒体文件**：`course-content/authoring/lessons/[单元编号]/media/raw/` 和 `media/processed/`
**Legacy 来源**：旧编号来源组统一放在 `course-content/authoring/lessons/legacy/`，只作为参考源，不再作为主线产物目录。

---

## 协作原则

以**教育学家 + 自动控制原理教学专家**双重身份参与协作：
- **不全盘接受用户提案**——主动指出认知负担、逻辑跳跃、内容冗余
- **基于证据反驳**——给出认知科学依据或课程整体一致性论据，并提供替代方案
- **区分用户偏好与教学效果**——教师有时倾向展示高级内容，但本课程面向零基础工科生，“先见森林”的直觉理解优先于“所有细节都精确”

**AI 融入点设计标准**（讲义中的 `[AI融入点]` 必须遵循）：
> 学生自主预测 -> 向 AI 提问并对比 -> AI 生成验证 -> 反思修正
> AI 定位为**思维激发器和计算工具**，学生始终是判断主体。

---

## 本技能新增硬约束（默认适用于讲义 / 教案 / 互动课 / 媒体）

1. **讲义必须独立可读**
   - 讲义必须写成学生脱离课堂也能独立学习的正文，不能把关键定义、推导说明、工程解释、能力训练转嫁给 PPT、教师口述或互动页面。
   - 讲义必须同时承担**知识详解**与**能力训练**两类任务：不仅解释“是什么/为什么”，还要安排“怎么算/怎么判断/怎么迁移”。
   - 即使课型标注为“实践”，也不得把讲义降格为任务单、操作清单或教师备注；实践课仍以讲义作为课程主线载体。
2. **实践课必须显式给出 45 分钟以上学生实践训练**
   - 若 `manifest.json` 中课型为“实践”，则课堂中学生亲自参与并进行实践训练的累计时间必须不少于 45 分钟。
   - 这 45 分钟以上的训练时间必须同时在 `design/boppps.md` 与 `design/interactive-page.md` 中可追踪，不能只停留在一句口头说明。
   - 计入这 45 分钟的只能是学生实际操作、观察、判断、记录、对比、修正、提交等参与式训练；教师讲授、教师演示、课堂等待、课后自学均不计入。
3. **范文只借文风，不借内容**
   - 生成讲义前，先读取 `course-content/authoring/lessons/legacy/L-2a/design/handout.md`。
   - 读取后只保留对文风的抽象感受，例如“叙述节奏、通俗程度、工程引入方式、图表配合方式”，不得照抄其结构、句子、例题、段落顺序或具体论证。
   - 最安全做法：先用 3-5 条简短语句概括文风特征，再按当前单元真实内容重新写作。
4. **公式统一规范**
   - 所有文档中，行内公式一律使用 `$...$`，行间公式一律使用 `$$...$$`。
   - 互动课程文档中的全部公式都必须按 LaTeX 形式书写，默认交给页面侧 KaTeX/LaTeX 渲染，不允许混用纯文本近似公式。
5. **计算与仿真必须可验证**
   - 讲义、教案、互动课、媒体中凡涉及控制系统计算、时域响应、频域响应、根轨迹、Bode 图、Nyquist 图、极点零点、稳定性结论、性能指标数值者，必须用 `Octave` 做数值验证。
   - 课程中的主要数值曲线统一采用 `Octave` 绘制；例题等涉及到计算的内容，也必须使用 `Octave` 验证，不能只凭手算或口头判断。
   - 进行出图和核验时，默认优先使用 `Octave` / control 包的原生高层函数，例如 `step()`、`bode()`、`nyquist()`、`rlocus()`、`lsim()`、`margin()` 等；除非原生函数确实无法覆盖需求，否则不得下滑到手写底层数值积分、手搓频率响应或自造同类绘图函数。
   - 讲义中给出的参考代码，默认必须是 `MATLAB/Octave` 形式。
6. **线框图必须走专用技能**
   - 凡涉及方框图、信号流图、电路图、机械结构图等线框图，必须显式调用 `tikz-control-draw` 技能生成，不得改用随手绘图、截图或普通 matplotlib 草图替代。
7. **互动课必须先立住完整课件**
   - 互动课程首先是课堂 PPT 的互动延伸板，不是脱离讲义另起炉灶的活动脚本；必须先满足传统课件的基本职责：标题层级、概念、公式、表格、图示、例题、结论都要完整可读。
   - 讲义中的核心概念、核心公式、关键图表、关键例题与关键结论，必须在互动课程中逐项落到具体页面，不能以“见讲义”“教师口述”或“实现时再补”替代。
   - 允许纯静态页面承担知识展示；凡暂时不值得做互动升级的核心内容，可以直接做静态展示页，不强制每页都带交互控件。
   - 页面总数按教学逻辑决定，不设固定上限；不得为了压到某个页数范围而删减核心内容。
   - 在保留课件骨架的基础上，只把最值得互动升级的位置做成预测、探索、对比、即时反馈、前后测或工作区操作。
8. **讲义围绕单一主线展开**
   - 讲义必须围绕当前单元主题组织为一条清晰的逻辑链，避免知识点并列堆放、想到哪写到哪。
   - 若存在复杂但必要的长推导、补充证明、扩展讨论，可收纳到附录，正文只保留服务主线所必需的版本。
9. **所有图像禁止 ASCII 图**
   - 所有产出物中的图像、示意图、结构图、响应图、卡片直觉图都必须使用真实媒体资源，不得使用 ASCII 字符图、字符框图或字符波形替代。
   - 合法来源只有两类：代码直出图（含 `Octave`、TikZ 等生成结果）或 AI 生成图。
   - 若暂未完成媒体制作，可写规范化图片占位符与制作说明，但最终交付文档不得把 ASCII 图当正式内容保留下来。
10. **媒体必须达到出版级成图质量**
   - 每张正式媒体都必须在导出后做成品检查：字符正确、公式可读、中文不乱码、标注不互相遮挡、关键元素不被裁切、箭头与连线不误指、留白与层次清晰。
   - 不接受“内容大致对但版式挤在一起”的图；遮挡、错误截断、文本压线、图例挤压、标注歧义都视为未完成。
   - 制作时如有必要，应通过重新布局、分栏、侧边说明框、缩短标注链路、调整留白，避免只靠缩小字号硬塞。
11. **媒体命名必须统一带单元前缀**
   - 所有媒体成品都必须采用 `[单元编号]-{资源名}` 的统一命名方式，包括 AI 生成图、信息图、生成式课件 PDF、导入视频、课程视频、播客音频、代码直出图与线框图。
   - 例如：`2-1-cover-comic.png`、`2-1-info.png`、`2-1-slides.pdf`、`2-1-intro-video.mp4`、`2-1-course.mp4`、`2-1-audio.m4a`、`2-1-fd-01-bode-overview.svg`。
   - 不允许最终交付中混用无前缀旧命名，如 `cover-comic.png`、`info.png`、`fd-01-*.svg`。
12. **讲义必须导出正式 PDF**
   - 学生版讲义与教师版课堂讲义在各自 Markdown 定稿后，都必须继续导出同目录 PDF，不接受“只交 Markdown”作为最终讲义完成态。
   - 默认使用 `.codex/skills/lesson/scripts/export_handout_pdf.py` 与技能统一样式模板，不得每课临时手拼不同导出命令和样式。
   - `handout.pdf` 与 `teacher-handout.pdf` 必须共用同一套技能模板，只允许通过页眉右侧文字和 PDF 标题做最小差异化。
13. **PDF 版面必须抽样复核**
   - 学生版和教师版 PDF 导出后，都至少抽查首页、图表页、公式密集页、附录代码页四类页面；若教师版无附录代码页，则改查一页板书/课堂组织页。
   - 若发现字体缺失、图形裁切、标注遮挡、代码块越界、页眉页脚错位、页码异常，则讲义仍视为未完成。
14. **讲义完成后先做图谱与知识卡片**
   - 学生版与教师版 PDF 抽查通过后，下一步固定进入 Step 5，先完成 `manifest.json`、`graph/nodes.jsonl`、`graph/relations.jsonl`、`sequence.json` 与知识卡片。
   - Step 5 是 Step 6 和 Step 7 的共同前置输入。图谱与知识卡片未完成时，不进入 BOPPPS 和互动页面设计。
   - 互动页面中的步骤分组、焦点节点、卡片顺序与节点引用，默认直接取自 Step 5 的 `manifest.json` 与 `sequence.json`，保持课堂主线、图谱主线和卡片主线一致。
15. **资源库只作候选源，不直接拼贴成课**
   - 正式创作前必须读取 `course-content/resource-library/integration-framework.md`。
   - 应根据当前单元目标，选择性读取 `pptx`、`civics-cases`、`ship-control-cases` 的索引和正文，避免整包通读。
   - 每项资源都必须标记 `改写吸收 / 直接复用图片 / 仅作灵感 / 排除` 之一。
   - 不得把旧 `PPT` 的页序、案例库原文或船舶案例章节直接拼接成讲义或互动页正文。

---

## 课程框架速查

### 课程结构真值来源

每次创作、续写、修订前，必须依次读取以下文件：

1. `course-content/syllabus-refactor/module-skeletons.md`
2. `course-content/syllabus-refactor/unit-design-details.md`
3. 对应模块的 `course-content/syllabus-refactor/unit-design-details/module<1|2|3|4|5>.md`
4. `course-content/authoring/shared/lesson-id-map.json`

其中：
- `module-skeletons.md` 决定单元骨架、课型、学时和主线位置。
- `unit-design-details/module*.md` 决定该单元的四类产物边界与设计原则。
- `lesson-id-map.json` 决定新编号、legacy 来源组、归档路径与可否生成。
- `course-content/resource-library/integration-framework.md` 决定资源选材顺序、采用级别与产物级转写边界。

### 课次编号规则

- 主线新课次统一使用新编号，如 `2-2`、`3-5`、`4-1`。
- `course-content/authoring/lessons/legacy/*` 下的旧课只作为来源组或临时参考，不作为主线生成目标。
- 若用户输入旧编号，先查 `course-content/authoring/shared/lesson-id-map.json`：
  - 若映射到主线课次，如旧 `1-3` -> 新 `2-2`，则按主线课次继续。
  - 若状态为 `legacy_source` 或 `blocked`，必须先说明它在新体系中的位置，再决定是否允许继续。
- 模块1与模块5在未补齐对应 `unit-design-details/module1.md`、`module5.md` 前，一律不允许按新编号正式生成。

### 知识分类 [C/X/D]

| 类型 | 特征 | 教学策略 |
|------|------|----------|
| **[C] 计算型** | 步骤明确、算法封闭 | 讲练结合，习题强化，AI 辅助验证 |
| **[X] 跨域型** | 跨域映射、重关系理解 | 多表征联动，“一动全动”体验 |
| **[D] 设计型** | 多目标权衡、无唯一解 | 工程任务驱动，试错 -> AI -> 再设计循环 |

### 核心地标

- **平台**：AI-OBE 船舶智控平台（极点 / 时域 / 频域三面板联动）
- **工程场景**：船舶航向控制（贯穿全课程）
- **三域联动公式**：`zeta -> M_p -> gamma ≈ 100zeta°`；`omega_n -> t_s -> omega_b`

### 5 条设计约束（及其教育学依据）

1. **层次切换**：进入新层次时，用“上一阶段我们用直觉看到了 [X]，今天我们来理解它是怎么来的”——学生需要感知自己从“感性认知”跨越到“形式化证明”，这种跨越需要显式桥接才不会脱节。
2. **承诺兑现**：legacy 速通课中的“先用不推导”之处，标注“-> 完整推导见新单元 X-X”——旧速通内容如不给出后续指引，学生会形成错误的概念闭合感，后续课程铺垫失效。
3. **AI 触点持续**：每节讲义必须在适当位置标注 `[AI融入点]`——AI 负责思维激发与计算验证，学生负责预测、比较和判断。
4. **习题课对齐**：习题课 1 -> [C]，习题课 2 -> [X]，习题课 3 -> [D]，不可混用——三种知识类型需要不同的认知模式，混用会导致学生无法建立正确的迁移路径。
5. **图谱定位**：每节开场必须有“回到地图，我们现在在这里”环节——开场的知识地图回顾帮助学生激活已有知识网络，降低新知识的孤立感和认知负担。

---

## 制作前前置步骤（每次正式创作前都执行）

> 详细规则见 `references/preflight-runtime-sync.md`。

1. 先检查运行时知识与作者态知识的差异：
   ```bash
   python3 .codex/skills/lesson/scripts/sync_runtime_knowledge.py --check
   ```
2. 若输出显示**存在冲突**，必须立即停止课程制作，向用户展示冲突清单并讨论处理方式；**不得自动覆盖**。
3. 若输出显示仅有可安全合并项、没有冲突，则执行正式合并：
   ```bash
   python3 .codex/skills/lesson/scripts/sync_runtime_knowledge.py
   ```
4. 合并完成后，再进入本技能后续流程。此时默认以 `authoring/knowledge` 中的最新作者态图谱作为课程制作参考源。

---

## 工作流：8 步创作流程

> **续接会话快速入口**：如果用户说“继续上次”“从 Step X 开始”或指定具体步骤，跳过前置步骤直接进入。续接时先确认当前产物状态（读取对应 `design/` 目录中已有文件），再继续。

### Step 0｜技能初始化（首次或重新初始化时）

1. 确认已完成“制作前前置步骤”中的运行时知识同步。
2. 读取 `course-content/syllabus-refactor/module-skeletons.md`，展示课程总体结构摘要。
3. 读取 `course-content/authoring/shared/lesson-id-map.json`，确认当前输入课次是主线课次、legacy 来源组还是阻断项。
4. 若目标单元属于模块2/3/4，再读取对应的 `unit-design-details/module*.md`。
5. 若目标单元属于模块1或模块5，且不存在对应 `unit-design-details/module1.md` 或 `module5.md`，立即停止并告知用户“该模块尚未具备正式创作边界文稿，当前阻断生成”。
6. 运行图谱统计：
   ```bash
   python3 .codex/skills/lesson/scripts/kg_query.py stats
   ```
7. 提示用户说“开始创作单元 X-X”。

### Step 1｜课程元数据确认

从 `course-content/syllabus-refactor/module-skeletons.md` 和对应 `unit-design-details/module*.md` 提取当前单元信息，展示：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
单元 [编号]：[标题]
课型 / 学时 / 知识类型 [C/X/D] / 教学目标代码
教学重点 / 工程导入线索
与前课衔接 / 与后课铺垫
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

请用户确认，确认后进入 Step 2。

**⚠️ 如课型为“实践”**：确认后额外读取 `references/practice-lesson.md` 作为补充约束，然后继续执行标准 Step 2 ~ 8；不再切换到“任务书替代讲义”的旧工作流。
**⚠️ 如课次状态在 `lesson-id-map.json` 中偏离 `mainline`**：先说明其是 legacy 来源还是阻断项，不得直接按旧编号生成主线产物。

### Step 2｜资源选材与采用单

在进入概念设计前，必须先读取 `course-content/resource-library/integration-framework.md`，并按当前单元目标选择性读取以下索引与正文：

- `pptx`：`course-content/resource-library/pptx/README.md`，以及相关提取包的 `README.md` / `extracted.md`
- 思政：`course-content/resource-library/civics-cases/integration-points.md`、`course-content/resource-library/civics-cases/indexes/unit-mapping.md`，以及相关案例文件
- 船舶：`course-content/resource-library/ship-control-cases/indexes/section-map.md`，以及相关章节文件

输出一张**本课资源采用单**，至少包含：

1. **候选资源路径**
2. **资源类型**（`pptx / civics / ship-case / exercise`）
3. **计划落点**（导入 / 正文 / 例题 / 互动 / 总结 / 练习 / 媒体）
4. **采用方式**（`改写吸收 / 直接复用图片 / 仅作灵感 / 排除`）
5. **采用级别**（`必融入 / 可选融入 / 排除`）
6. **边界说明**（为什么适合当前单元，或为什么暂不采用）

若三类资源都不适合当前单元，必须明确写出“本课不强行接入资源库内容”的理由，避免机械凑数。

请用户确认采用单后进入 Step 3。

### Step 3｜概念结构设计（协商）

输出：
1. **核心概念清单**（3-6 个，按层次排序）
2. **前置知识依赖**
3. **新增图谱节点预估列表**
4. **概念层次图**（文本层级结构，如缩进列表或树状条目，不作为正式图片资源）

请用户确认框架后进入 Step 4。

### Step 4｜讲义文档生成（学生版 -> 教师版）

> **读取参考文件**：`references/step3-handout.md`（含完整结构规格、各类型要求、例题规范）

Step 4 只负责讲义流程编排，讲义结构、基本信息写法、封面/信息图占位、例题要求、附录规则、PDF 导出与抽查等细则，统一以 `references/step3-handout.md` 为准，不在主技能中重复展开。

执行 Step 4 时，资源转写还必须满足：

- `pptx` 资源只能吸收其图示骨架、解释顺序、例题组织或可复用图片，不得直接沿用整套页序。
- 思政资源只能嵌入专业判断、系统观念、工程责任或技术边界相关位置，不得把案例原文整段塞进讲义。
- 船舶资源优先作为工程导入、例题背景、参数对比或跨域分析锚点，必须重新写进当前单元主线。

执行顺序固定为：

1. 读取 `references/step3-handout.md`，按其中规则先生成学生版讲义 `handout.md`。
2. 学生版讲义按参考文件要求分章节推进；每完成一个主要章节后提示用户确认，再继续。
3. 学生版讲义确认后，按参考文件中的导出规范生成并抽查 `handout.pdf`。
4. 学生版 PDF 通过确认后，再生成教师版课堂讲义 `teacher-handout.md`。
5. 教师版课堂讲义确认后，按参考文件中的导出规范生成并抽查 `teacher-handout.pdf`。
6. 两版讲义 PDF 抽查通过后，立即进入 Step 5；后续 BOPPPS 与互动页都以 Step 5 产物为准。

### Step 5｜知识图谱节点设计

> **读取参考文件**：`references/step4-knowledge-graph.md`（含 JSON 格式、脚本命令、关系类型表）

Step 5 在流程中的角色固定为“讲义完成后的第一个下游步骤”。完成 Step 5 后，Step 6 与 Step 7 才具备稳定输入。

**产物结构（新形态标准）**：

| 产物 | 路径 | 说明 |
|------|------|------|
| `manifest.json` | `course-content/authoring/lessons/[单元]/manifest.json` | 含 `focus_node_ids` / `reuse_node_ids` / `card_order` / `entry_nodes` / `summary_nodes` / `preceding_lesson` / `following_lesson` / `refinement_units`；**不含** `runtime` / `cards` 字段 |
| `sequence.json` | `course-content/authoring/knowledge/cards/lessons/[单元]/sequence.json` | 含 `groups`（每组含 `step_ids` / `node_ids`）+ `card_order` |
| `graph/nodes.jsonl` | `course-content/authoring/lessons/[单元]/graph/nodes.jsonl` | 仅本课次**新增**节点（不含复用节点） |
| `graph/relations.jsonl` | `course-content/authoring/lessons/[单元]/graph/relations.jsonl` | 所有新关系（含与复用节点的关系） |

> **注意**：不生成 `card-refs.json`（该文件已废弃，信息已合入 manifest）；不在 `course-content/authoring/lessons/[单元]/cards/` 下生成 `sequence.json`。

**顺序锁定**：

1. 讲义双 PDF 抽查通过后，先完成本节 `manifest.json`、`sequence.json`、新增图谱与知识卡片。
2. `manifest.json` 与 `sequence.json` 缺失时，停止 Step 6 和 Step 7。
3. 互动页与后续实现默认引用 `focus_node_ids`、`reuse_node_ids`、`entry_nodes`、`summary_nodes`、`card_order` 与 `groups[].step_ids / node_ids`。

### Step 6｜BOPPPS 课案设计

> **读取参考文件**：`references/step5-boppps.md`（含完整输出格式、各类型 P2 模板、AI 融入时机标注）

基于已确认讲义进行课案设计。课案是讲义的课堂展开版，不另起炉灶。

执行 Step 6 时，额外强制要求：

1. 课案必须从讲义中抽取**核心逻辑线、知识线、能力线**，保持与讲义同一主线。
2. 课案必须以**课堂时间约束**为边界，明确每一段为什么值得占用课堂时间。
3. 课案必须以**平台功能**为依托，说明哪些内容适合教师讲授、哪些适合学生在平台中探索、哪些适合 AI 对照验证。
4. 课案必须显式考虑学生常见反应：哪里可能听不懂、哪里会误判、哪里会无聊、哪里需要互动拉回注意力。
5. 若课案中引用计算结论、图像或表格，默认追溯到讲义里的已验证版本，不得新造一套未经核验的数据。
6. 若本课接入思政或船舶案例，优先在导入、过渡、比较与总结中使用，不得把案例阅读本身挤占课堂主线。

### Step 7｜互动页面设计

> **读取参考文件**：`references/step6-interactive-page.md`（含平台技术背景、设计哲学、步骤类型、输出格式）

**两阶段工作流**：先输出步骤列表框架供确认，再逐步补全每步骤完整文案。

执行 Step 7 时，额外强制要求：

1. 互动页面首先是完整课件，其次才是互动体验；不得为了“网页感”删掉传统课件必需的公式、表格、分级标题、例题、图示与结论。
2. Step 7 开始前，先从 `design/handout.md` 抽取“讲义核心内容映射”总表，至少覆盖核心概念、核心公式、关键图表、关键例题、关键结论。
3. 该总表默认使用以下列名：`handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note`。其中逐步正文仍需额外写清“静态承载内容”“互动升级点”。
4. “讲义核心内容映射”中的每一项都必须在 `interactive-page.md` 中找到对应页面；若该项无需互动升级，`interaction_upgrade` 明确写“无，保持静态展示”，不得因无互动而缺页。
5. 互动升级应选择真正值得交互的位置，例如预测前后差异、参数变化导致的现象变化、结构改动导致的系统差异，避免把所有内容都做成交互控件。
6. 页面文案必须能脱离教师口述单独阅读，不能写成只剩提示词和按钮标签的空心页面。
7. 全部公式必须写成 LaTeX，并遵守 `$` / `$$` 规范。
8. `pptx` 图示与船舶案例若被接入互动页，必须转写成“预测、比较、读图、验证、诊断”之一，避免静态堆叠素材卡。
9. Step 7 开始前，先读取 Step 5 产出的 `course-content/authoring/lessons/[单元]/manifest.json` 与 `course-content/authoring/knowledge/cards/lessons/[单元]/sequence.json`。互动页步骤分组、焦点节点、卡片顺序与课堂收束节点直接引用这些文件，不再额外发明一套节点编排。

文档写入 `course-content/authoring/lessons/[单元]/design/interactive-page.md`。

### Step 8｜多模态资源设计

> **读取参考文件**：
> - `references/step7-multimedia.md`（多媒体总入口：工作流、命名、回写与选型）
> - `references/step7-multimedia-codegen.md`（代码直出媒体：`Octave`、TikZ、互动前端绘制）
> - `references/step7-multimedia-ai.md`（AI 生成式媒体：封面漫画、位图、视频、即梦与 agent 模式）

**三阶段工作流**：
1. **扫描**：同时读取 `design/handout.md` 和 `design/interactive-page.md`，输出资源总表供用户确认优先级。
2. **生成**：按优先级逐项输出制作规格（代码直出图 / 位图 / 互动前端绘制需求 / 视频）。
3. **回写**：将媒体引用路径 `![图注](../media/processed/{文件名})` 插入对应文档对应位置；互动前端绘制需求在 `interactive-page.md` 对应步骤标注 `[前端绘制]`。所有 `{文件名}` 都必须采用 `[单元编号]-{资源名}` 形式。

执行 Step 8 时，额外强制要求：

1. 代码直出媒体、TikZ 线框图、互动前端绘制需求，统一按 `references/step7-multimedia-codegen.md` 执行；AI 位图、封面漫画、导入视频、课程视频与即梦提示词，统一按 `references/step7-multimedia-ai.md` 执行。
2. 线框图资源（方框图、信号流图、电路图、机械结构图）必须调用 `tikz-control-draw` 技能；时域响应、频域响应、根轨迹、Nyquist/Bode、稳定域、参数扫描等控制图必须使用 `Octave` 进行仿真、计算与出图。
3. 若互动页中的图只是静态展示，也应优先沿用已验证的讲义/媒体结果，避免重复造图并引入不一致。
4. 每张媒体导出后，必须逐张检查字符正确、遮挡、错误截断、元素越界、图例拥挤、箭头误指与整体留白，目标是最终形成规范的出版级配图。
5. 所有媒体文件都必须统一采用 `[单元编号]-{资源名}` 命名，包括 AI 媒体、代码直出图、线框图、PDF、视频和音频；例如 `2-1-cover-comic.png`、`2-1-info.png`、`2-1-slides.pdf`、`2-1-intro-video.mp4`、`2-1-course.mp4`、`2-1-audio.m4a`、`2-1-fd-01-bode-overview.svg`。
6. 媒体制作阶段对课程级 AI 资源的硬交付只包括**提示词与制作规格**。其中封面漫画交付 `cover-comic-prompt.md`，15 秒导入视频交付分镜图提示词、图生视频提示词与 Agent 模式提示词；`{unit}-cover-comic.png`、`{unit}-intro-video.mp4`、`{unit}-info.png`、`{unit}-slides.pdf`、`{unit}-audio.m4a` 不属于本阶段必须生成的成品。
7. `slides.pdf`、`cover-comic.png`、`info.png`、`intro-video.mp4`、`audio.m4a` 在用户后续自行制作完成后，再进入审查阶段确认可用性；媒体制作阶段只需在规划文档中保留命名、用途和审查入口。
8. 若交付 AI 提示词，默认优先交付可直接投喂中文平台的**中文定稿提示词**；即梦导入视频除常规“分镜图生成提示词”和“图生视频提示词”外，还必须补一段“Agent 模式视频生成提示词”，只保留故事情节主线，不写细风格与配乐。
9. 若资源库中已有高质量提取图或可重绘骨架，可直接在媒体规划中登记“复用原图 / 依据原图重绘 / 仅保留信息结构”三种处理方式之一，但最终仍要经过版面与正确性复核。

### 收尾验证（Step 8 完成后必须执行）

检查以下结构是否与新形态对齐，逐项确认：

1. `manifest.json` 含 `focus_node_ids` / `reuse_node_ids` / `card_order` / `preceding_lesson` / `following_lesson` / `refinement_units`（均为 `snake_case`）。
2. `course-content/authoring/knowledge/cards/lessons/[单元]/sequence.json` 存在，且各 group 含 `step_ids` 字段。
3. `course-content/authoring/lessons/[单元]/cards/` 目录不存在（或为空），lesson 级 `sequence.json` 不存在。
4. `course-content/authoring/lessons/[单元]/graph/card-refs.json` 不存在。
5. **图谱增量镜像同步**：运行以下脚本，确认 `authoring/knowledge/overlays/[单元]/` 与 `authoring/lessons/[单元]/graph/` 保持一致：
   ```bash
   python3 .codex/skills/lesson/scripts/sync_overlays.py [单元] --check
   ```
   若有差异，执行同步（去掉 `--check` 参数）：
   ```bash
   python3 .codex/skills/lesson/scripts/sync_overlays.py [单元]
   ```

若有不对齐项，列出清单并询问用户是否一并修复。

---

## 常见误用与返工红旗

### 常见误用

| 误用 | 正确做法 |
|------|----------|
| 读完范文后沿用其段落结构或例题 | 只提炼文风特征，再按当前单元重写 |
| 把讲义写成“课堂讲稿摘要”，把关键解释放到课上再说 | 讲义必须保持学生可独立阅读，关键解释不能转嫁给课堂口述 |
| 学生版讲义一确认就直接进入下游，不导出 PDF | 必须先导出并抽查学生版 PDF，再进入教师版课堂讲义 |
| 双版讲义一完成就先写互动页，再回头补图谱和卡片 | 先完成 Step 5 的 `manifest / graph / sequence / cards`，再进入 BOPPPS 与互动页 |
| 教师版课堂讲义另用一套自定义 PDF 风格 | 教师版与学生版必须共用同一模板，只做最小元数据差异 |
| 互动课只写互动环节，不写完整课件骨架 | 先保证标题、正文、公式、表格、例题完整，再升级局部互动 |
| 互动页自己重排节点顺序与分组 | 直接引用 Step 5 的 `focus_node_ids`、`card_order` 与 `sequence.json` |
| 公式混用 `$`、`\(`、裸文本 | 全部统一为行内 `$`、行间 `$$` |
| 只凭经验给出响应曲线、根轨迹或性能指标 | 先用 `Octave` 原生函数脚本验证 |
| 用普通绘图或截图处理方框图/信号流图 | 必须调用 `tikz-control-draw` |
| 讲义完成后只交 Markdown，不导出正式 PDF | 必须使用技能统一脚本和模板导出同目录 PDF |

### 返工红旗

出现以下任一情况，应停止下游步骤并返工上游内容：

- 讲义缺少关键知识解释，学生离开课堂无法独立学习
- 讲义只有知识讲解，没有能力训练、例题或判断任务
- 教案与讲义主线脱节，像是另起炉灶
- 互动页面缺少基本课件要素，只剩互动提示
- 公式未统一成 `$` / `$$`
- 控制结论未见 `Octave` 验证
- 本可直接用 `step()`、`bode()`、`nyquist()`、`rlocus()`、`lsim()`、`margin()` 却改为手写底层计算
- 线框图未走 `tikz-control-draw`
- 学生版 PDF 未导出即开始教师版课堂讲义
- 教师版 PDF 未导出，或两个 PDF 未按统一模板检查首页/图表页/公式页/代码页

---

## 跨单元连续性维护

每次创作时：
1. 在 `course-content/notes/overview.md` 中更新单元完成状态。
2. 新节点与已有节点的关系必须明确（不孤立）。
3. 关键术语（极点、传递函数等）在各讲义间保持一致表述。
4. 每课开场用一句话回顾上一课核心输出。

---

## 错误处理

| 情况 | 处理 |
|------|------|
| 单元编号不在大纲中 | 展示大纲单元列表供核对 |
| 单元编号是 legacy 来源组 | 先查 `course-content/authoring/shared/lesson-id-map.json`，说明其映射目标或归档位置，不直接按旧编号生成主线课 |
| 单元所在模块缺少 `unit-design-details` | 立即停止，提示先补齐对应模块的四类产物边界文稿 |
| 运行时知识同步发现冲突 | 立即停止制作，展示冲突清单，与用户讨论后再继续 |
| 图谱格式未初始化 | 运行 `kg_query.py stats` 获取现状 |
| 用户对某部分不满意 | 精确识别，局部重新生成，不重做整个步骤 |
| 实践课（如 `4-4`、`4-6`、legacy `L-2d` 来源） | 额外读取 `references/practice-lesson.md`，按其中“讲义主线 + ≥45 分钟实践训练”补充约束执行标准 Step 2 ~ 8 |

*版本：v4.2 | 2026-03-24*
