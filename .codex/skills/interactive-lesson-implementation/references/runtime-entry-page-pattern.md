# Runtime 入口页样式基线

## 适用范围

当互动课程需要实现或改造课程入口页，尤其是包含“课前预习台”、运行态媒体接入、讲义阅读/下载入口时，统一以 `2-1` 当前实现为默认基线。

默认参考实现：

- `src/features/interactive/unit-2-1-modeling-language/entry-page.tsx`
- `src/features/interactive/shared/lesson-entry-media-hub.tsx`
- `src/features/interactive/shared/lesson-entry-runtime-sections.tsx`
- `src/lib/course-runtime.ts`
- `course-content/runtime/lessons/2-1/media/2-1-media.md`

## 页面骨架

课程入口页默认分成四层：

1. 上半区入口卡：
   - 教师入口
   - 自由浏览
   - 学生入口
2. 课程概览区：
   - 课程标题
   - 课程总述
   - 本课关键词或能力标签
3. 课前预习台：
   - 上方导语和建议学习顺序
   - 第一行两个通栏视频：先导入视频，再完整课程视频
   - 第二行三类资源：音频、课件、讲义
4. 页面底部统一 runtime 区块：
   - 继续复用知识图谱、知识卡片、讲义弹窗等共享能力

不要把预习资源散落在知识图谱区、讲义入口区或课堂入口区之间。预习台必须是一个独立的、课程导向的入口模块。

## 布局与顺序

### 视频区

- 顺序固定：
  1. 导入视频
  2. 完整课程视频
- 两个视频都使用通栏卡片，页内直接预览。
- 播放框内部不再叠加“视频标签”“资源名角标”等次要标签。
- 视频卡片正文只保留课程导向文案，不暴露任何文件名、路径名、实现名。

### 下半区资源卡

默认三类资源：

1. 音频
2. 课件
3. 讲义

宽屏下音频卡可占更宽列，窄屏时所有卡片按单列堆叠。

### 讲义

- 不再在页面底部另做一份重复的讲义入口模块。
- 讲义在线阅读必须复用现有 `LessonEntryHandoutDialog` / `MdxSlide` 渲染链路。
- 讲义下载继续复用 runtime `handout.pdf` 直下链路。
- 若已有共享入口组件，优先复用，不要为了单课样式再复制出一套新的入口结构。

## 文案来源与拼装

## 总原则

- 页面用户可见文案必须优先从 runtime 文档读取，而不是从 JSX 常量硬编码。
- 用户可见文案只写课程内容，不写“运行态”“索引”“路径”“实现”“挂载”之类工程词。
- 若作者态需要提供导入视频说明，应先把文案写入 runtime `media/<lesson>-media.md`，前端只消费 runtime，不跨回作者态临时取词。

## 视频/音频/课件文案

- 视频、音频、课件卡片正文说明统一读取 `lessonRuntime.mediaResources[*].title`。
- `title` 的来源是 runtime 媒体索引中该节第一条说明行；若说明行缺省，则回退为文件名。
- 当前审查导出会保留已有人工标题；导入视频还可能在原标题后追加一条主题文案，但页面标题仍以第一条人工说明行为准。

### 音频特例

`2-1` 当前已经把音频卡片固定成播客口径。后续若课程也采用“播客型音频卡”，遵守下面规则：

- 卡片标题固定为课程化标题，例如 `《闲聊自控》播客`
- 说明文案按运行态标题动态拼接：
  - `听主持人洛嘉和思稳带来的新一期节目：${resource.title}`
- 除固定壳文案外，具体节目主题仍来自 runtime 文档，不可硬编码主题内容

如果某课不是播客型音频卡，再单独设计，但仍必须把“可变部分”放在 runtime 文档里。

## 讲义文案

- 讲义卡片摘要优先读取 runtime 媒体文档中 `# <lesson>-handout.md` 后的说明块，并通过 `lessonRuntime.handoutSummary` 进入页面。
- 若 runtime `media/<lesson>-media.md` 的 `# <lesson>-handout.md` 节为空，运行时 bundle 可回退到兜底摘要，但不要主动清空已有的人工摘要。
- 删除纯文本截断预览，不再把 `handoutPreview` 当作用户可见摘要区。

## 媒体容器规则

### 视频

- 视频优先页内直接播放。
- 直链视频使用原生 `<video controls playsInline preload="metadata">`
- 非直链但可嵌入的视频可用 `iframe`
- 容器保持 `16:9` 主比例，并提供最小高度，避免窄屏时塌陷
- 屏幕尺寸变化时，嵌入式视频容器要能跟随容器重算

### 音频

- 如果当前链接只是预览页，不要再保留原始嵌入播放器作为正式方案。
- 正式方案应解析出真实音频源后，交给原生 `<audio controls>`。
- 音频区域不要再给固定的卡片高度来“撑框”。
- 只保留自然高度的播放条，并让卡片自身负责留白和边框。
- 不要在播放器上方继续显示“解析实验版”之类实验性文案。

### 课件 PDF

- 课件默认以按钮方式在新标签页打开。
- 若未来某课明确要求页内阅读，再单独设计，不要默认给所有 PDF 做页内嵌入。

### 讲义

- 在线阅读使用现有讲义弹窗渲染链。
- 下载按钮直连 runtime `handout.pdf`。
- 不要重新发明第二套 Markdown 渲染或导出逻辑。

## 课堂外资源埋点

入口页预习台、知识图谱、知识卡片和跨域入口默认都属于课堂外资源行为，不纳入课堂步骤事件语义。实现时遵守以下规则：

- 优先复用现有共享组件；如果页面直接使用 `LessonEntryMediaHub`、`LessonEntryRuntimeSections`、知识卡弹窗链路，就不要把它们已有的资源追踪逻辑删掉或绕开。
- 若必须自定义入口页结构，默认接入 `useResourceInteractionTracking`，不要把资源行为记成 `lesson_step_view`、`lesson_submit` 之类课堂事件。
- 入口页预习区至少覆盖这些事件：
  - 整体曝光：`resource_view`
  - 视频/音频开始播放：`resource_play`
  - 视频/音频关键进度：`resource_progress`
  - 视频/音频完成：`resource_complete`
  - 课件、新标签资源或 iframe 资源打开：`resource_open`
  - 讲义 PDF 下载：`resource_download`
  - 在线阅读讲义弹窗打开：`resource_open`
- 入口页知识区至少覆盖这些事件：
  - 知识图谱节点点击：`knowledge_graph_node_focus`
  - 知识卡片打开：`knowledge_card_open`
- 若入口页还有跨域模块卡片或外部互动模块入口，至少覆盖：`external_module_open`

默认 payload 语义不要丢：

- `surface`：建议沿用 `lesson_entry`
- `pageType`：建议沿用 `resource` 或 `knowledge`
- `targetType`：如 `video` / `audio` / `pdf` / `handout` / `knowledge-node` / `knowledge-card` / `external-module`
- `targetId` / `targetLabel`
- `originPath`

实现目标不只是“控制台里有请求”，还要保证这些事件后续能进入：

- `InteractionLog`
- 个人中心最近活动
- 高价值行为的治理升格链路

## Runtime-first 约束

入口页必须满足：

- 媒体链接来自 `course-content/runtime/lessons/<lesson>/media/<lesson>-media.md`
- 讲义摘要来自同一 runtime 媒体文档中的 `# <lesson>-handout.md`，并经 `lessonRuntime.handoutSummary` 提供给页面
- 讲义下载来自 runtime `handout.pdf`
- 在线讲义正文来自 runtime `<lesson>-handout.md`

不要：

- 不要在页面里硬编码外链
- 不要在页面里硬编码媒体说明文案
- 不要直接从作者态 `media/raw` 或 `design/` 读取用户可见文案

## 组装检查表

- [ ] 入口页已经先读 runtime `media/<lesson>-media.md`
- [ ] 课前预习台顺序为“导入视频 -> 完整课程视频 -> 音频/课件/讲义”
- [ ] 视频说明来自 `resource.title`
- [ ] 音频说明按固定壳 + `resource.title` 动态拼接
- [ ] 讲义摘要来自 `lessonRuntime.handoutSummary`
- [ ] 若 runtime 原文件已有人工摘要，页面没有把它覆盖或忽略
- [ ] 音频只保留正式播放器，不保留旧嵌入或实验字样
- [ ] 已复用共享入口组件，或在自定义结构中显式补齐课堂外资源埋点
- [ ] 入口媒体至少已覆盖 `resource_view/open/play/progress/download/complete`
- [ ] 知识图谱、知识卡片、跨域入口已覆盖各自的课堂外资源事件
- [ ] 未把入口页资源行为误记成课堂步骤事件
- [ ] 页面无工程实现文案泄漏
