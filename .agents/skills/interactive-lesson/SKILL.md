---
name: interactive-lesson
description: Use when implementing or optimizing this repository's interactive lesson pages from `course-content/authoring/lessons/<lesson>/` design documents, especially for lesson-by-lesson page building, media placeholder planning, design-vs-implementation gap analysis, or maintaining lesson implementation notes.
---

# Interactive Lesson Implementation

## Overview

按外部课程设计文档为本项目实现或优化互动课程页面。把 `course-content/authoring/lessons/<lesson>/` 视为设计源，把仓库中的实现视为待核对对象；优先复用现有框架、资源注册、埋点和会话同步能力，避免写成孤立页面。

**核心原则：**
- 先确认课程与任务模式，再动手。
- 先核对设计稿与现状，再做实现计划。
- 媒体缺失必须显式提醒，不能默认"以后再补"。
- 设计稿里凡是可代码直出或可前端 SVG 绘制的图，优先在实现阶段直接落地，不留"后续补图"。
- 可以提出更好的交互方案，但必须先向用户说明原因并纳入计划。
- 实现完成后，必须回到设计文档做一次闭环核对，并更新本技能的课程笔记。

## Runtime First 约束

当前默认基线不再是单一 `L-2c`，而是综合以下已落地课程能力：
- `1-1`：理论型精品互动课的入口页、教师/学生双端、提交闭环、教师统计与答案揭示、统一事件链。
- `1-2`：17 步课堂蓝图、词云/回复列表、runtime 首页与课堂双线协同。
- `1-3`：增强型工作区、步骤级 AI 上下文、知识卡抽屉、浏览器验收、review/runtime 联动。
- `2-1`：课前预习台统一入口模板、runtime 媒体文案装配、页内音视频容器、讲义在线阅读/下载，以及课堂外资源互动追踪链路。
- `4-1`：统一 `useControlEngine -> control-analysis.worker.ts -> Rust/WASM compute_analysis -> ControlFigureWorkspace` 的曲线联动基线、固定面板组合、固定坐标范围、指标覆盖层与共享夹具回退。

后续课程若涉及参数联动曲线，默认沿用 `4-1` 的 Rust/WASM 曲线联动基线；除非设计稿显式声明例外，不再回退到旧的单课内联图表实现。

所有运行时课程资源统一以 `course-content/runtime` 为唯一来源。页面、接口、知识图谱、讲义、知识卡片都应优先从 runtime 读取；`authoring` 只作为制作源，不直接作为运行时依赖。

实现互动课程前，必须确认对应内容已经经过 `lesson-content-review` 课程审查技能处理；若审查报告、runtime 导出或媒体处理缺失，先回到课程审查链路补齐。

默认迁移路径：
1. 能脚本化迁移的内容，优先补到 `course-content/scripts/export-runtime.sh`（内部调用 `python3` 脚本）完成导出。
2. 不能自动迁移的内容，必须基于内容理解在 `course-content/runtime` 下重建，不允许停留在"以后人工补"。
3. 讲义保留 Markdown 原文到 runtime，再由页面渲染；不要在导出阶段把讲义改写成不可回溯的 HTML。

知识组织统一采用"全局 knowledge 统一来源 + lesson graph overlay 局部编排"：
- 全局节点唯一来源：`course-content/runtime/knowledge/graph/nodes.json`
- 全局关系唯一来源：`course-content/runtime/knowledge/graph/relations.jsonl`
- 节点卡片唯一来源：`course-content/runtime/knowledge/cards/nodes/`
- 课次局部结构与编排：`course-content/runtime/lessons/<lesson>/graph-overlay.json`、`lesson.json`

## 启动方式

技能加载后，如果用户没有明确说明"开始哪一课"或"优化哪一课"，先询问：

1. 你要开始设计新课，还是优化现有课？
   - `1. 开始新课设计（推荐）`
   - `2. 优化现有课程`
2. 课程是哪个课次？
   - 先列出 `.agents/skills/interactive-lesson/notes` 下可用笔记，优先给出最相关的 2-3 个选项
   - 允许用户自定义输入

如果用户选择优化现有课，先读取 `notes/<lesson>.md`；若笔记不存在，先创建再继续。

## 工作流

### 1. 锁定设计源

始终读取以下资料，按需补充：
- `course-content/authoring/lessons/<lesson>/design/interactive-page.md`
- `course-content/authoring/lessons/<lesson>/design/boppps.md`
- `course-content/authoring/lessons/<lesson>/design/handout.md`
- `course-content/authoring/lessons/<lesson>/design/multimedia.md`（如果存在）

把这些文件当作设计源，不要只根据现有代码继续"顺着改"。

如果课次已进入 runtime 化阶段，还要同步读取：
- `course-content/runtime/lessons/<lesson>/lesson.json`
- `course-content/runtime/lessons/<lesson>/graph-overlay.json`
- `course-content/runtime/lessons/<lesson>/<lesson>-handout.md`

若 `authoring` 与 runtime 不一致，以 runtime 组织要求为准，再回头补 export 流程。

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
- 教师端是否存在"播放 / 揭示 / 释放 / 汇总 / 抽答"等控制流
- 学生端是否形成"预测 -> 操作 -> 记录 -> 反馈"的个人认知链路
- 工作区是否按需出现，而不是机械复用同一种布局
- 课程资源是否真的落地为媒体或组件，而不是只剩说明文字

把差异先记入课程笔记，再进入实现。

对 runtime 课次额外核对：
- `authoring -> export-runtime.sh -> course-content/runtime -> 页面/接口` 文件链路是否闭合
- 课程首页是否真的消费 runtime，而不是偷偷回读 `authoring` 或 `content`
- 讲义中的图片、SVG、视频等媒体引用是否都改写为 `/course-runtime/...`
- 知识点网络是否来自 runtime 全局图 + lesson overlay，而不是页面内硬编码

### 3.1 Manifest-first 模块消费审计

实现 manifest-first 课程时，`content-renderers.tsx` 与 `activity-renderers.tsx` 的职责必须分离：
- content 模块只进入正文、媒体、公式、图文等 content runtime。
- activity 模块只进入 activity runtime，activity 模块不进入正文，题面不得在正文区和互动区重复出现。
- 实现完成后必须执行 manifest audit：`python3 .agents/skills/interactive-design/scripts/audit_interactive_manifest.py --lesson <lesson>`。
- 审计失败时先修 manifest 消费链路，不要用隐藏、过滤或空渲染绕过问题。

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

不要只写"后续补图"。必须给出准确路径与文件名，让用户放入资源后页面能直接读取。

更多规则见 [references/media-and-path-rules.md](references/media-and-path-rules.md)。

### 5. 资源制作（仅限代码直出 / SVG 绘制）

如果设计稿中的资源满足以下任一条件，默认应在本轮实现中直接制作：
- `multimedia.md` 标注为"代码直出"
- `interactive-page.md` 或 `multimedia.md` 标注为"前端绘制"
- 图本质上是结构图、知识地图、参数曲线、示意图、坐标图、反馈框图、几何标注图

执行顺序：
1. 先从 `multimedia.md` 提取资源清单，明确哪些是"代码直出"，哪些是"前端绘制"。
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
- 只制作"可代码直出 / SVG 绘制"的图；照片、录屏、真人素材、复杂插画不在本技能默认制作范围内。
- 不把这类运行时图导出到 `public/`，除非用户明确要求或项目现有链路只能如此。
- 运行时图一旦进入页面，必须优先验证中文文字是否可显示，不能只检查"文件存在"。

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
- 涉及课堂码加入时，必须复用平台统一的课堂会话路由解析，不允许在 `dashboard`、通用加入页或课程入口页硬编码学生/教师跳转路径
- 精品互动课教师页必须提供"结束课堂"入口；如课程会出现在教师后台的进行中课堂列表中，也必须允许从后台停止课堂
- 学生页默认与教师页解耦：首次进入对齐教师页，之后若不同步，应亮起"当前页面与教师不同步，点击跳转"提示，而不是强制自动翻页
- 区分平台级代码与资源级代码边界，不把资源实现塞进页面层
- 不把课程设计文本直接硬编码成不可复用的大块页面逻辑；尽量组织成步骤配置、媒体清单、工作区显示条件等结构化数据
- 页面布局按课程内涵决定：纯文本/静态图页面可不显示互动；需要探索时再显示工作区
- 所有选择题形的互动，不论是前测、后测还是中间的调查，学生提交后都必须在教师端显示选项的统计，学生端应显示提交状态；如果该题存在正确答案，教师端还必须提供显示答案的按钮，点击后学生端能看到答案
- 所有文本型的互动都必须在教师端显示词云，学生端应显示提交状态；词云下方提供默认折叠的学生回复列表，并按提交时间排序
- 所有页面的当前在线学生清单默认折叠；折叠时只给出人数，不默认展开整名单
- 打开AI助手应在页面上直接弹出对话框
- 不要跳转或调用现有的助手页面；如需 AI 交互，应在当前课程页内复用对话组件完成
- 学生端使用移动设备较多，默认按窄屏优先设计：顶部信息压缩、单屏信息密度更高、按钮与表单更紧凑、主要内容优先纵向堆叠
- 移动端要求内容更加紧凑：减少不必要留白，缩短标题区高度，提示区与互动区之间保持短节奏过渡，不依赖宽屏双栏才能完成学习
- 精品课浅色模式统一要求：浅色模式下，所有形状填充色全部采用浅色色系；所有文本全部采用较深的颜色；避免保留大面积深色渐变块或低对比提示文案
- 同时适配深色模式；不要硬编码模块样式，不要把浅色模式写成散落在组件里的固定颜色
- 明确拒绝硬编码样式：如果某个模块需要单独写死颜色值、十六进制色、`dark:` 分支或浅色块/深色字组合，先补统一主题变量或语义类，再实现模块；不要继续在模块内散写颜色
- 即使已有历史兼容桥接层，也不允许在新课或新改动里继续新增 `bg-white`、`text-slate-*`、`border-cyan-*`、`dark:` 之类的旧式颜色类；桥接层只用于兜底，不作为继续硬编码的理由
- 课程实现后，必须在互动课程总入口页注册精品课程入口；当前注册点以 `src/features/interactive/learning-catalog.ts` 的 `FEATURED_LESSONS` / `PREMIUM_LESSSSONS` 为准，不能只完成路由、预设课和课程页而漏掉入口
- 前测页面不设置单独的前测内容模块或范围模块；应在标题模块文案中注明考察内容，标题模块后直接进入教师控制、作答题组或其他真实互动模块
- 逐个页面发放实现任务，必要时使用实现子代理完成页面级实现；实现后由学生视角审查子代理检查页面是否忠实反映契约中的内容和逻辑，并记录 `interactive-implementation-acceptance.json`
- Rust 驱动面板的标题必须使用与页面内容相关、含义明确的学科标题；不得使用“Rust 面板”“三标签面板”“对照面板”；面板标题之外不得追加与教学对象无关的工程实现说明
- 动态图示不得降级为静态截图：控件直接驱动同页曲线或图示的原生重绘，关键教学对象应沉淀为任务表达卡模板，并用指标角色矩阵明确每个量在问题中的角色；完成态标记使用 `stable_equals_done` 等结构化判定，而不是只写说明文本
- manifest 驱动的新课若存在 `activity_cards`、`parameter_slider`、`interactive_figure_submit`、训练面板或其他学生响应产物，学生页必须通过 `useManifestSubmissionController` / `submitManifestStepResponse` 进入共享 `manifest-submission-v2` 证据路径，并传入当前 step 的 manifest getter；不得在课程页直接发送 `COURSE_EVENT_TYPES.LESSON_SUBMIT` 或 `COURSE_EVENT_TYPES.LESSON_RESUBMIT`
- 模块 5 从 `5-2` 起的 response-producing 页面已经纳入仓库级 gate。新增或迁移后必须运行 `npm run test:course-data-quality-gates`，该命令会枚举库存中的 response-producing steps，检查共享提交路径，并用失败 fixture 保证绕过共享提交会被拦截
- 课后数据可用性验收必须运行只读报告命令：`npm run db:session-data-quality -- --session-id=<class-session-id>`；报告必须能看到答案可用率、分数可用率、题目摘要可用率、`rich/partial/legacy/missing` 证据等级、报告新鲜度、快照新鲜度，以及 sync raw error、incident、dominant source / failure kind 和 severity

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

实现完成后，必须先重新执行一次"设计稿 vs 实现稿"核对，确认代码与设计文稿已经对齐；只有这一步结束后，才进入浏览器闭环验收。

- 设计稿对照与课程笔记更新规则见 [references/verification-and-note-update.md](references/verification-and-note-update.md)
- 浏览器闭环验收、双子代理逐页流程、测试账号与详细覆盖项见 [references/closed-loop-browser-validation.md](references/closed-loop-browser-validation.md)
- 入口页模式与 runtime 媒体索引契约见 [references/runtime-entry-page-pattern.md](references/runtime-entry-page-pattern.md) 与 [references/runtime-media-index-contract.md](references/runtime-media-index-contract.md)
- 实现完成后必须通过该脚本测试：`python3 .agents/skills/interactive-lesson/scripts/check_contract_alignment.py`
- 内容导出和作者态契约审查必须运行 `review_lesson_content.py --strict-implementation-contract`，不能忽略作者态契约与本地实现漂移
- 子代理审查必须发生在严格脚本前；主代理只收集审查结论、修复问题并写入 `notes/interactive-implementation-acceptance.json`，不把长篇浏览器过程塞回主上下文
- 若子代理审查指出契约漏实现、旧口径回潮、埋点缺失、页内 AI 入口或曲线/示意图静态降级，必须先修复，再写 `notes/interactive-implementation-acceptance.json`，更不得宣称完成
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
python3 .agents/skills/interactive-lesson/scripts/init_course_note.py --lesson L-2a --title "三张面孔，同一系统——时域直觉速通"
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

## AI助手上下文配置（强制设计原则）

对于任何精品互动课程（如L2D、LSUM等），**必须**为每个步骤配置AI上下文，使AI助手能够在每个页面读取到页面的主要内容和主要教学目的。

### 配置要求

每个步骤必须创建对应的 `AIContextConfig`：

```typescript
interface AIContextConfig {
  enabled: boolean;                    // 是否启用AI助手
  courseId: string;                    // 课程ID
  courseTitle: string;                 // 课程标题
  pageType: PageType;                  // 页面类型 (theory/practice/quiz/reflection/workspace/summary)
  stepId: string;                      // 步骤ID
  topic: string;                       // 当前主题（步骤标题）
  learningObjectives: string[];        // 该步骤的学习目标
  knowledgeType: KnowledgeType;        // 知识类型: C-概念性, X-程序性, D-元认知
  tools: string[];                     // 该步骤可用的AI工具
  quickQuestions: Array<{label: string; question: string}>;  // 步骤相关的快捷问题
  systemPromptExtension: string;       // 系统提示词扩展（描述当前环节教学重点）
}
```

### 文件组织

1. **统一存放**: 在 `src/lib/{course-id}-ai-contexts.ts` 中存放每个课程的AI上下文配置
2. **注册表**: 在 `src/lib/course-ai-contexts.ts` 中注册所有课程
3. **动态更新**: 在学生页面中使用 `useGlobalAI().updatePageContext()` 动态更新当前步骤的上下文

### 学生页面集成

```typescript
// 在学生页面组件中
const step = L2D_LESSON_STEPS[activeIndex];
const { updatePageContext } = useGlobalAI();

// 当步骤变化时，更新AI上下文
useEffect(() => {
  const stepContext = getL2DStepAIContext(step.id);
  if (stepContext) {
    updatePageContext({
      courseId: stepContext.courseId,
      courseTitle: stepContext.courseTitle,
      pageType: stepContext.pageType,
      stepId: stepContext.stepId,
      topic: stepContext.topic,
      learningObjectives: stepContext.learningObjectives,
      knowledgeType: stepContext.knowledgeType,
      tools: stepContext.tools,
      quickQuestions: stepContext.quickQuestions,
      systemPromptExtension: stepContext.systemPromptExtension,
    });
  }
}, [step.id, updatePageContext]);
```

### 参考实现

- L2D: `/src/lib/l2d-ai-contexts.ts` (14个步骤，完整覆盖三域联动探索)
- LSUM: `/src/lib/lsum-ai-contexts.ts` (15个步骤，完整覆盖可行域设计)
- 注册表: `/src/lib/course-ai-contexts.ts`
- Hook: `/src/hooks/useCoursePageAIContext.ts`

## 快速检查表

- [ ] 已确认是"开始新课设计"还是"优化现有课"
- [ ] 已读取对应课程设计文档
- [ ] 已核对当前实现与设计稿差异
- [ ] 已检查媒体是否缺失
- [ ] 已判断哪些资源应直接代码直出或 SVG 绘制
- [ ] 已把 runtime 资源生成到正确目录并做页面验证
- [ ] 已对照 `1-1`、`1-2`、`1-3`、`2-1`、`4-1` 当前基线选择合适实现参考，不再把 `L-2c` 当唯一结构基线
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
- [ ] 已确保非首页页面的知识卡片入口位于标题模块右上角，按钮文案统一为"知识卡片"
- [ ] 已核对选择题统计、答案揭示、文本词云与在线学生折叠等教师端联动要求
- [ ] 已检查浅色/深色模式都可读，并避免硬编码模块样式
- [ ] 已重新执行设计稿对照验证
- [ ] 已在设计对齐后按浏览器闭环参考完成双子代理逐页验收
- [ ] 已写入 `notes/interactive-implementation-acceptance.json`
- [ ] 若页面会产生学生响应，已接入 `useManifestSubmissionController` / `submitManifestStepResponse`，没有直接发送 `COURSE_EVENT_TYPES.LESSON_SUBMIT` 或 `COURSE_EVENT_TYPES.LESSON_RESUBMIT`
- [ ] 已运行 `npm run test:course-data-quality-gates`，并确认本课或库存覆盖范围内的 response-producing 页面全部通过共享提交 gate
- [ ] 课后验收已运行 `npm run db:session-data-quality -- --session-id=<class-session-id>` 或等价过滤命令，且报告中证据等级、报告新鲜度、快照新鲜度、sync incident 分类可解释
- [ ] 已更新 `notes/<lesson>.md`
- [ ] 已为每个步骤创建AI上下文配置（`src/lib/{course}-ai-contexts.ts`）
- [ ] 已在学生页面中集成动态上下文更新（`useGlobalAI().updatePageContext()`）
- [ ] 已确保每个步骤的快捷问题与当前内容相关
- [ ] 已在 `systemPromptExtension` 中描述当前环节的教学重点
