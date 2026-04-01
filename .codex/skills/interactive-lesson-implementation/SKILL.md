---
name: interactive-lesson-implementation
description: Use when implementing or upgrading this repository's interactive lessons from `course-content/authoring/lessons/` and reviewed runtime lesson bundles, especially to align new lesson structures, turn reviewed handouts/BOPPPS/media into production pages, and enforce the current premium-course rules around PPT-style content coverage, in-page AI, submission feedback, teacher aggregation, event governance, runtime media, and session sync/performance reuse.
---

# Interactive Lesson Implementation

## Overview

按当前仓库的新体系实现或优化互动课程。把 `course-content/authoring/lessons/.../design/interactive-page.md` 与 `interactive-contract.yaml` 视为双轨设计真源，把 `course-content/runtime/lessons/...` 下经过 `lesson-content-review` 的产物视为已审查输入，把仓库中的课程代码视为待对齐对象。

当前默认基线不再是单一 `L-2c`，而是综合以下已落地课程能力：
- `1-1`：理论型精品互动课的第一页入口、教师/学生双端、提交闭环、教师统计与答案揭示、统一事件链。
- `1-2`：17 步课堂蓝图、页内 AI 弹窗、词云/回复列表、runtime 首页与课堂双线协同。
- `1-3`：增强型工作区、步骤级 AI 上下文、知识卡抽屉、浏览器验收、review/runtime 联动。

**核心原则：**
- 互动课程首先是完整课件，其次才是互动体验。页面必须先承载标题层级、公式、表格、图示、例题、结论，再把最值得升级的位置做成交互。
- 静态页合法且必要；不是每一步都必须互动，页面总数按教学逻辑与覆盖需求决定，不设硬上限。
- 关键知识不得转嫁给互动组件。即使关闭互动，页面也必须保留核心概念、公式、图示、表格、例题和结论。
- 双轨设计真源具有最高优先级：人读 `interactive-page.md`，机读 `interactive-contract.yaml`。实现时必须同时服从二者，不得跳过其一。
- **严格按结构化文档实现。禁止降级实现、禁止偷懒替换、禁止自由发挥补设计。**
- 设计稿中若已明确拖拽、连线、排序、拖槽、路径高亮、热点标注等组件形态，实施阶段不得改成选择题、填空题、文本问答或“先放占位以后再补”。
- 设计稿中若已固定页面模板、区域、模块、文本、公式、图片、表格、教师聚合、AI 边界与学生页预览，实施阶段不得擅自删改、合并、改写或重排。
- 运行时页面必须 `runtime-first`，不能偷偷回读 `authoring` 或历史 `content`。
- 课程页面必须同步接入步骤级 AI 上下文、提交反馈、教师端汇总、统一课程事件与数据治理语义。
- 所有图像都必须是真实媒体：代码直出图、前端真实绘图或 AI 生成图；禁止 ASCII 图。
- 媒体不足时，优先补作者态 `media/raw` / `media/processed`，再导出 runtime；不要把“后续补图”当默认答案。

## 路径与真源

### 1. 先解析真实课次路径

不要假设所有课都在 `legacy/`，也不要假设新课都不在 `legacy/`。先解析出该课真实目录：

- 作者态设计源：
  - `course-content/authoring/lessons/<lesson>/...`
  - 或 `course-content/authoring/lessons/legacy/<lesson>/...`
- runtime 产物：
  - `course-content/runtime/lessons/<lesson>/...`
  - 或 `course-content/runtime/lessons/legacy/<lesson>/...`

实现前先确认这两个目录是否一一对应，再继续。

### 1.5 双轨设计源

若课次已建立双轨设计，作者态设计源默认包括：

- `design/interactive-page.md`
- `design/interactive-contract.yaml`

实现前必须确认：
- 两者都存在
- 步骤顺序一致
- 步骤标题一致
- 互动类型一致
- 学生页预览路径一致

若两者不一致，先回到设计/审查阶段修正，不得带着冲突进入实现。

### 2. 运行时知识与卡片路径

当前正确路径如下：

- 全局节点唯一来源：`course-content/runtime/knowledge/graph/nodes.json`
- 全局关系唯一来源：`course-content/runtime/knowledge/graph/relations.jsonl`
- 全局知识卡唯一来源：`course-content/runtime/knowledge/cards/nodes/`
- 课次局部结构来源：`course-content/runtime/lessons/.../<lesson>/graph-overlay.json`
- 课次首页与步骤编排来源：`course-content/runtime/lessons/.../<lesson>/lesson.json`
- 课次讲义来源：`course-content/runtime/lessons/.../<lesson>/handout.md`
- 审查结果来源：`course-content/runtime/lessons/.../<lesson>/review/*`

互动课程实现不要自创第二套知识卡路径，也不要把 lesson runtime 误写成知识卡正文存放处。

### 3. 已审查输入

默认需要读取：

- `design/interactive-page.md`
- `design/interactive-contract.yaml`（若存在则必读）
- `runtime/.../lesson.json`
- `runtime/.../graph-overlay.json`
- `runtime/.../handout.md`
- `runtime/.../review/boppps.md`
- `runtime/.../review/review-report.md`
- `runtime/.../review/interactive-page-check.json`
- `runtime/.../review/knowledge-card-check.json`
- `runtime/.../review/multimedia-check.json`
- `runtime/.../review/source-manifest.json`

如果这些 runtime/review 产物不存在，先回到 `lesson-content-review`，不要在本技能里顺手补审正文或知识卡。

## 启动方式

如果用户没有明确说明是新课还是改现有课，先问清楚：

1. 是开始一门新课实现，还是优化已有互动课？
2. 课次编号是什么？

如果是优化已有课：
- 先读 `notes/<lesson>.md`
- 再读当前实现入口文件
- 最后确认本轮优化范围

如果是开始新课：
- 先读设计稿和 runtime/review
- 再找 `1-1`、`1-2`、`1-3` 或其他最相近课程做复用基线
- 先给实现计划，再开始改代码

## 工作流

### 1. 先读双轨设计，不得边实现边补设计

实现前先逐步核对双轨设计中已经固定的结构，不得在实现阶段重新发明页面：

- 页面模板、区域布局、模块清单是否已明确
- 固定文本、公式、图片、表格、例题、结论是否已明确
- 互动组件类型、交互规则、干扰项、揭示规则是否已明确
- 埋点摘要、教师聚合、AI 边界、学生页预览路径是否已明确

若这些内容未写明，先回到 `interactive-page.md` / `interactive-contract.yaml` 补设计，不得在实现阶段自由发挥补齐。

禁止把设计稿中已经结构化写死的内容，在实现阶段再“合理化调整”为更简单、更省事的版本。

### 2. 开工前必须建立“设计稿到实现稿对照表”

实现前先在 `notes/<lesson>.md` 写出对照表，再开始改代码。对照表至少包含：

- 设计稿步骤 / 标题
- 人读稿页面模板 / 区域 / 模块 / 固定内容
- 机读稿互动类型 / 交互规则 / 埋点 / 教师聚合 / AI 边界 / 预览路径
- 当前实现位置或缺口
- 本轮处理状态（严格实现 / 缺实现 / 设计冲突待回修）
- 验证方式或证据

建立对照表后，至少核对：

- 步骤数量、标题、顺序、时长
- 每一步的页面模板、区域、模块、静态承载内容是否已实现
- 每一步的互动类型是否与机读契约一致
- 每一步是否发生了降级实现、删减实现或擅自新增设计
- 教师端控制流：释放、揭示、汇总、结束课堂
- 学生页默认预览是否与真实学生页一致
- 首页是否正确消费 runtime 导学、知识图谱、卡片预览与讲义入口
- 媒体是否真的存在，而不是还停留在设计说明

没有对照表，不得直接开工。

### 3. AI / 反馈 / 数据治理设计必须先于实现

每个需要互动的步骤，在动手前明确：

#### AI 上下文

- 是否需要页内 AI 助手
- `topic`
- `learningObjectives`
- `knowledgeType`
- `quickQuestions`
- `systemPromptExtension`

默认做法：
- 在 `src/lib/<lesson>-ai-contexts.ts` 中集中维护步骤级配置
- 在 `src/lib/course-ai-contexts.ts` 中注册课程
- 在学生页步骤切换时调用 `useGlobalAI().updatePageContext(...)`
- AI 交互应以内嵌对话框或抽屉完成，不要跳转旧 `/ai` 页面

#### 学生反馈

至少明确该步骤是否具备：
- `SubmissionStatus` 或同等级提交态提示
- 提交成功反馈
- 防连续提交/防连点的等待态或按钮禁用策略
- 等待教师释放的锁定态
- 教师揭示答案后的参考答案显示
- 允许修正或重提时的反馈文案

#### 教师汇聚

客观题默认要求：
- 显示选项统计
- 可释放活动
- 可揭示答案

文本题默认要求：
- 显示词云
- 默认折叠学生回复列表
- 回复按时间排序

若设计稿已明确教师汇聚组件或禁止记录的高频事件，实现时必须原样遵守，不得擅自增加原始轨迹采集。

#### 课程事件与治理

优先复用统一课程事件链，不要在课程页散写裸字符串。至少判断是否需要：

- `lesson_step_view`
- `lesson_step_leave`
- `lesson_submit`
- `lesson_resubmit`
- `workspace_param_change`
- `ai_panel_open`
- `ai_query_submit`
- `sync_error`
- `session_finalize`

如果新增事件类型或 payload 结构，必须同步检查：
- `src/lib/classroom-analytics/event-taxonomy.ts`
- `src/lib/data-governance/event-normalization.ts`
- `src/lib/data-governance/event-types.ts`
- 相关测试

实现目标不是“埋点能发出去”，而是后续可以沉淀 `LearningFact`。

### 4. 媒体策略

#### 代码直出和线框图优先

遇到以下媒体不足时，优先补真实媒体，而不是 ASCII 或长期占位：

- 时域/频域/根轨迹/伯德图/奈奎斯特等控制图
- 方框图、信号流图、电路图、弹簧阻尼系统等线框图
- 参数对比图、知识结构示意图

制作规则：
- 控制仿真、响应曲线、频域结果：使用 `python3` + `control`
- 方框图/信号流图/电路/机械结构：使用 `tikz-control-draw`
- 作者态脚本放在 `course-content/authoring/lessons/.../<lesson>/media/raw/`
- 审核产物放在 `course-content/authoring/lessons/.../<lesson>/media/processed/`
- 再通过 `bash course-content/scripts/export-runtime.sh <lesson>` 导出到 runtime

不要直接把代码直出图写进 `public/` 当默认正式路径。

#### 外部或 AI 生成媒体

若确实需要外部图片、视频或 AI 图：
- 也先落到作者态 `media/processed/`
- 在页面中最终通过 `/course-runtime/...` 或统一运行时路径消费
- 禁止正式交付保留 ASCII 图、字符框图、字符波形

详细规则见：
- [references/media-and-path-rules.md](references/media-and-path-rules.md)
- [references/runtime-code-generated-media.md](references/runtime-code-generated-media.md)

### 5. 入口页与课堂页约束

#### 首页

首页默认顺序：
1. 教师入口 / 自由浏览 / 学生入口
2. 课程概览与导学
3. runtime 知识点网络
4. 知识卡片预览
5. 讲义入口与讲义详情

硬要求：
- 知识点网络来自 runtime 全局图谱 + lesson overlay
- 关系要有方向，不是无向线
- 讲义必须正确渲染 LaTeX 公式
- 讲义入口与详情区都要支持导出 PDF
- 讲义不能机械截断，要有课程级摘要

#### 课堂页

硬要求：
- 顶部标题区保持完整课件语义，不只剩“当前第几步”
- 非首页知识卡入口统一放在标题区右上角
- 知识卡抽屉统一文案：`知识卡片` / `页面知识卡片`
- 学生页默认窄屏优先
- 当前在线学生列表默认折叠
- 学生端首次跟教师，之后不同步时给出提示并允许手动跳转，不强制追页
- 教师页必须可结束课堂
- 默认预览口径与学生页一致；教师端模板弹窗不是实现验收标准

### 5.5 禁止降级与自由发挥

以下行为一律视为实现不合格：

- 设计稿写的是拖拽配对，实际做成单选题
- 设计稿写的是路径高亮，实际做成文字解释题
- 设计稿写的是三列配对舞台，实际只保留一个下拉框
- 设计稿写了完整表格、公式条、图示，实际删成几行摘要
- 设计稿写明学生演示页预览，实际仍以教师模板弹窗作为验收替代
- 设计稿未要求新增内容，实际擅自加入新问题、新结论、新例题或新交互
- 设计稿信息不全时，实施阶段自行补设计而不回写设计源

正确做法只有两种：

1. 严格实现现有结构化设计
2. 发现设计冲突或缺口时，先回写 `interactive-page.md` 与 `interactive-contract.yaml`，经审查后再实现

### 6. 会话同步与性能约束

优先复用现有会话底座，不重新造轮子：

- `useTeacherLessonSession`
- `useStudentLessonSession`
- `useCourseEventTracking`
- `useInteractiveTracking`
- `/api/session/[sessionId]`
- `/api/session/[sessionId]/stream`

当前规范已经包含：
- Redis 缓存会话状态
- Redis 发布状态变更
- SSE 实时同步
- Redis 不可用时的轮询降级
- 课堂限流

新课默认复用这套链路，不要重新写单课轮询器、手搓同步协议或重复的会话存储。

### 7. 复用当前精品课实现

优先参考：

- `1-1`
  - 课程入口与 runtime 首页导学
  - 教师端释放/显示答案/结束课堂
  - 提交闭环与事件跟踪
- `1-2`
  - 17 步课堂蓝图
  - 词云/回复列表
  - 页内 AI 弹窗
- `1-3`
  - 增强版工作区
  - 步骤级 AI 上下文集中注册
  - 知识卡抽屉与 review/runtime 深度联动

不要再把旧精品课里“重互动、轻课件”的部分当成新规范继续扩散。

## 实现约束

- 优先复用现有课程框架、路由解析、预置教案、课程目录注册与资源注册。
- 新课实现后，必须在 `src/features/interactive/learning-catalog.ts` 注册入口。
- 不把 AI 文案、快捷问题、步骤目标散落在多个组件里。
- 不把大块课程正文硬编码成难以复用的 JSX 常量堆；优先整理为步骤配置、内容块、媒体清单、工作区配置。
- 不在模块里继续散写旧式颜色类；优先复用统一主题变量和现有 premium lesson 视觉基线。
- 公式必须以 LaTeX 形式在页面中正确渲染，不能退化为纯文本近似写法。
- 若实现偏离设计稿，必须在课程笔记中写清楚：来自哪份设计稿、偏离原因、为何更适合平台。

## 闭环验证

收工前必须先完成“完整课件职责”核对，再做“设计稿 vs 实现稿”核对，最后做浏览器验收。至少确认：

- 每一步即使关闭互动，仍保留可讲授的静态核心内容
- 静态页被合理使用来承载概念、公式、表格、图示、例题、结论
- 关键知识没有被转嫁给互动组件、AI 弹窗或提交后反馈区
- 页面先满足完整课件职责，而不是只剩互动骨架
- 首页和课堂页都没有偷偷回读 `authoring`
- 媒体真实可读，且不是 ASCII 占位
- 每个需要 AI 的步骤都接到正确上下文
- 学生提交后有明确提交态、等待态、答案反馈或修正反馈
- 教师端统计、词云、答案揭示、结束课堂都可用
- 课程事件与治理映射没有脱节
- 课程使用统一 session / Redis / SSE 能力，没有单课私有同步方案

验证结果必须写回 `notes/<lesson>.md`，至少留下：
- 设计稿到实现稿对照表的最终状态
- 完整课件职责核对结论
- 浏览器验收或测试证据
- 仍待回补的页面覆盖缺口

推荐至少补一类守卫测试：
- 检查页内 AI 弹窗而非跳转
- 检查提交反馈与教师汇聚存在
- 检查统一事件链接线
- 检查 runtime 首页内容来源

详细规则见：
- [references/verification-and-note-update.md](references/verification-and-note-update.md)
- [references/closed-loop-browser-validation.md](references/closed-loop-browser-validation.md)

## 课程笔记机制

笔记目录：`notes/`

规则：
- 每门课一个文件：`notes/<lesson>.md`
- 优化已有课前先读笔记
- 完成一轮主要实现或核对后必须更新笔记
- 开工前必须写入“设计稿到实现稿对照表”
- 收工前必须补上“完整课件职责核对”和验证记录
- 笔记要记录“当前规范如何在该课落地”，不是只记流水账

如果笔记不存在，使用：

```bash
python3 scripts/init_course_note.py --lesson 1-4 --title "示例标题"
```

## 资源

### scripts/

- `scripts/init_course_note.py`
  - 初始化课程笔记
  - 使用 `python3` 运行

### references/

- `references/media-and-path-rules.md`
  - 外部媒体、AI 图与处理后产物的目录、命名、导出规则
- `references/runtime-code-generated-media.md`
  - 代码直出图、`python3 + control`、`tikz-control-draw` 与 runtime 导出规范
- `references/verification-and-note-update.md`
  - 设计核对、浏览器验收、笔记更新与验证清单
- `references/closed-loop-browser-validation.md`
  - 浏览器闭环验收总则
- `references/browser-validation-teacher-subagent.md`
  - 教师端验收细则
- `references/browser-validation-student-subagent.md`
  - 学生端验收细则

## 快速检查表

- [ ] 已解析真实 authoring/runtime 课次路径，而不是想当然写 `legacy` 或非 `legacy`
- [ ] 已确认课程产物已经过 `lesson-content-review`
- [ ] 已读取 `interactive-page.md`、runtime handout、review 产物与 graph overlay
- [ ] 已先设计完整课件骨架，再设计互动升级位
- [ ] 已确认首页与课堂页都 `runtime-first`
- [ ] 已为步骤级 AI、提交反馈、教师汇聚、课程事件与治理链路写出方案
- [ ] 已确认是否需要 `SubmissionStatus`、等待释放态和防连续提交策略
- [ ] 已确认教师端统计、词云、答案揭示和结束课堂链路
- [ ] 已判断媒体缺口应通过 `media/raw` / `media/processed` 补齐，而不是继续 ASCII 或长期占位
- [ ] 已对控制图使用 `python3 + control`，对线框图使用 `tikz-control-draw`
- [ ] 已优先复用统一 session / Redis / SSE / rate limit 能力
- [ ] 已在课程目录、预置教案、课堂码解析和 AI 注册表中完成接线
- [ ] 已完成设计稿对照验证与浏览器闭环验收
- [ ] 已更新 `notes/<lesson>.md`
