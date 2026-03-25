# lesson-content-review 技能实施计划

> **For Codex:** 先用定向测试锁住技能职责与 runtime 导出契约，再实现技能、审查脚本、导出链和 1-2 试跑样例，最后补文档与仓库级验证。

**Goal:** 将 `.codex/skills/interactive-lesson-implementation` 中的课程内容审查职责拆出，形成独立 `lesson-content-review` 技能，并让 `1-2` 课次完成“authoring 审查 -> processed 媒体 -> runtime/review 导出 -> 后续制作可消费”的整条链路。

**Architecture:** 课程正文与知识卡修复统一回写 `course-content/authoring`；`course-content/scripts/review_lesson_content.py` 负责按正文、BOPPPS、知识卡、代码直出媒体的顺序执行检查并汇总审查包；`course-content/scripts/export_runtime.py` 负责把审查完成的讲义、媒体、知识卡和 `review/` 目录导出到 runtime，同时对旧课保留 `media/raw` fallback 兼容。

**Tech Stack:** Markdown authoring、Python 3 审查/导出脚本、TypeScript 定向测试、技能 quick validate

### Task 1: 先写失败测试固定新技能边界

**Files:**
- Create: `scripts/tests/test-lesson-content-review-skill.ts`
- Create: `scripts/tests/test-1-2-review-runtime-export.ts`
- Modify: `scripts/tests/test-interactive-lesson-skill.ts`

**Checks:**
1. 断言存在独立 `lesson-content-review` 技能，并覆盖 handout / practice-guide / assessment-spec / boppps / 知识卡 / multimedia / runtime review 职责。
2. 断言 `interactive-lesson-implementation` 改为依赖已审查 runtime 输入，不再直接承担内容审查。
3. 断言 `1-2` 导出后存在 `runtime/lessons/legacy/1-2/review/*`、runtime 讲义媒体路径改写正确、`lesson.json` 带 review 索引、知识卡和媒体检查结果完整。

### Task 2: 实现新技能与导出链

**Files:**
- Create: `.codex/skills/lesson-content-review/SKILL.md`
- Create: `.codex/skills/lesson-content-review/references/*`
- Create: `course-content/scripts/review_lesson_content.py`
- Modify: `course-content/scripts/export_runtime.py`
- Modify: `.codex/skills/interactive-lesson-implementation/SKILL.md`

**Checks:**
1. 新技能说明清楚输入、顺序、修复边界、runtime 输出契约。
2. 审查脚本会在 authoring 上修复后导出 `runtime/lessons/<lesson>/review`。
3. runtime 导出优先使用 `media/processed`，并对旧课保留兼容路径。

### Task 3: 用 1-2 做首个试跑样例

**Files:**
- Create: `course-content/authoring/knowledge/cards/nodes/*.md`（1-2 缺失卡片）
- Create: `course-content/authoring/lessons/legacy/1-2/media/raw/*.py`
- Create: `course-content/runtime/lessons/legacy/1-2/review/*`
- Create: `course-content/runtime/knowledge/cards/nodes/*.md`
- Modify: `course-content/runtime/knowledge/graph/nodes.json`

**Checks:**
1. `1-2` 的 sequence 涉及卡片全部存在且可导出。
2. `multimedia.md` 中代码直出图全部生成到 `media/processed` 并同步到 runtime。
3. `review-report.md`、`knowledge-card-check.json`、`multimedia-check.json` 能反映通过状态。

### Task 4: 补文档、记忆和仓库级验证

**Files:**
- Modify: `docs/ProjectDescription.md`
- Modify: `.codex/memory/02-recent-summary.md`
- Modify: `.codex/memory/10-project/10-current-state.md`
- Modify: `.codex/memory/70-workflows/30-content-update-flow.md`

**Verification:**
- `npx --yes tsx scripts/tests/test-lesson-content-review-skill.ts`
- `npx --yes tsx scripts/tests/test-1-2-review-runtime-export.ts`
- `npx --yes tsx scripts/tests/test-interactive-lesson-skill.ts`
- `npx --yes tsx scripts/tests/test-runtime-knowledge-export.ts`
- `npx --yes tsx scripts/tests/test-l2c-runtime-export.ts`
- `npx --yes tsx scripts/tests/test-l2d-runtime-export.ts`
- `python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/lesson-content-review`
- `python3 .codex/skills/memory-maintenance/scripts/validate_memory.py`
- `npm run lint`
- `npm run test`
- `npm run build`
