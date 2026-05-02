# Lesson 1-3 Media And Interactive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `1-3` 课次开始落地高优先级静态素材，并把互动课程设计细化到可实现粒度。

**Architecture:** 以 `authoring/lessons/2-2/design/2-2-handout.md`、`interactive-page.md`、`multimedia.md` 为唯一需求源，先落地讲授主干所需的 `td-01`~`td-04` 静态 SVG，再补一份面向前端实现的互动设计说明，明确状态同步、AI 限制、组件职责与数据采集点。素材脚本统一放在 `authoring/lessons/2-2/media/raw/`，产出 SVG 放在 `authoring/lessons/2-2/media/processed/`。

**Tech Stack:** Python3, Matplotlib, Markdown, SVG.

### Task 1: 建立 1-3 媒体生成基线

**Files:**
- Create: `authoring/lessons/2-2/media/raw/matplotlib_font.py`
- Verify: `authoring/lessons/2-2/media/raw/`

**Step 1:** 复用现有课次的字体配置模式，创建 `1-3` 专用 `matplotlib_font.py`。

**Step 2:** 检查 `media/raw/` 与 `media/processed/` 目录可写，确保后续脚本默认输出路径成立。

**Step 3:** 运行一次 Python 导入检查，确认本目录下脚本能够正常引用 `matplotlib_font.py`。

### Task 2: 生成高优先级静态素材 `td-01` ~ `td-04`

**Files:**
- Create: `authoring/lessons/2-2/media/raw/td-01-time-domain-input-response-overview.py`
- Create: `authoring/lessons/2-2/media/raw/td-02-first-order-step-time-constant.py`
- Create: `authoring/lessons/2-2/media/raw/td-03-second-order-response-families.py`
- Create: `authoring/lessons/2-2/media/raw/td-04-time-domain-indices-annotated.py`
- Generate: `authoring/lessons/2-2/media/processed/td-01-time-domain-input-response-overview.svg`
- Generate: `authoring/lessons/2-2/media/processed/td-02-first-order-step-time-constant.svg`
- Generate: `authoring/lessons/2-2/media/processed/td-03-second-order-response-families.svg`
- Generate: `authoring/lessons/2-2/media/processed/td-04-time-domain-indices-annotated.svg`

**Step 1:** 为每张图写独立 Python3 生成脚本，脚本内嵌本图所需的解析式或数值计算逻辑。

**Step 2:** 统一视觉语言：浅底、青蓝主色、重点标注使用橙色/红色，兼容讲义阅读与后续 interactive 复用。

**Step 3:** 逐个运行四个脚本，确认 SVG 文件生成成功且文件名与讲义引用完全一致。

**Step 4:** 用 `ls -l` 与必要的文本抽查确认输出文件存在且非空。

### Task 3: 把互动课程设计细化为可实现说明

**Files:**
- Create: `authoring/lessons/2-2/notes/interactive-implementation.md`
- Modify: `authoring/lessons/2-2/notes/progress.md`

**Step 1:** 从 `design/interactive-page.md` 抽取 P0 互动项：`ic-02`、`ic-03`、`ic-04`、`ic-06`、`ic-07`。

**Step 2:** 为每个互动项补充实现级说明：输入状态、派生状态、教师端控制、学生端反馈、AI 触发限制、事件埋点。

**Step 3:** 增加统一同步机制说明：`currentItemId`、揭示状态、答题解锁、AI 面板开关、媒体高亮联动。

**Step 4:** 更新 `progress.md`，记录本轮已落地素材和新增实现说明。

### Task 4: 生成例题与桥接素材 `td-05` ~ `td-06`

**Files:**
- Create: `authoring/lessons/2-2/media/raw/td-05-example-response-with-indices.py`
- Create: `authoring/lessons/2-2/media/raw/td-06-time-spec-to-pole-region.py`
- Generate: `authoring/lessons/2-2/media/processed/td-05-example-response-with-indices.svg`
- Generate: `authoring/lessons/2-2/media/processed/td-06-time-spec-to-pole-region.svg`

**Step 1:** 复用前面脚本中的二阶响应与指标计算逻辑，生成例题图和极点区域图。

**Step 2:** 确认与 `handout.md` 的例题参数、指标约束完全一致。

**Step 3:** 运行脚本并检查输出路径与文件名。

### Task 5: 总体验证

**Files:**
- Verify: `authoring/lessons/2-2/media/raw/*.py`
- Verify: `authoring/lessons/2-2/media/processed/*.svg`
- Verify: `authoring/lessons/2-2/notes/*.md`

**Step 1:** 运行一轮 `python3` 批量执行脚本，确认全部素材可再生。

**Step 2:** 检查 `handout.md` / `interactive-page.md` 引用的 `td-*` 文件均已存在。

**Step 3:** 汇总已完成项、未完成项和下一轮建议（如进入前端实现或继续补 `ic-*` 原型）。
