# 互动学习与互动课程页面族 UI 审计

日期: 2026-06-14  
目标: 为后续 OpenSpec 提案提供证据，统一互动学习、互动课程入口与课堂运行态的 AppShell、面包屑、响应式宽度、深浅主题、控灵 dock 和组件视觉标准。

## 审计范围

本轮使用当前运行服务 `http://localhost:3001` 采集证据，输出保存在本目录。

- `/interactive-learning`
- `/interactive-learning/courses`
- `/interactive-learning/courses/unit-1-1-see-the-full-picture`
- `/interactive-learning/courses/unit-4-1-design-task-expression`
- `/interactive-learning/chapter-components`
- `/interactive-learning/cross-domain-exploration`
- `/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo`
- `/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/audit-session`

不纳入本轮内部重设计:

- Control Odyssey 游戏内部体验
- 十滴水游戏内部体验

这些页面只要求入口、壳层和返回路径与平台统一。

## 证据文件

截图目录: `artifacts/product-design-audits/interactive-learning-2026-06-14/screenshots/`

- `01-interactive-learning-desktop.png`
- `01-interactive-learning-mobile.png`
- `02-course-catalog-desktop.png`
- `02-course-catalog-mobile.png`
- `03-course-entry-1-1-desktop.png`
- `03-course-entry-1-1-mobile.png`
- `04-course-entry-4-1-desktop.png`
- `04-course-entry-4-1-mobile.png`
- `05-chapter-components-desktop.png`
- `05-chapter-components-mobile.png`
- `06-cross-domain-list-desktop.png`
- `06-cross-domain-list-mobile.png`
- `07-course-student-runtime-blocker-desktop.png`
- `08-course-teacher-runtime-blocker-desktop.png`
- `09-course-catalog-dark-desktop.png`
- `10-course-entry-1-1-dark-desktop.png`
- `11-student-runtime-demo-dark-desktop.png`

结构指标:

- `browser-metrics.json`
- `shell-frame-metrics.json`
- `dark-theme-metrics.json`

## 当前实现判断

### 1. 互动学习入口

健康度: 中等。

页面已经使用 `InteractiveLearningShell`，其内部调用 `AppShell`。截图显示左侧导航、顶部标题和右下角控灵入口已经存在。问题是内容区仍使用 `mx-auto max-w-[1200px]`，在宽屏下形成居中卡片式入口，而不是平台统一的学习工作区。顶部未显示真正的路径面包屑，只显示全局导航与页面标题。

源码证据:

- `src/app/interactive-learning/page.tsx`
- `src/features/interactive/interactive-learning-shell.tsx`

### 2. 互动课程目录

健康度: 中等偏低。

目录页面也走 `InteractiveLearningShell`，但仍是 `mx-auto max-w-[1280px]` 的固定目录容器。课程卡片信息密度较低，模块之间重复“精品课程/模块 N/进入课程”模式。移动端可读但滚动很长，缺少更清晰的课程路径、筛选、当前学习进度和课堂可用状态。

深色主题可用，但视觉效果偏暗、边界弱，像深色表单列表，而不是成熟商业教学平台的课程导航。

源码证据:

- `src/app/interactive-learning/courses/page.tsx`
- `src/features/interactive/learning-catalog`

### 3. 课程入口页

健康度: 低。

具体课程入口没有使用 `AppShell`，而是 `PremiumLessonEntryPage` 自带 `premium-lesson-shell` 和 `premium-lesson-topbar`。它保留了浅蓝/深蓝课程局部视觉系统，缺少平台左侧导航、统一面包屑、统一右上用户入口和统一控灵 dock。桌面宽度固定在 `max-w-[1180px]`，宽屏空间没有转化为教学工作区能力。

这类页面目前不是完全未登记: 路由台账中已登记为 `learning-atlas`。问题是实际渲染还没有服从登记后的 AppShell/route-frame 合同。

源码证据:

- `src/features/interactive/shared/premium-lesson-entry-page.tsx`
- `src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/page.tsx`
- `src/app/interactive-learning/courses/unit-4-1-design-task-expression/page.tsx`
- `src/lib/platform-role-navigation.ts`

### 4. 学生/教师课堂运行态

健康度: 低。

运行态页面继续使用每课独立 `course-header.tsx`、`premium-lesson-shell`、`premium-lesson-main mx-auto max-w-[1180px]`。课堂运行态确实有投影可读的倾向: 字号较大、卡片边界明确、步骤控制固定在顶部。但是它缺少全平台壳层连续性，右下控灵与页面局部浮动控件并存，面包屑缺失，返回路径是局部按钮而不是平台路径轨迹。

学生 demo 页第一屏出现大面积空白图像区域，图片资源未加载或未提供时没有足够明确的教学级 fallback。教师 audit-session 页可进入运行态并显示 `Not found`，说明当前路径不是有效课堂，但页面仍继续渲染部分课堂内容，这应在后续视觉与状态规范中定义。

源码证据:

- `src/features/interactive/unit-1-1-see-the-full-picture/course-header.tsx`
- `src/features/interactive/unit-1-1-see-the-full-picture/student-page.tsx`
- `src/features/interactive/unit-1-1-see-the-full-picture/teacher-page.tsx`
- 多数 `src/features/interactive/unit-*/student-page.tsx` 和 `teacher-page.tsx` 均重复 `premium-lesson-main mx-auto max-w-[1180px]`。

### 5. 章节组件与跨域探索列表

健康度: 中等。

两者都已在 AppShell 下，适合作为轻量入口。但页面仍偏“卡片网格”，缺少统一的二级路径面包屑与清晰的学习对象上下文。跨域探索列表只需壳层统一，不应在本轮重构 Control Odyssey 或十滴水内部。

源码证据:

- `src/app/interactive-learning/chapter-components/page.tsx`
- `src/app/interactive-learning/cross-domain-exploration/page.tsx`

## 规范覆盖差距

已有规范已经覆盖一部分问题:

- `platform-design-system-and-shell`: AppShell 负责全局框架、面包屑、主题、移动导航。
- `platform-role-navigation`: 后续页面应保留 contextual breadcrumbs 和 return target。
- `commercial-workspace-surface-system`: 互动课程运行态属于 dense workspace，需要 context strip、command bar、instrument area、support drawer 等区域。
- `interactive-course-standard-module-migration`: 互动课程模块应通过标准模块 chrome 渲染。

未充分覆盖或需要补强的内容:

- 互动课程入口页从 `premium-lesson-shell` 迁入 AppShell 的具体过渡方案。
- 课堂运行态的 `LessonRuntimeShell` 标准: 学生态、教师态、演示态、失效 session 态如何共用壳层。
- 投影场景视觉模板: 课堂大屏可读字号、区域密度、互动按钮尺寸、当前步骤和倒计时/释放状态位置。
- 互动组件视觉标准: 单选、多选、排序、配对、任务卡、参数输入、图像面板、公式表、代码块、反馈区、教师汇总等组件的统一外观与状态。
- AppShell 左侧导航默认收起与跨页面持久化偏好是否作为平台全局依赖先完成。

## 主要 UX 风险

1. 路径连续性不足。用户从互动学习进入课程后，平台导航消失，回退依赖局部按钮；这与 Arena、虚拟仿真的统一壳层目标不一致。
2. 宽屏空间利用不足。入口、目录、课程入口、运行态均存在全页面 `max-w` 约束，宽屏下只扩大留白，没有形成主工作区、证据区、工具区的布局收益。
3. 课程页视觉语言割裂。AppShell 页面是平台浅灰/深色工作台，课程入口和运行态是独立浅蓝/深蓝“premium lesson”系统。
4. 控灵助手不统一。AppShell 页面已有右下入口，课程入口和运行态缺少统一的上下文接入规范，容易变成页面局部浮动控件。
5. 课堂投影场景缺少专门标准。当前运行态比普通页面更大、更可读，但没有可验收的投影模板，后续课程容易继续产生变体。
6. 互动组件仍以组件自身局部样式拼装。模块标准化已有数据契约，但视觉 chrome、状态层级和课堂/学生双模式还需要统一。

## 可访问性风险

- 课程入口与运行态缺少平台级面包屑，键盘用户和读屏用户难以确认当前层级。
- 固定 topbar、右下浮动按钮和课程局部控件可能在窄屏或缩放后遮挡内容，需要统一 safe-area 与焦点顺序。
- 课程运行态中的大图/视频资源缺失时 fallback 语义不足，截图中出现大面积空白图像区域。
- 深色主题下课程目录边界弱、信息密度高，部分辅助文本对比可能不足，需要按组件级状态验证。
- 移动端课程目录和课程入口滚动很长，关键操作没有统一收纳到顶部或底部命令区。

## 重构方向

### A. InteractiveLearningAtlas

将 `/interactive-learning`、`/interactive-learning/courses`、`/interactive-learning/chapter-components`、`/interactive-learning/cross-domain-exploration` 收敛为同一类 AppShell 学习地图页面:

- 左侧导航默认收起并继承用户跨页面偏好。
- 顶部显示统一面包屑: 例如 `首页 / 互动学习 / 互动课程`。
- 内容区不再整页固定 `max-w`；外层使用流体工作区，只有文本说明、卡片组内部可使用阅读宽度。
- 课程目录应支持当前课程、模块筛选、开放状态、课堂/自学入口和学习证据入口。

### B. CourseEntryShell

将具体课程入口页从 `PremiumLessonEntryPage` 迁入 AppShell:

- 顶部由 AppShell 提供面包屑、主题、用户中心、控灵 dock。
- 课程入口内容分成课程身份、教师启动、学生加入/演示、自学材料、媒体资料、知识路径几块。
- 宽屏使用两到三列工作区，而不是居中 1180px 线性堆叠。
- 深浅主题使用平台 token，不继续扩散独立 `premium-lesson-*` 页面色板。

### C. LessonRuntimeShell

为课堂运行态建立统一壳层，覆盖学生、教师、演示、无效课堂四种状态:

- 保留投影可读性: 当前页标题、步骤进度、主要任务、互动释放状态必须大而清楚。
- 使用 AppShell mission-workspace 或 approved runtime shell，不再每课自带顶栏。
- 主区域以“当前页/主图/任务”为中心，右侧或抽屉承载知识卡片、证据、控灵上下文。
- 教师端命令区与学生端作答区使用同一套状态语义，但角色动作不同。
- 无效 session 不应一边显示 `Not found` 一边继续显示完整课堂内容；需要清晰的阻断态和返回路径。

### D. InteractiveModuleVisualStandard

为组件化互动课程定义视觉标准和验收门禁:

- 内容模块: 文本说明、图片面板、视频/音频、公式卡、表格、代码块、知识卡片。
- 互动模块: 单选、多选、排序、配对、拖拽/匹配、任务卡、参数输入、图形热点、短答、后测。
- 状态模块: 未释放、可作答、已提交、参考答案可见、教师显影、错误/缺失/资源不可用。
- 每类组件都要有桌面、投影、移动、深色、浅色标准，不允许课程本地自定义变体绕过标准 chrome。

### E. Cross-Domain List Shell Only

跨域探索本轮只统一列表入口和进入下级页面的路径连续性:

- 列表页采用同一学习地图框架。
- Control Odyssey 与十滴水内部不做重设计，只保留进入/返回/面包屑/壳层一致性要求。

## 建议 OpenSpec 拆分

1. `unify-interactive-learning-atlas-shell`
   - 统一互动学习入口、课程目录、章节组件、跨域探索列表的 AppShell、面包屑、流体宽度和导航持久态。

2. `migrate-interactive-course-entry-shell`
   - 将所有具体互动课程入口从 `PremiumLessonEntryPage` 局部壳层迁入统一 `CourseEntryShell`。

3. `standardize-lesson-runtime-shell`
   - 建立 `LessonRuntimeShell`，覆盖学生/教师/演示/失效 session，保留 manifest runtime 真源。

4. `define-interactive-module-visual-standards`
   - 定义互动组件视觉标准、投影模式和深浅主题模板，并将标准接入运行态渲染器。

5. `govern-interactive-course-ui-conformance`
   - 增加治理测试，禁止课程页面新增未注册本地壳层、未登记组件 chrome、全页固定宽度和无面包屑下沉页。

## 验收重点

- 桌面 1440px: 左侧导航默认收起；展开/收起偏好跨页面保持；主要内容随可用宽度扩展。
- 移动 390px 和 320px: 全局导航进入 drawer/sheet，课程主任务在首个可用视口内可达。
- 每个多层页面显示统一面包屑；单层首页不强制显示。
- 课程入口、学生运行态、教师运行态均显示统一右下控灵助手，并带当前课程、当前页、当前选择上下文。
- 投影模式下主要文字、按钮和互动任务足够清晰，页面不依赖细小徽标或密集说明完成关键操作。
- 课程组件只能使用已注册的标准视觉模块；未注册模块或页面本地变体应触发测试失败。

## 证据限制

- 截图审计不能证明完整键盘可达性、读屏语义和颜色对比数值，需要后续 Playwright/axe 或等价脚本验证。
- 学生/教师真实课堂协同没有在有效 session 下完整走通；本轮使用 demo 与无效 session 状态观察壳层和视觉问题。
- 当前分支落后 `origin/integration` 1 个提交，正式提案前应先对齐远端再重新确认变更冲突。
