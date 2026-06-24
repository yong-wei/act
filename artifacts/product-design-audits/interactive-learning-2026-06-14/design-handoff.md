# 互动学习与互动课程统一 UI 设计 Handoff

日期: 2026-06-14  
状态: accepted  
流程来源: Product Design `/audit` -> `/ideate` -> 用户修订确认  
适用范围: 互动学习入口、互动课程目录、课程入口、教师开课等待页、学生/访客运行态、教师投影运行态、互动模块视觉标准

## 1. 设计真源

本文件是后续 OpenSpec 与实现验收的权威设计真源。实现不能只满足文字任务，也必须通过视觉证据证明与本 handoff 和概念稿一致。

审计证据:

- `audit.md`
- `browser-metrics.json`
- `shell-frame-metrics.json`
- `dark-theme-metrics.json`
- `screenshots/*.png`

概念稿:

- `concepts/01-learning-atlas-course-catalog.png`
- `concepts/02-course-entry-shell.png`
- `concepts/03-lesson-runtime-shell.png`

修订稿:

- `concepts/revised/01-course-catalog-theory-practice.png`
- `concepts/revised/02-teacher-classroom-qr-waiting.png`
- `concepts/revised/03-student-guest-runtime.png`
- `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`

历史参考稿:

- `concepts/revised/04-teacher-projection-runtime.png`
- `concepts/revised/05-teacher-projection-runtime-collapsed-tools.png`

第 4、5 张教师运行态稿只作为演进参考。教师端最终方向以第 6 张为准。

## 2. 全局壳层合同

所有互动学习和互动课程页面必须进入统一平台壳层，而不是继续扩散 `premium-lesson-*` 局部页面系统。

必须满足:

- 左侧平台导航默认收起为图标栏，并继承全平台跨页面导航偏好。
- 多层页面显示面包屑，例如 `首页 / 互动学习 / 互动课程 / 1-1 看见整门课`。
- 顶部使用平台统一用户中心、主题切换和必要课堂状态，不创建课程局部用户栏。
- 右下角使用统一控灵浮动 dock。控灵不能并入右侧栏、课程卡片或教师工具面板。
- 宽屏内容使用流体工作区，不再整页固定居中窄容器。
- 深色与浅色主题共享平台 token，不继续新增课程局部色板。
- 页面不使用营销式 hero、卡片套卡片、emoji 或装饰性大图。

## 3. 页面级目标

### 3.1 互动学习地图与课程目录

目标页面:

- `/interactive-learning`
- `/interactive-learning/courses`
- `/interactive-learning/chapter-components`
- `/interactive-learning/cross-domain-exploration`

视觉目标:

- 对齐 `concepts/01-learning-atlas-course-catalog.png` 与 `concepts/revised/01-course-catalog-theory-practice.png`。
- 课程类型只保留 `理论课` 与 `实践课`。
- 课堂时间和运行状态来自 runtime 记录，不在视觉层新增臆造分类。
- 目录页应像学习工作台，而不是卡片堆叠。
- 跨域探索本轮只统一列表页壳层；Control Odyssey 和十滴水内部体验不纳入本轮重设计。

验收重点:

- 1440px 桌面视口中主区随屏幕扩展，不出现整页固定 1180/1200/1280px 居中容器。
- 移动端保留清晰路径和主操作，不出现横向溢出。
- 深色主题下边界、辅助文本和状态标签有足够对比度。

### 3.2 具体课程入口

目标页面:

- `/interactive-learning/courses/unit-*`

视觉目标:

- 对齐 `concepts/02-course-entry-shell.png`。
- 教师开课、学生加入、访客演示、自学资料和课程资源在同一 CourseEntryShell 中组织。
- 页面显示课程身份、BOPPPS 结构、单元路径、资源清单和进入方式。
- 不继续使用独立浅蓝 `PremiumLessonEntryPage` 视觉系统。

验收重点:

- 入口页保留平台导航、面包屑、统一控灵 dock 和主题切换。
- 教师、学生、访客入口清晰，但不在访客或学生视图展示教师统计。
- 资源与知识路径可以随宽屏分区展示，不挤在单列卡片中。

### 3.3 教师开课等待页

目标页面:

- 教师创建课堂后的二维码等待页。

视觉目标:

- 对齐 `concepts/revised/02-teacher-classroom-qr-waiting.png`。
- 显示课堂二维码、课堂码和已加入学生人数统计。
- 教师点击 `开始上课` 后进入教师投影运行态。

验收重点:

- 等待页是开课前状态，不显示课程正式投影内容。
- 已加入人数要作为页面主状态之一，不藏在侧栏。
- 进入上课按钮是主动作，但不破坏平台壳层连续性。

### 3.4 学生与访客运行态

目标页面:

- `/interactive-learning/courses/*/student/[sessionId]`
- `/interactive-learning/courses/*/student/demo`
- 访客浏览或演示模式对应入口。

视觉目标:

- 对齐 `concepts/revised/03-student-guest-runtime.png`。
- 学生端与访客端主体内容基本一致。
- 学生端可显示当前互动作答区。
- 访客端可浏览或演示，但不显示真实提交证据。
- 学生/访客不显示教师端提交概况、证据状态、班级统计或教师操作。

验收重点:

- 学生/访客运行态进入统一 LessonRuntimeShell。
- 主内容、作答区和反馈区层级清晰。
- 无效 session、资源缺失或未释放状态有清晰阻断或 fallback，不出现大面积空白。

### 3.5 教师投影运行态

目标页面:

- `/interactive-learning/courses/*/teacher/[sessionId]`

视觉目标:

- 当前优先稿为 `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`。
- 授课内容完全占据主体，主图、题面和互动模块是首要视觉层级。
- 教师页面不显示学生答案提交框。
- 右侧工具默认收起为窄工具列，不采用常开抽屉或永久右侧面板。
- 边栏采用响应式设计；桌面为可展开/收起工具列，小屏为显式触发的底部或浮层命令面。
- 释放互动、暂停作答、逐步显示、显示参考、提交概览等控制附着到每个互动模块。
- 下方课程内导航是轻量辅助层，不侵占主教学画面。
- 顶部取消重复的 `下一页` 动作。
- 底部导航包含上一页、BOPPPS 阶段指示、页码快速跳转下拉、页数状态和下一页。
- 控灵使用平台统一右下浮动 dock，不并入课程右侧工具列。

验收重点:

- 1440px 桌面视口中，主教学内容明显大于工具和导航区域。
- 底部导航高度和视觉权重低于主教学内容。
- 顶部不存在重复下一页按钮。
- 快速跳转下拉可访问、可键盘操作，并与页码状态一致。
- 右侧工具默认收起，展开状态不遮挡主图和互动题面。

## 4. 互动模块视觉标准

实现必须为组件化互动课程定义统一视觉 chrome。课程本地组件不能绕过标准 chrome 自行拼装视觉变体。

必须覆盖:

- 内容模块: 文本说明、图片面板、视频/音频、公式、表格、代码、知识卡片。
- 互动模块: 单选、多选、排序、配对、拖拽/匹配、任务卡、参数输入、图形热点、短答、前后测。
- 教师状态: 未释放、已释放、暂停作答、逐步显示、参考答案、提交概览。
- 学生状态: 未开放、可作答、已提交、已反馈、资源不可用。
- 主题状态: 浅色、深色。
- 视口状态: 桌面、移动、投影。

## 5. Design QA 硬闸门

每个实现变更都必须包含视觉验收，而不是只在系列末尾做一次截图归档。

每个变更完成前必须提交:

- 对应概念图路径。
- 实现截图路径。
- 同视口、同主题、同角色、同状态对照。
- `design-qa.md` 或等价分变更 QA 报告。
- 明确的 `final result: passed` 或 `final result: blocked`。

阻塞条件:

- 未打开或未引用对应视觉真源。
- 没有实现截图。
- 没有把源图和实现截图放入同一比较上下文。
- P0/P1/P2 视觉差异仍存在。
- 页面仍使用旧 `premium-lesson-*` 壳层作为主要页面框架。
- 缺少面包屑、统一控灵 dock、默认收起导航或对应角色模式。
- 教师投影页出现常开右侧抽屉、顶部重复下一页、过大的底部导航或学生答案输入框。
- 学生/访客页出现教师统计、提交概况或证据状态。

每个 QA 报告必须覆盖:

- 字体和字号层级。
- 间距和布局节奏。
- 色彩 token 和深浅主题。
- 图像、图标和资源质量。
- 页面特定中文文案。
- 响应式表现。
- 可访问性与键盘操作。

最终系列 QA 必须汇总所有子变更的 design-qa 结果，任何子变更缺失或 blocked 都不能归档系列。

## 6. OpenSpec 系列依赖

后续 Buddy issue 必须按下列依赖图登记，不能把所有子变更登记为可并行独立任务。

外部依赖:

- `persist-app-shell-navigation-preference`: 本系列依赖其完成默认收起导航、跨页面持久化和平台壳层治理证据。所有壳层类子变更在 issue 层面都必须被该变更阻塞，直到其完成或明确由集成基线提供等价能力。

内部依赖:

1. `unify-interactive-learning-atlas-shell`
   - blocked by: `persist-app-shell-navigation-preference`
   - unlocks: `migrate-interactive-course-entry-shell`
2. `migrate-interactive-course-entry-shell`
   - blocked by: `unify-interactive-learning-atlas-shell`
   - unlocks: `standardize-interactive-classroom-entry`
3. `define-interactive-module-visual-standards`
   - blocked by: `persist-app-shell-navigation-preference`
   - unlocks: `standardize-lesson-runtime-shell`
4. `standardize-interactive-classroom-entry`
   - blocked by: `migrate-interactive-course-entry-shell`
5. `standardize-lesson-runtime-shell`
   - blocked by: `migrate-interactive-course-entry-shell` and `define-interactive-module-visual-standards`
6. `govern-interactive-learning-product-qa`
   - blocked by: all five implementation/design-standard child changes above
   - also blocked by: `persist-app-shell-navigation-preference` if that external change is still active

Issue registration requirements:

- Create or identify a series parent, suggested series: `interactive-learning-ui-redesign`.
- Create six child issues with `claim_branch` equal to each `change_id`.
- Use `area:interactive-learning`, `series:interactive-learning-ui-redesign`, `mode:isolated`, and appropriate `risk` labels for each child.
- Use native GitHub blocked-by relationships for every dependency above.
- In issue body front matter, keep non-empty `blocked_by`/`depends_on` as YAML block lists; do not use inline lists.
- Do not create implementation branches or claim any issue during propose.

## 7. 不采用的方向

- 不采用把控灵助手整合进课程右侧栏的方案。
- 不采用教师投影页面常开右侧工具面板。
- 不采用顶部和底部重复页码导航动作。
- 不采用教师页面统一全局侧栏管理所有互动控制；控制应附着到对应互动模块。
- 不采用新增理论/实践以外的课程类型标签。
- 不采用继续维护 `premium-lesson-shell` 作为长期课程主壳层。
