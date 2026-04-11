---
name: refine
description: Use when refining student-facing `handout.md` files under `course-content/authoring/lessons/*/design/`, especially when an author-state lesson handout still contains teacher-facing or meta narration, needs tighter wording and a consistent “我们”视角, and the polished result should be written to `design/handout-refine.md` without changing formulas, figures, tables, or syllabus boundaries.
---

# 讲义润色技能（Refine）

## Overview

把 `course-content/authoring/lessons/{unit}/design/handout.md` 润色成学生可直接阅读的 `handout-refine.md`。保留知识内容、公式、图表和章节结构，只调整文风、视角与叙述密度，让讲义更紧凑、更直接，也更贴近学生阅读节奏。

## Workflow

### 1. 确认目标文件

优先处理用户明确指定的单元；若未指定，再列出 `course-content/authoring/lessons/*/design/handout.md` 供选择。

读取这些文件：

1. `course-content/authoring/lessons/{unit}/design/handout.md`
2. `course-content/syllabus-refactor/main.md`
3. `course-content/syllabus-refactor/unit-design-details/module{N}.md`

必要时可把现有的 `course-content/authoring/lessons/{unit}/design/handout-refine.md` 仅作为措辞参考，但输出必须以当前 `handout.md` 为准重新整理，不要沿用过期结构。

### 2. 先判边界，再动文风

在动笔前先确认三件事：

1. 当前课次在模块中的定位和后续接口；
2. 本单元“必须首次出现”的知识点；
3. 哪些内容明确留给后续单元，不能因润色而偷跑。

如果原稿已经与大纲边界高度一致，润色只改表达，不重构知识顺序。

### 3. 逐段润色

按下面顺序处理：

1. 先统一视角和称呼；
2. 再删除作者态、教师态和课程编排元叙述；
3. 再压缩过长过渡段，改成更直接的书面表达；
4. 最后检查单元编号引用、公式与图表完整性。

输出覆盖到 `course-content/authoring/lessons/{unit}/design/handout-refine.md`。

## 润色规则

### 规则 1：只对学生说话

删除或改写这类内容：

- “本节课的教学目的是……”
- “入口课要先把一个动作立住”
- “真正要被学生带走的是……”
- “教师要追问……”
- “从课程结构看……”
- “不急着讨论……先把……立住”

判断标准：如果一句话主要是在解释课程怎样设计、教师为什么这样安排，而不是帮助学生理解知识，那就删掉或改写成内容本身。

### 规则 2：统一成“我们”视角

- 主导视角用“我们”；
- 偶尔可用“你”做提醒；
- 不用“您”；
- 不用命令式教师口吻。

示例：

- “本课先并排回收两个对象” -> “我们先并排回看两个对象”
- “入口课最重要的是” -> “最重要的是”
- “当前先观察，不急着当结论” -> “先持续观察，暂不写成结论”

### 规则 3：元叙述减到最少

允许保留少量必要定位，用来说明本讲与前后内容的衔接；但正文不重复强调“这是模块入口”“这是课程动作”“这节课要训练什么写法”。

优先把下面几类句子压缩掉：

- 讲课程组织方式，而不是讲知识本身；
- 反复强调“这一讲/本课/模块4”的教学角色；
- 把本来可以直接下结论的话，先绕一层“我们真正要做的不是……而是……”。

### 规则 4：表达更直接

- 优先主动句，少用多层转折；
- 能用两句讲清，就不要堆成长句；
- 用现代书面语替换偏“讲课腔”的表达；
- 同一结论不要在相邻段落反复解释。

示例：

- “这正是分析课与设计课的分界线” -> “这就是从分析走向设计的分界线”
- “这一张表，就是 4-1 的真正开场动作” -> “这张表说明”
- “到了这里，真正要被学生带走的” -> “到了这里，真正需要带走的”

### 规则 5：这些内容不改

以下内容原样保留，除非原文本身有明显错字：

- 所有数学公式与推导；
- 所有图片引用及其属性；
- 表格结构、列数和核心数据；
- 章节编号与大标题层级；
- 例题计算步骤；
- 单元知识边界。

### 规则 6：允许的结构微调

可以：

- 合并同层含义的相邻短段；
- 删除纯重复结论；
- 把过强的教学提示改写成自然过渡。

不可以：

- 删除知识点；
- 调换主要章节顺序；
- 新增原稿没有的知识结论；
- 把本单元边界外的内容提前写进来。

## 快速检查

完成后至少检查这些项目：

- `handout-refine.md` 仍覆盖原稿全部公式、图片和表格；
- 不再出现“您”；
- “我们”成为主导视角；
- 教师态/作者态句式显著减少；
- 后续单元编号引用没有在正文里滥用；
- 行文不违背 `main.md` 与对应 `module{N}.md` 的边界。

## 输出说明

完成后向用户汇报三类信息：

1. 主要删改了哪些元叙述或教师态表达；
2. 是否保留了公式、图片、表格和章节结构；
3. 是否补齐或重刷了已有的 `handout-refine.md`。
