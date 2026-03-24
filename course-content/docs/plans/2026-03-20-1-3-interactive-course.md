# 1-3 Interactive Course Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 `1-3` 精品互动课程入口页、教师端、学生端、AI 上下文、知识卡片抽屉、runtime 导学模块与课程注册，使页面完整消费 `course-content/runtime/lessons/2-2/*`。

**Architecture:** 以 `unit-1-2` 的层1理论课双端同步骨架为最近参考，以 `L-sum` 的 runtime 首页体验为入口页参考。课程实现拆成三层：`src/lib` 维护 1-3 步骤配置与 AI 上下文，`src/features/interactive/unit-1-3-time-response/` 承载入口页与教师/学生页面，`src/app/interactive-learning/courses/unit-1-3-time-domain-response/` 提供路由入口并在 `learning-catalog` 注册。

**Tech Stack:** Next.js 14、TypeScript、React、Tailwind、NextAuth、现有 `useTeacherLessonSession` / `useStudentLessonSession` 会话框架、runtime lesson loader、全局 AI 上下文注册表。

### Task 1: 修复课程审查脚本的媒体统计

**Files:**
- Modify: `scripts/review_lesson_content.py`
- Create: `tests/test_review_lesson_content.py`

**Step 1: Write the failing test**

```python
def test_extract_expected_code_media_reads_storage_lines():
    multimedia_path = Path('authoring/lessons/2-2/design/multimedia.md')
    expected_media = review_lesson_content.extract_expected_code_media(multimedia_path)
    assert [item['output'] for item in expected_media] == [
        'td-01-time-domain-input-response-overview.svg',
        'td-02-first-order-step-time-constant.svg',
        'td-03-second-order-response-families.svg',
        'td-04-time-domain-indices-annotated.svg',
        'td-05-example-response-with-indices.svg',
        'td-06-time-spec-to-pole-region.svg',
    ]
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_review_lesson_content.py -q`
Expected: FAIL，因为 `extract_expected_code_media(...)` 返回空列表。

**Step 3: Write minimal implementation**

在 `scripts/review_lesson_content.py` 中把正则改为匹配 `media/raw/*.py -> media/processed/*.svg` 的存放行，并返回脚本/输出文件名映射。

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_review_lesson_content.py -q`
Expected: PASS。

**Step 5: Verify export result**

Run: `python3 scripts/review_lesson_content.py --lesson 1-3`
Expected: `runtime/lessons/2-2/review/multimedia-check.json` 中 `generated_assets` 为 6。

### Task 2: 建立 1-3 课程配置与 AI 上下文

**Files:**
- Create: `../src/lib/unit-1-3-course.ts`
- Create: `../src/lib/unit-1-3-ai-contexts.ts`
- Modify: `../src/lib/course-ai-contexts.ts`

**Step 1: Write the failing guard test**

新增一个文本级或 Vitest 守卫，确认 `course-ai-contexts` 已注册 `unit-1-3-time-domain-response-v1`，并且步骤数为 17。

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand` 或针对新增用例的精确命令。
Expected: FAIL，因为 1-3 课程配置尚不存在。

**Step 3: Write minimal implementation**

参照 `unit-1-2-course.ts` 与 `unit-1-2-ai-contexts.ts`：
- 定义 17 步课程步骤、阶段映射、会话键、媒体映射、课程卡片；
- 只为设计稿明确需要 AI 的步骤注册步骤级上下文；
- quick questions 和 system prompt extension 必须围绕预测、验证、反思，而不是泛化问答。

**Step 4: Run test to verify it passes**

Run: 对新增 guard test 的精确命令。
Expected: PASS。

### Task 3: 实现 1-3 课程入口页与 runtime 导学模块

**Files:**
- Create: `../src/app/interactive-learning/courses/unit-1-3-time-domain-response/page.tsx`
- Create: `../src/features/interactive/unit-1-3-time-response/entry-page.tsx`
- Modify: `../src/features/interactive/learning-catalog.ts`

**Step 1: Write the failing guard test**

验证 `FEATURED_LESSONS` / `PREMIUM_LESSONS` 含 1-3 课程，且入口页路由能调用 `loadLessonRuntimeEntry('1-3')`。

**Step 2: Run test to verify it fails**

Run: 对 catalog / route 的测试命令。
Expected: FAIL，因为条目与入口页尚不存在。

**Step 3: Write minimal implementation**

- 仿照 `unit-1-2-block-diagram-simplification/page.tsx` 创建 1-3 入口路由；
- 入口页顶部按技能要求放教师入口、自由浏览、学生入口；
- 复用 `LessonEntryRuntimeSections` 展示知识点网络、卡片预览与讲义入口；
- 在 `learning-catalog.ts` 注册精品课入口。

**Step 4: Run test to verify it passes**

Run: 对应测试命令。
Expected: PASS。

### Task 4: 实现 1-3 教师端/学生端课堂骨架

**Files:**
- Create: `../src/features/interactive/unit-1-3-time-response/course-header.tsx`
- Create: `../src/features/interactive/unit-1-3-time-response/student-page.tsx`
- Create: `../src/features/interactive/unit-1-3-time-response/teacher-page.tsx`
- Create: `../src/features/interactive/unit-1-3-time-response/step-panels.tsx`
- Optional Create: `../src/features/interactive/unit-1-3-time-response/workspace.tsx`

**Step 1: Write the failing guard tests**

至少覆盖：
- 学生端使用页内 AI 弹窗，不跳转外部助手页；
- 页面标题右上角存在“知识卡片”抽屉入口；
- 教师端具备结束课堂按钮、学生名单默认折叠、测验统计/答案揭示入口。

**Step 2: Run test to verify it fails**

Run: 针对新增 guard tests 的命令。
Expected: FAIL。

**Step 3: Write minimal implementation**

- 直接复用 `useTeacherLessonSession` / `useStudentLessonSession` / `useCourseEventTracking`；
- 先实现 17 步骨架、知识卡片抽屉、提交反馈、教师释放/揭示机制；
- 步骤级互动先优先落前测、后测、AI 对照与例题表单，前端绘制型工作区可先实现最小可用版。

**Step 4: Run test to verify it passes**

Run: 对应测试命令。
Expected: PASS。

### Task 5: 补齐 1-3 特有工作区与闭环验证

**Files:**
- Modify: `../src/features/interactive/unit-1-3-time-response/step-panels.tsx`
- Modify: `../src/features/interactive/unit-1-3-time-response/workspace.tsx`
- Modify: `../src/features/interactive/unit-1-3-time-response/student-page.tsx`
- Modify: `../src/features/interactive/unit-1-3-time-response/teacher-page.tsx`
- Modify: `/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/interactive-lesson-implementation/notes/1-3.md`

**Step 1: Write the failing guard tests**

覆盖：
- `step-06` 一阶时间常数滑块联动；
- `step-12` 指标叠加器；
- `step-14` 先个人判断再 AI 对照；
- `step-15` 指标到极点区域联动。

**Step 2: Run test to verify it fails**

Run: 对应 guard tests。
Expected: FAIL。

**Step 3: Write minimal implementation**

- 用已有图表/表单组件优先做最小可交互版；
- 保证教师端可看到统计/词云/答案揭示，学生端有提交状态与等待态；
- 完成后回写课程笔记中的“本次实现内容 / 差异 / 验证记录”。

**Step 4: Run verification**

Run:
- `npm run lint`
- `npm run test`
- 如有精确用例，再补 `npm run test -- --runInBand <pattern>`
- 之后执行浏览器闭环验收。

Expected: 所有命令通过，课程入口可见，runtime 首页、教师端、学生端主链路可操作。
