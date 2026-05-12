# Unit 3-6 Boundary Revision Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 恢复 3-6 讲义中的零点设计详细求解链，并把模块 3 大纲边界修订为允许在 3-6 预先展开 `PD`、测速反馈、超前与非最小相的参数化设计内容。

**Architecture:** 先恢复学生版讲义到带完整时域、频域、非最小相与附录的版本，再同步修改 `module-skeletons.md` 与 `module3.md` 中 3-6 的边界约束，消除“讲义允许、但大纲禁止”的冲突。最终用差异审阅和 `git diff --check` 做文档级核验。

**Tech Stack:** Markdown、仓库内课程大纲文档、git 差异核验

### Task 1: 恢复 3-6 讲义正文

**Files:**
- Modify: `course-content/authoring/lessons/3-6/design/handout.md`

**Step 1: 恢复详细求解链**

恢复以下内容：
- `PD` 时域目标设计的设计点、相角条件、模值条件与验收；
- 测速反馈设计的广义根轨迹等效、参数反推与验收；
- 超前频域设计与同指标下 `PD` 频域设计；
- 非最小相边界与附录保守示例。

**Step 2: 保持课程衔接**

保留 `3-5 -> 3-6 -> 3-7` 的衔接语，确保正文仍说明这是模块 3 中对零点设计的预展开，而非模块 4 的整体设计哲学课。

### Task 2: 修订模块 3 大纲边界

**Files:**
- Modify: `course-content/syllabus-refactor/module-skeletons.md`
- Modify: `course-content/syllabus-refactor/unit-design-details/module3.md`

**Step 1: 修改骨架表**

把 `3-6` 的“主要任务”从单纯比较实验改为“统一对象下的零点设计预展开 + 风险边界验证”。

**Step 2: 修改模块 3 单元边界详情表**

明确 `3-6`：
- 必须首次出现时域/频域目标到零点设计动作的翻译；
- 允许精确参数推导与跨域验收；
- 不承担模块 4 的多目标权衡、约束排序与整体方案哲学。

**Step 3: 修改 3-6 单元详细设计**

把“禁止精确参数推导”和“禁止完整设计实践”改写为：
- 允许在统一对象上做参数化预展开；
- 非最小相可保留附录级保守示例；
- 仍不进入模块 4 的整体设计优化与多场景权衡。

### Task 3: 文档核验

**Files:**
- Check: `course-content/authoring/lessons/3-6/design/handout.md`
- Check: `course-content/syllabus-refactor/module-skeletons.md`
- Check: `course-content/syllabus-refactor/unit-design-details/module3.md`

**Step 1: 运行格式检查**

Run: `git diff --check -- course-content/authoring/lessons/3-6/design/handout.md course-content/syllabus-refactor/module-skeletons.md course-content/syllabus-refactor/unit-design-details/module3.md`

Expected: 无空白或补丁格式错误

**Step 2: 审阅边界关键词**

Run: `rg -n "不做精确参数计算推导|不把实验扩展成完整设计实践|非最小相版本不作为学生全量必做主任务" course-content/syllabus-refactor/unit-design-details/module3.md`

Expected: 旧限制语被替换为新边界表达
