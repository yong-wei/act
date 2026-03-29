# 3-1 框架升级与讲义修订执行计划

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 把 `3-1` 从“纯极点语言下的稳定底线 + 模态动态入口”升级为“高阶系统低阶近似的双域基础课”，并据此修订学生版讲义、附件与相关元数据。

**Architecture:** 先回写 `syllabus-refactor` 真值文件，正式确认 `3-1` 的新定位、资源采用单和课次框架；再按新框架重写 `handout.md`，把时域模态、频域 `Bode` 对比、卷积数值实验、完整附件代码统一纳入；最后补齐 `manifest` 和图脚本接口，重新导出 PDF 做抽样检查。

**Tech Stack:** Markdown、JSON、`apply_patch`、Octave/control、`python3`、讲义 PDF 导出脚本

### Task 1: 回写大纲真值

**Files:**
- Modify: `course-content/syllabus-refactor/decisions.md`
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/unit-design-details/module3.md`

**Step 1:** 把 `3-1` 的定位升级为“高阶系统低阶近似的双域基础课”。

**Step 2:** 明确 `3-1` 的六段课次框架：模态展开、时域近似、频域 `Bode` 对比、卷积实验、条件与边界、附件代码。

**Step 3:** 更新 `3-1` 的资源融入评审单，新增 `pptx/7.2`、`pptx/6` 为正式输入，继续排除根轨迹和判稳资源。

### Task 2: 修订课次讲义与元数据

**Files:**
- Modify: `course-content/authoring/lessons/3-1/design/handout.md`
- Modify: `course-content/authoring/lessons/3-1/manifest.json`

**Step 1:** 重写 `handout.md` 主体结构，使其覆盖双域近似主线。

**Step 2:** 把卷积从一句话升级为数值实验 + 附录完整推导。

**Step 3:** 在正文中要求所有关键图都绑定明确系统模型、模态分解和解析表达式。

**Step 4:** 更新 `manifest.json` 的课次摘要与节点顺序，使其反映新框架。

### Task 3: 图示与附件接口整理

**Files:**
- Check/Modify: `course-content/authoring/lessons/3-1/media/raw/3-1-pp-02-poles-and-modes.m`
- Check/Modify: `course-content/authoring/lessons/3-1/media/raw/3-1-pp-03-dominant-pole-response-families.m`
- Check/Modify: `course-content/authoring/lessons/3-1/media/raw/3-1-pp-04-modal-superposition-high-order.m`

**Step 1:** 让讲义中的图示说明与脚本职责一致，标明需要补做或修正的图。

**Step 2:** 统一要求附件收录全部出图 `Octave` 代码。

**Step 3:** 若时间允许，先修正明显错误的图示描述，确保讲义不再引用失真的图意。

### Task 4: 导出与验收

**Files:**
- Verify: `course-content/authoring/lessons/3-1/design/handout.md`
- Verify: `course-content/authoring/lessons/3-1/design/handout.pdf`

**Step 1:** 导出新的 `handout.pdf`。

**Step 2:** 抽查首页、双域对比页、卷积实验页、附件代码页。

**Step 3:** 汇总变更、验证结果与尚待补图项。
