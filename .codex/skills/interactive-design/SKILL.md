---
name: interactive-design
description: Use when authoring or revising `interactive-page.md` and `interactive-contract.yaml` for this repository's lessons, especially when mapping handout evidence into step pages, defining worked-example reveal rules, preserving handout reading order, specifying teacher/student control semantics, or designing curve interaction panels.
---

# interactive-design — 互动课程设计技能

## 概述

本技能负责作者态互动课程设计，不负责前端实现，也不负责 runtime 审查。它的唯一目标是把讲义中的证据链，转换成可实现、可审查、不可随意降级，且**学生脱离讲稿也能独立理解知识对象与逻辑主线**的双轨设计真源：

- `design/interactive-page.md`
- `design/interactive-contract.yaml`

本技能主文件只保留总流程、职责边界与参考文件入口。凡是例题与推导显影、曲线互动面板、页面顺序与教师/学生控制语义等细则，一律下沉到 `references/`。

## 何时使用

- 用户要求制作、重写或修订 `interactive-page.md`
- 用户要求制作、重写或修订 `interactive-contract.yaml`
- 用户指出某课互动页“图先于逻辑”“例题消失”“推导被压扁”“作答区过于笼统”“教师控制不够”
- 用户要求把讲义内容拆成互动步骤，但强调必须保留讲义逻辑顺序

## 边界

- 本技能负责作者态互动设计与契约。
- 本技能不负责师生端代码、课堂路由、会话同步与运行时埋点落地；这些由 `interactive-lesson-implementation` 负责。
- 本技能不负责讲义正文、知识图谱与 BOPPPS 主线制作；这些由 `lesson` 负责。

## 必读输入

开始前至少读取：

1. `course-content/authoring/lessons/[单元编号]/design/handout.md`
2. `course-content/authoring/lessons/[单元编号]/design/boppps.md`
3. `course-content/authoring/lessons/[单元编号]/manifest.json`
4. `course-content/authoring/knowledge/cards/lessons/[单元编号]/sequence.json`

如已存在旧版互动设计，还必须读取：

5. `course-content/authoring/lessons/[单元编号]/design/interactive-page.md`
6. `course-content/authoring/lessons/[单元编号]/design/interactive-contract.yaml`

## 核心原则

0. **独立学习可理解性是硬门槛**
   - 每一步都要自问：若拿掉讲稿，学生能否仅凭当前页面知道“对象是什么、正在判断什么、为什么现在看这页、结论如何接回主线”。
   - 若答案是否定的，说明该页缺少题面、前提、公式链、图后解释或结论桥接，必须补齐，不能交给教师口头兜底。

1. **讲义顺序优先于视觉包装**
   - 页面顺序、模块顺序与图文先后，默认服从讲义证据链。
   - 图片不得因为“首屏更好看”而被强行顶到页面最上方。

2. **问题、原理、例题、作答必须拆开写清**
   - 原理/定理模块与例题模块必须分离。
   - 例题题面必须完整出现，不能只保留结果、图或摘要。
   - 学生作答区必须明确对应问题，不能只给空白输入框。
   - 不得使用“题面卡”“互动卡”等无教学语义的泛称替代真实模块名称；标题应直接说明对象、问题或方法。

3. **逐步显影只能隐藏步骤，不能隐藏题面**
   - 讲义中完整的推理过程、求解链与推导链，默认做成逐步显影。
   - 首次可隐藏的是步骤，不是题目本身。
   - 逐步显影页必须保留“本页在整堂课中解决什么问题”的静态提示，避免学生只看到碎片步骤。

4. **教师控制必须语义分离**
   - `发放作答`、`开放浏览`、`教师逐步显影`、`显示参考答案` 不是同一个开关。
   - 若这些语义不同，必须在机读契约中拆成独立字段。

5. **学生作答默认隐藏或锁定**
   - 默认优先隐藏作答区；若确需占位，再退化为锁定态。
   - 每个作答步骤优先采用独立小卡片，单独提交。
   - 除前测 / 后测 / 明确声明为题组页的步骤外，单页作答问题默认不超过 2 个；若超过 2 个，必须在设计稿中写明理由。
   - 只要页面同时承担“阅读理解 + 方法判断 + 结果核对”，默认先呈现正文与题面，再呈现作答区；只有纯题组页才允许作答区位于页面最上方。

## 参考文件入口

- 例题、推导、显影与教师/学生浏览控制：`references/worked-example-modules.md`
- 曲线图、设计页与比较页的拆分原则：`references/curve-interaction-panels.md`
- 页面顺序、公式表格排布、作答卡与机读契约字段：`references/page-sequence-and-activity-controls.md`

## 设计流程

### Step 1｜讲义证据单元切分

把讲义中的内容切成证据单元，至少覆盖：

- 对象与题面
- 原理/定理
- 公式链
- 表格
- 图与图后解释
- 例题与求解链
- 结论句
- 误判点

### Step 2｜为证据单元选页面归宿

输出“证据单元升级决策表”，至少写清：

- `证据类型`
- `来源锚点`
- `目标步骤`
- `升级方式`
- `保留元素`
- `不得删减内容`
- `验收点`

### Step 3｜先搭步骤框架，再写细节

先给出步骤列表框架，再逐步补齐每步的：

- 页面模板
- 区域布局
- 模块清单
- 静态承载内容
- 证据顺序
- 互动升级点
- 教师控制
- 学生默认状态
- 学生页预览路径
- 本页脱离讲稿后的自包含检查

### Step 4｜同步产出双轨真源

`interactive-page.md` 与 `interactive-contract.yaml` 必须逐步骤一致，包括：

- 步骤顺序
- 标题
- 页面模板
- 互动类型
- 预览路径
- 教师控制语义
- 学生访问语义

### Step 5｜出稿前检查

必须逐项确认：

- 讲义中的核心对象、公式、图表、例题、结论都已落页
- 任何完整推导链都没有被压成“结果卡”
- 比较页没有吞掉本应单独存在的方法页
- 题面完整可见，逐步显影只控制步骤
- 学生作答卡不是统一大表单
- 教师控制不是单一“释放互动”开关
- 抽掉讲稿后，每一步仍能让学生知道当前对象、任务、关键证据和与主线的连接点
- 所有曲线页都写明基线状态、阅读口令和结论回接，不能只给可操作面板

## 输出要求

### `interactive-page.md`

必须写清：

- 全课总览
- 证据单元升级决策表
- 混合证据顺序表
- 每一步的页面骨架、模块清单、静态承载内容、互动升级点、教师控制、学生默认状态、预览口径
- 每一步的“脱离讲稿自包含检查”或等价说明

### `interactive-contract.yaml`

必须写清：

- `layout`
- `modules`
- `content_blocks`
- `evidence_sequence`
- `interaction_spec`
- `teacher_controls`
- `preview_contract`

若涉及例题显影或学生作答，还必须补齐由参考文件要求的访问与控制字段。

## 常见误用

| 误用 | 正确做法 |
|------|----------|
| 只保留图片与一句结论 | 把题面、公式链、图后解释和结论全部落页 |
| 把例题和原理压进同一个信息块 | 原理模块与例题模块分离 |
| 让学生默认就能展开全部例题步骤 | 默认锁定学生浏览权限，由教师单独控制 |
| 用统一大表单承载整页作答 | 拆成独立小卡片，单独提交 |
| 用比较页替代完整方法页 | 先给方法页，再给比较页 |

## 完成态

只有在以下条件同时满足时，才算完成：

- 双轨真源已写入作者态目录
- 讲义证据链已完整映射
- 例题与推导显影规则已写清
- 曲线图步骤与比较页的拆分合理
- 教师/学生控制语义已写成可实现字段
- 拿掉讲稿后，学生仍可基于互动页理解每个逻辑单元的知识对象、判断动作和主线位置

*版本：v1.0 | 2026-04-16*
