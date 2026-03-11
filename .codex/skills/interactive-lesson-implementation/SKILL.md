---
name: interactive-lesson-implementation
description: Use when implementing or optimizing this repository's interactive lesson pages from `/Users/YW/JianguoYun/1教学/教学材料-课程/@自动控制原理/@新体系/notes/lessons` design documents, especially for lesson-by-lesson page building, media placeholder planning, design-vs-implementation gap analysis, or maintaining lesson implementation notes.
---

# Interactive Lesson Implementation

## Overview

按外部课程设计文档为本项目实现或优化互动课程页面。把 `notes/lessons/<lesson>/` 视为设计源，把仓库中的实现视为待核对对象；优先复用现有框架、资源注册、埋点和会话同步能力，避免写成孤立页面。

**核心原则：**
- 先确认课程与任务模式，再动手。
- 先核对设计稿与现状，再做实现计划。
- 媒体缺失必须显式提醒，不能默认“以后再补”。
- 可以提出更好的交互方案，但必须先向用户说明原因并纳入计划。
- 实现完成后，必须回到设计文档做一次闭环核对，并更新本技能的课程笔记。

## 启动方式

技能加载后，如果用户没有明确说明“开始哪一课”或“优化哪一课”，先询问：

1. 你要开始设计新课，还是优化现有课？
   - `1. 开始新课设计（推荐）`
   - `2. 优化现有课程`
2. 课程是哪个课次？
   - 先列出 `/Users/YW/JianguoYun/1教学/教学材料-课程/@自动控制原理/@新体系/notes/lessons` 下可用目录，优先给出最相关的 2-3 个选项
   - 允许用户自定义输入

如果用户选择优化现有课，先读取 `notes/<lesson>.md`；若笔记不存在，先创建再继续。

## 工作流

### 1. 锁定设计源

始终读取以下资料，按需补充：
- `notes/lessons/<lesson>/interactive-page.md`
- `notes/lessons/<lesson>/boppps.md`
- `notes/lessons/<lesson>/handout.md`
- `notes/lessons/<lesson>/multimedia.md`（如果存在）

把这些文件当作设计源，不要只根据现有代码继续“顺着改”。

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

### 5. 允许提出更好的交互方案

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

### 6. 实现约束

实现时遵守以下规则：
- 优先复用现有课程框架、会话同步、埋点、资源注册、`InteractiveProvider`
- 非必要不新增接口和新方法；优先改造已有接口进行复用
- 涉及课堂码加入时，必须复用平台统一的课堂会话路由解析，不允许在 `dashboard`、通用加入页或课程入口页硬编码学生/教师跳转路径
- 精品互动课教师页必须提供“结束课堂”入口；如课程会出现在教师后台的进行中课堂列表中，也必须允许从后台停止课堂
- 学生页默认与教师页解耦：首次进入对齐教师页，之后若不同步，应亮起“当前页面与教师不同步，点击跳转”提示，而不是强制自动翻页
- 区分平台级代码与资源级代码边界，不把资源实现塞进页面层
- 不把课程设计文本直接硬编码成不可复用的大块页面逻辑；尽量组织成步骤配置、媒体清单、工作区显示条件等结构化数据
- 页面布局按课程内涵决定：纯文本/静态图页面可不显示互动；需要探索时再显示工作区

### 7. 闭环验证

实现完成后，必须重新执行一次“设计稿 vs 实现稿”核对流程，至少覆盖：
- 步骤数、标题、顺序
- 媒体资源是否可读取
- 教师端/学生端内容与动作是否对应设计稿
- 工作区是否只在需要时出现
- 互动输入、汇总、记录、埋点是否通路正常
- `dashboard`、`/classroom/join`、课程入口页输入同一课堂码后是否落到同一正确课堂页面
- 教师是否能从课程页结束课堂，后台是否能停止进行中的课堂
- 学生端在教师翻页后是否出现不同步提示与手动跳转能力

验证后更新课程笔记，记录：
- 本次实现了什么
- 仍有哪些差异
- 哪些差异是有意偏离，并说明原因
- 哪些媒体还未补齐
- 下次优化建议

验证与笔记更新格式见 [references/verification-and-note-update.md](references/verification-and-note-update.md)。

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
- `references/verification-and-note-update.md`
  - 设计核对流程、验证清单和课程笔记更新规则

### notes/

- `notes/L-2a.md`
  - 当前已记录的 L-2a 实现情况与差异

## 快速检查表

- [ ] 已确认是“开始新课设计”还是“优化现有课”
- [ ] 已读取对应课程设计文档
- [ ] 已核对当前实现与设计稿差异
- [ ] 已检查媒体是否缺失
- [ ] 已向用户提出必要的更优交互建议
- [ ] 已基于仓库现有框架写实施计划
- [ ] 已完成实现
- [ ] 已重新执行设计稿对照验证
- [ ] 已更新 `notes/<lesson>.md`
