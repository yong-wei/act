---
name: interactive-lesson-implementation
description: Use when implementing or optimizing this repository's interactive lesson pages from `course-content/authoring/lessons/<lesson>/` design documents, especially for lesson-by-lesson page building, AI assistant context wiring, event tracking/data-governance alignment, media placeholder planning, design-vs-implementation gap analysis, or maintaining lesson implementation notes.
---

# Interactive Lesson Implementation

## Overview

按外部课程设计文档为本项目实现或优化互动课程页面。把 `course-content/authoring/lessons/<lesson>/` 视为设计源，把仓库中的实现视为待核对对象；优先复用现有框架、资源注册、AI 上下文、课程事件链、数据治理与会话同步能力，避免写成孤立页面。

**核心原则：**
- 先确认本课是否已经通过 `lesson-content-review` 审查；未审查时，先运行课程审查技能，不要在本技能里顺手修正文档、知识卡片或媒体脚本。
- 先确认课程与任务模式，再动手。
- 先核对设计稿与现状，再做实现计划。
- 媒体缺失必须显式提醒，不能默认“以后再补”。
- 设计稿里凡是可代码直出或可前端 SVG 绘制的图，优先在实现阶段直接落地，不留“后续补图”。
- 每个页面不仅要有视觉内容，还要有 AI 助手上下文、课程事件语义和学生反馈闭环。
- 互动课程的数据面必须进入统一治理链路；不要把“埋点以后再补”当作默认选项。
- 可以提出更好的交互方案，但必须先向用户说明原因并纳入计划。
- 实现完成后，必须回到设计文档做一次闭环核对，并更新本技能的课程笔记。

## Runtime First 约束

课程重构阶段，`L-2c` 结构是当前唯一正确结构。后续分析旧课次时，不再把旧目录样式当作规范，而是要反向对齐到 `L-2c` 的组织方式。

所有运行时课程资源统一以 `course-content/runtime` 为唯一来源。页面、接口、知识图谱、讲义、知识卡片都应优先从 runtime 读取；`authoring` 只作为制作源，不直接作为运行时依赖。

默认迁移路径：
1. 能脚本化迁移的内容，优先补到 `course-content/scripts/export-runtime.sh`（内部调用 `python3` 脚本）完成导出。
2. 不能自动迁移的内容，必须基于内容理解在 `course-content/runtime` 下重建，不允许停留在“以后人工补”。
3. 讲义保留 Markdown 原文到 runtime，再由页面渲染；不要在导出阶段把讲义改写成不可回溯的 HTML。

知识组织统一采用“全局 knowledge 统一来源 + lesson graph overlay 局部编排”：
- 全局节点唯一来源：`course-content/runtime/knowledge/graph/nodes.json`
- 全局关系唯一来源：`course-content/runtime/knowledge/graph/relations.jsonl`
- 节点卡片唯一来源：`course-content/runtime/knowledge/cards/nodes/`
- 课次局部结构与编排：`course-content/runtime/lessons/<lesson>/graph-overlay.json`、`lesson.json`

互动课程的新增样板优先参考：
- 结构与 runtime 首页组织：`L-2c`
- 理论型精品课的 AI / 埋点 / 反馈 / 课堂同步：`L-sum`

## 启动方式

技能加载后，如果用户没有明确说明“开始哪一课”或“优化哪一课”，先询问：

1. 你要开始设计新课，还是优化现有课？
   - `1. 开始新课设计（推荐）`
   - `2. 优化现有课程`
2. 课程是哪个课次？
   - 先列出 `.codex/skills/interactive-lesson-implementation/notes` 下可用目录，优先给出最相关的 2-3 个选项
   - 允许用户自定义输入

如果用户选择优化现有课，先读取 `notes/<lesson>.md`；若笔记不存在，先创建再继续。

## 工作流

### 1. 锁定设计源

页面实现阶段始终读取以下资料：
- `course-content/authoring/lessons/<lesson>/design/interactive-page.md`
- `course-content/runtime/lessons/<lesson>/lesson.json`
- `course-content/runtime/lessons/<lesson>/graph-overlay.json`
- `course-content/runtime/lessons/<lesson>/handout.md`
- `course-content/runtime/lessons/<lesson>/review/boppps.md`
- `course-content/runtime/lessons/<lesson>/review/review-report.md`
- `course-content/runtime/lessons/<lesson>/review/knowledge-card-check.json`
- `course-content/runtime/lessons/<lesson>/review/multimedia-check.json`

其中：
- `interactive-page.md` 负责页面步骤与交互设计
- runtime 下的 handout / boppps / knowledge / media review 产物视为**已审查输入**

不要在本技能里重新承担 `design/handout.md`、`design/practice-guide.md`、`design/assessment-spec.md`、知识卡片正文、`multimedia.md` 的技术审查职责；这些内容若有问题，应返回 `lesson-content-review` 处理。

### 2. 判断任务模式

#### 模式 A：开始新课设计

执行顺序：
1. 读取设计文档并提炼步骤、媒体、教师动作、学生动作、工作区需求、验证点。
2. 在仓库中定位最接近的现有课程实现，找出可复用的页面结构、工作区、埋点和服务。
3. 先给用户一个实现计划，再开始改代码。

#### 模式 B：优化现有课

执行顺序：
1. 读取本技能 `notes/<lesson>.md`。
2. 从笔记中取出：
   - 已实现部分
   - 已知差异
   - 待补媒体
   - 上次验证结论
3. 向用户确认本次优化范围。
4. 更新计划后再改代码。

### 3. 先做设计差异核对

在真正实现前，至少核对以下维度：
- 步骤数量、标题、顺序、时长是否一致
- 每一步是纯文本、静态图、视频、问答、测验还是仿真
- 教师端是否存在“播放 / 揭示 / 释放 / 汇总 / 抽答”等控制流
- 学生端是否形成“预测 -> 操作 -> 记录 -> 反馈”的个人认知链路
- 工作区是否按需出现，而不是机械复用同一种布局
- 课程资源是否真的落地为媒体或组件，而不是只剩说明文字

把差异先记入课程笔记，再进入实现。

对 runtime 课次额外核对：
- `authoring -> export-runtime.sh -> course-content/runtime -> 页面/接口` 文件链路是否闭合
- 课程首页是否真的消费 runtime，而不是偷偷回读 `authoring` 或 `content`
- 讲义中的图片、SVG、视频等媒体引用是否都改写为 `/course-runtime/...`
- 知识点网络是否来自 runtime 全局图 + lesson overlay，而不是页面内硬编码

### 3.5 先补页面级 AI / 数据 / 反馈设计

在开始实现前，针对每个步骤额外回答以下问题；没有答案就不要急着写页面：

- 这个步骤是否需要页内 AI 助手？如果需要：
  - 当前步骤的 `topic`、`learningObjectives`、`knowledgeType`、`quickQuestions`、`systemPromptExtension` 分别是什么
  - 该步骤的 AI 是解释概念、提示推理、还是做对照反思；不要全部写成泛化问答
- 这个步骤要产生哪些统一课程事件？
  - 至少判断是否包含 `lesson_step_view`、`lesson_step_leave`、`lesson_submit`、`lesson_resubmit`、`workspace_param_change`、`ai_panel_open`、`ai_query_submit`、`sync_error`、`session_finalize`
  - 如果现有事件不够表达该步骤语义，先确认是否需要扩展事件注册与数据治理映射，不要直接临时发明字符串
- 这个步骤进入数据治理时，哪些事件属于 `core`，哪些属于 `secondary`
  - 会沉淀成学习事实的提交、重提、课堂结束等高价值事件，要保证 payload 能支撑归一化
  - 高频浏览、开关、参数拖动等事件可以只走次级事件链，但也要复用统一协议
- 学生在这一页提交后会收到什么反馈？
  - 至少明确“提交状态 / 等待教师释放 / 正确答案揭示 / 教师端统计或词云 / 回看与修正”中的哪几项成立
  - 如果是 AI 对照页，默认顺序是“先写自己的判断，再打开 AI 对照，再提交修正或反思”

如果这些内容在设计稿里没写清，要先补到计划或课程笔记里，再进入实现。

### 4. 媒体资源缺失处理

如果 `interactive-page.md` 或 `multimedia.md` 定义了媒体，但仓库内找不到对应资源：

1. 明确提醒用户缺失的媒体清单。
2. 询问用户选择：
   - `1. 先补齐媒体后再实现（推荐）`
   - `2. 先按占位符实现，并输出资源放置清单`
   - `3. 先实现非媒体部分，媒体步骤保留占位`
3. 只有在用户明确确认后，才使用占位符继续实现。

使用占位符时必须同时给出：
- `public` 下的存放路径
- 建议文件名
- 推荐资源类型
- 页面里对应读取的相对路径

默认命名规则：
- `public/course-media/<lesson>/step-02-ship-turn.mp4`
- `public/course-media/<lesson>/step-02-ship-response.png`
- `public/course-media/<lesson>/step-07-four-families.png`
- `public/course-media/<lesson>/step-13-zeta-family.png`

不要只写“后续补图”。必须给出准确路径与文件名，让用户放入资源后页面能直接读取。

更多规则见 [references/media-and-path-rules.md](references/media-and-path-rules.md)。

### 5. 资源制作（仅限代码直出 / SVG 绘制）

如果设计稿中的资源满足以下任一条件，默认应在本轮实现中直接制作：
- `multimedia.md` 标注为“代码直出”
- `interactive-page.md` 或 `multimedia.md` 标注为“前端绘制”
- 图本质上是结构图、知识地图、参数曲线、示意图、坐标图、反馈框图、几何标注图

执行顺序：
1. 先从 `multimedia.md` 提取资源清单，明确哪些是“代码直出”，哪些是“前端绘制”。
2. 代码直出图统一放在：
   - 设计源：`course-content/authoring/lessons/<lesson>/media/raw/`
   - 运行时产物：`course-content/runtime/lessons/<lesson>/media/`
3. 若已有原始脚本，优先补齐统一 `--output` 参数，不要新起一套平行脚本。
4. 若没有统一生成入口，新增形如 `scripts/generate_<lesson>_runtime_media.py` 的脚本，用 `python3` 负责批量导出。
5. 前端 SVG 绘制图优先直接落在课程组件中，但要把布局参数、语义标注和验证方式写进课程笔记。
6. 资源完成后，必须做两层验证：
   - 文件层：确认 runtime 目录下已生成目标文件
   - 页面层：确认课程页面或 `/course-runtime/...` 实际可读

硬约束：
- 只制作“可代码直出 / SVG 绘制”的图；照片、录屏、真人素材、复杂插画不在本技能默认制作范围内。
- 不把这类运行时图导出到 `public/`，除非用户明确要求或项目现有链路只能如此。
- 运行时图一旦进入页面，必须优先验证中文文字是否可显示，不能只检查“文件存在”。

详细规则与常见问题见 [references/runtime-code-generated-media.md](references/runtime-code-generated-media.md)。

### 6. 允许提出更好的交互方案

课程设计文档优先定义教学目标，但不一定最贴合平台实现。你应当：
- 先严格尊重教学意图
- 再结合仓库现有能力，提出 1-3 个更优实现建议

建议只能在这些方向内优化：
- 更适合小屏设备的页面节奏
- 更贴合平台当前数据流和组件复用方式
- 更自然的教师端控制流
- 更清晰的学生记录与反馈闭环
- 更少的新接口、更高的现有服务复用率

提出建议时使用简短选项，并标注推荐项。用户同意后，再把建议写进实施计划。

### 7. 实现约束

实现时遵守以下规则：
- 优先复用现有课程框架、会话同步、埋点、资源注册、`InteractiveProvider`
- 非必要不新增接口和新方法；优先改造已有接口进行复用
- 每个互动步骤都要显式决定 AI 上下文来源；优先采用 `src/lib/<lesson>-ai-contexts.ts` + `src/lib/course-ai-contexts.ts` 的方式集中维护，并通过 `useCoursePageAIContext` 或页面级 `updatePageContext(...)` 在步骤切换时更新
- 不要把 AI 提示词、课程目标、快捷问题散落在多个组件里；步骤级 AI 上下文应可集中检索、可随步骤切换、可被全局 AI 框架消费
- 涉及课堂码加入时，必须复用平台统一的课堂会话路由解析，不允许在 `dashboard`、通用加入页或课程入口页硬编码学生/教师跳转路径
- 精品互动课教师页必须提供“结束课堂”入口；如课程会出现在教师后台的进行中课堂列表中，也必须允许从后台停止课堂
- 学生页默认与教师页解耦：首次进入对齐教师页，之后若不同步，应亮起“当前页面与教师不同步，点击跳转”提示，而不是强制自动翻页
- 区分平台级代码与资源级代码边界，不把资源实现塞进页面层
- 不把课程设计文本直接硬编码成不可复用的大块页面逻辑；尽量组织成步骤配置、媒体清单、工作区显示条件等结构化数据
- 页面布局按课程内涵决定：纯文本/静态图页面可不显示互动；需要探索时再显示工作区
- 统一课程语义事件优先通过 `useCourseEventTracking` 等现有封装写入，不要在课程页继续直接拼裸 `tracking.emit(...)` 作为课程语义实现
- 提交类事件要区分首次提交与重提；如有提交记录，payload 中优先带上 `stepId`、`attemptKey`、`clientEventAt` 等可归一化字段
- 若新增事件类型，必须同步检查 `src/lib/classroom-analytics/event-taxonomy.ts`、`src/lib/data-governance/event-normalization.ts`、`src/lib/data-governance/event-types.ts` 及相关测试，不允许只在页面里单点新增
- 如果课程要进入数据治理画像或教师学情，就把事件设计成后续可沉淀 `LearningFact` 的结构，不要只满足“前端控制台里看见了”
- 所有选择题形的互动，不论是前测、后测还是中间的调查，学生提交后都必须在教师端显示选项的统计，学生端应显示提交状态；如果该题存在正确答案，教师端还必须提供显示答案的按钮，点击后学生端能看到答案
- 所有文本型的互动都必须在教师端显示词云，学生端应显示提交状态；词云下方提供默认折叠的学生回复列表，并按提交时间排序
- 所有学生输入页都必须有明确反馈：至少包含 `SubmissionStatus` 或同等级别的提交态提示，不能点完提交后页面无反馈
- 对“教师先释放，学生后作答”的题型，学生端在未释放前必须看到明确等待态，不能只显示空白区域
- 对“先个人判断再 AI 对照”的题型，页面文案和交互顺序都要明确阻止学生把 AI 当作第一步答案机
- 所有页面的当前在线学生清单默认折叠；折叠时只给出人数，不默认展开整名单
- 打开AI助手应在页面上直接弹出对话框
- 不要跳转或调用现有的助手页面；如需 AI 交互，应在当前课程页内复用对话组件完成
- 学生端使用移动设备较多，默认按窄屏优先设计：顶部信息压缩、单屏信息密度更高、按钮与表单更紧凑、主要内容优先纵向堆叠
- 移动端要求内容更加紧凑：减少不必要留白，缩短标题区高度，提示区与互动区之间保持短节奏过渡，不依赖宽屏双栏才能完成学习
- 精品课浅色模式统一要求：浅色模式下，所有形状填充色全部采用浅色色系；所有文本全部采用较深的颜色；避免保留大面积深色渐变块或低对比提示文案
- 同时适配深色模式；不要硬编码模块样式，不要把浅色模式写成散落在组件里的固定颜色
- 明确拒绝硬编码样式：如果某个模块需要单独写死颜色值、十六进制色、`dark:` 分支或浅色块/深色字组合，先补统一主题变量或语义类，再实现模块；不要继续在模块内散写颜色
- 即使已有历史兼容桥接层，也不允许在新课或新改动里继续新增 `bg-white`、`text-slate-*`、`border-cyan-*`、`dark:` 之类的旧式颜色类；桥接层只用于兜底，不作为继续硬编码的理由
- 课程实现后，必须在互动课程总入口页注册精品课程入口；当前注册点以 `src/features/interactive/learning-catalog.ts` 的 `FEATURED_LESSONS` / `PREMIUM_LESSONS` 为准，不能只完成路由、预设课和课程页而漏掉入口

如果课程首页存在导学页或入口页，首页必须补齐以下 runtime 模块：
- 入口模块顺序：教师入口、自由浏览、学生入口放在页面最上方，再进入课程概览与 runtime 导学区
- 知识点网络：默认显示本课次相关知识点网络，来源是 runtime 图谱与 lesson overlay
- 关系表达：知识点网络要用箭头清楚标出前置与后置关系，不能只画无方向连线
- 节点交互：点击节点后显示卡片正面内容，并通过卡片内部 `详情 / 概览` 切换完整内容
- 知识点网络文案固定为：`点击任意节点查看卡片正面内容，再用“详情”展开完整知识卡。`
- 卡片预览：在页面最下方按 `course-content/runtime/lessons/<lesson>/lesson.json` 或 `sequence.json` 对应顺序给出知识卡片预览
- 卡片预览文案固定为：`展示本课知识卡片顺序，便于在进入课堂前先建立知识主线。`
- 讲义入口：首页提供讲义入口，点击后可查看讲义详细内容，并放在知识卡片预览下方
- 讲义摘要文案不能直接机械截取原文，应由智能体基于讲义内容形成简短表述

讲义入口的硬要求：
- 必须正确渲染 LaTeX 公式
- 必须正确插入讲义引用的图片和媒体资源
- 优先直接读取 runtime Markdown 原文，不为单课单独发明另一套讲义存储格式
- 讲义入口区和讲义详情区都必须提供 `导出 PDF` 功能

如果课程 runtime 编排里为某些步骤分配了知识卡片：
- 必须把知识卡片按编排设计插入对应互动课程页面
- 交互形式默认采用抽屉设计呼出
- 所有互动页面（除了首页）知识卡片入口统一放在页面顶部标题模块的右上角
- 入口按钮文案统一为：`知识卡片`
- 抽屉标题统一为：`页面知识卡片`
- 抽屉说明统一为：`当前页面相关的知识卡片`
- 没有知识卡片的不需要抽屉，也不要渲染空入口

节点卡片渲染统一框架：
- 对 `course-content/runtime/knowledge/cards/nodes/*.md`，卡片正面只显示 `## 首页` 分节内容
- 不显示 `## 首页` 之前的基本信息，也不显示从 `## 详情` 开始的内容
- 卡片内部提供 `详情` 按钮切换到详情视图，并提供 `概览` 按钮返回概览视图
- 切换前后卡片标题保持不变；视图状态不能拼进标题文本
- 内容较长时必须支持滚动
- 首页节点卡片与互动页面抽屉卡片都必须复用同一套渲染机制，不为单课单独写两套卡片逻辑

### 8. 闭环验证

实现完成后，必须先重新执行一次“设计稿 vs 实现稿”核对，确认代码与设计文稿已经对齐；只有这一步结束后，才进入浏览器闭环验收。

除现有结构与页面核验外，还要额外确认：
- 每个需要 AI 的步骤都已接上正确的步骤级上下文，而不是复用错误课程或默认空上下文
- 教师端 / 学生端的步骤浏览、提交、AI 打开与提问、课堂结束等关键事件已进入统一课程事件链
- 若课程新增了治理相关事件或扩展 payload，文本级 / 单测级检查已经覆盖，不是只靠人工点页面
- 学生提交后是否能稳定看到提交状态、等待态、答案揭示、词云/统计等反馈闭环

推荐参考 `L-sum` 的做法，为新课至少补一类“文本级守卫测试”：
- 例如检查 AI 助手必须页内弹窗、不得跳转
- 检查步骤浏览与提交事件是否复用统一事件链
- 检查教师端统计 / 词云 / 答案揭示是否仍然存在

- 设计稿对照与课程笔记更新规则见 [references/verification-and-note-update.md](references/verification-and-note-update.md)
- 浏览器闭环验收、双子代理逐页流程、测试账号与详细覆盖项见 [references/closed-loop-browser-validation.md](references/closed-loop-browser-validation.md)
- 若采用双子代理浏览器验收，主代理只需读取总则，并按角色给子代理分发各自规范文件：
  - 教师端子代理读取 [references/browser-validation-teacher-subagent.md](references/browser-validation-teacher-subagent.md)
  - 学生端子代理读取 [references/browser-validation-student-subagent.md](references/browser-validation-student-subagent.md)
- 主代理不需要读取这两个子代理规范文件，避免把教师/学生端逐页操作细节堆进主上下文；主代理负责启动基线、分派角色、汇总结果与判断是否通过

## 课程笔记机制

笔记目录：`notes/`

规则：
- 每门课一个文件：`notes/<lesson>.md`
- 课次名优先直接使用外部目录名，例如 `notes/L-2a.md`
- 优化现有课程前先读笔记
- 完成实现或核对后必须更新笔记

如果笔记不存在，使用：

```bash
python3 scripts/init_course_note.py --lesson L-2a --title "三张面孔，同一系统——时域直觉速通"
```

## 资源

### scripts/

- `scripts/init_course_note.py`
  - 初始化课程笔记
  - 使用 `python3` 运行

### references/

- `references/media-and-path-rules.md`
  - 媒体缺失时的占位符、路径、命名与输出规范
- `references/runtime-code-generated-media.md`
  - 代码直出 / SVG 绘制资源的目录、生成、字体、验证与常见问题
- `references/verification-and-note-update.md`
  - 设计核对流程、验证清单和课程笔记更新规则
- `references/closed-loop-browser-validation.md`
  - 设计对齐后的浏览器闭环验收流程、双子代理分工、测试账号与逐页验收规则
- `references/browser-validation-teacher-subagent.md`
  - 教师端浏览器验收子代理规范：登录、建课、翻页、显示答案、结束课堂与对话框处理
- `references/browser-validation-student-subagent.md`
  - 学生端浏览器验收子代理规范：课堂码加入、跟页提示、提交作答、知识卡片与 AI 弹窗验证

### notes/

- `notes/L-2a.md`
  - 当前已记录的 L-2a 实现情况与差异

## 快速检查表

- [ ] 已确认是“开始新课设计”还是“优化现有课”
- [ ] 已读取对应课程设计文档
- [ ] 已核对当前实现与设计稿差异
- [ ] 已逐步定义需要 AI 助手的页面及其上下文字段（topic / objectives / quickQuestions / prompt extension）
- [ ] 已梳理每个关键步骤的统一课程事件，而不是临时散写埋点
- [ ] 已确认高价值事件如何进入数据治理归一化链路
- [ ] 已检查媒体是否缺失
- [ ] 已判断哪些资源应直接代码直出或 SVG 绘制
- [ ] 已把 runtime 资源生成到正确目录并做页面验证
- [ ] 已确认本次课次结构对齐 `L-2c`，不再沿用旧目录作为规范
- [ ] 已确认 `course-content/runtime` 是当前页面与接口的唯一来源
- [ ] 已优先通过 `course-content/scripts/export-runtime.sh` 完成可自动迁移内容
- [ ] 已确认教师入口、自由浏览、学生入口位于课程首页最上方
- [ ] 已向用户提出必要的更优交互建议
- [ ] 已基于仓库现有框架写实施计划
- [ ] 已完成实现
- [ ] 课程实现后已在互动课程总入口页注册精品课程入口
- [ ] 已在首页补齐知识点网络、卡片预览与讲义入口
- [ ] 已确保知识点网络用箭头表达前置与后置关系
- [ ] 已确保讲义入口与讲义详情支持导出 PDF
- [ ] 已按编排把知识卡片插入对应步骤，且无卡片步骤不渲染抽屉
- [ ] 已确保知识卡片统一走 `## 首页 / ## 详情` 渲染框架，并支持 `详情 / 概览` 切换
- [ ] 已确保非首页页面的知识卡片入口位于标题模块右上角，按钮文案统一为“知识卡片”
- [ ] 已核对选择题统计、答案揭示、文本词云与在线学生折叠等教师端联动要求
- [ ] 已核对学生提交状态、等待教师释放、AI 对照与修正反馈等学生端闭环
- [ ] 已核对 AI 助手为页内弹窗，且步骤切换时上下文会同步更新
- [ ] 已核对关键课程事件与数据治理映射没有脱节
- [ ] 已检查浅色/深色模式都可读，并避免硬编码模块样式
- [ ] 已重新执行设计稿对照验证
- [ ] 已在设计对齐后按浏览器闭环参考完成双子代理逐页验收
- [ ] 已更新 `notes/<lesson>.md`
