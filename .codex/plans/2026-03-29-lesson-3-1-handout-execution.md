# 3-1 学生版讲义执行计划

**Goal:** 在不扩展到教师版讲义、BOPPPS、互动页与知识图谱成稿的前提下，完成 `3-1` 学生版讲义的成品化交付，全部控制图与验证统一切换到 `Octave` 路线。

**Architecture:** 先完成 `3-1` 媒体脚本重跑与正文口径复核，再补齐主线元数据映射，最后导出 `handout.pdf` 并做抽样版面验收。

**Tech Stack:** Markdown、`apply_patch`、`Octave + control`、`python3`、讲义导出脚本、定向 `git diff/status`

### Task 1: 资源与正文复核

**Files:**
- Check: `course-content/authoring/lessons/3-1/media/raw/3-1-pp-01-stability-half-plane.m`
- Check: `course-content/authoring/lessons/3-1/media/raw/3-1-pp-02-poles-and-modes.m`
- Check: `course-content/authoring/lessons/3-1/media/raw/3-1-pp-03-dominant-pole-response-families.m`
- Check: `course-content/authoring/lessons/3-1/media/raw/3-1-pp-04-modal-superposition-high-order.m`
- Check: `course-content/authoring/lessons/3-1/design/handout.md`

**Step 1:** 重新运行 4 个 `Octave` 脚本，确认全部生成 `svg/pdf` 成品。

**Step 2:** 检查 `media/processed/` 产物清单是否完整。

**Step 3:** 复查 `handout.md` 中是否残留 `Python`、禁用句式和手写图表序号。

### Task 2: 元数据补齐

**Files:**
- Modify: `course-content/authoring/shared/lesson-id-map.json`

**Step 1:** 参考现有主线条目格式补入 `3-1` 映射。

**Step 2:** 确认 `canonical_id`、`authoring_lesson_dir`、`runtime_lesson_dir` 等字段一致。

### Task 3: 导出与验收

**Files:**
- Verify: `course-content/authoring/lessons/3-1/design/handout.md`
- Verify: `course-content/authoring/lessons/3-1/design/handout.pdf`
- Verify: `course-content/authoring/shared/lesson-id-map.json`

**Step 1:** 使用统一脚本导出 `handout.pdf`。

**Step 2:** 抽查首页、图表页、公式密集页、附录代码页。

**Step 3:** 汇总本轮 `3-1` 相关变更、验证结果与剩余风险。
