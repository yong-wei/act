# L-2b Interactive Lesson Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` before each behavior change and `superpowers:verification-before-completion` before claiming success.

**Goal:** 基于 `course-content/authoring/lessons/legacy/L-2b` 的设计文稿，落地 L-2b 精品互动课程的完整教师端/学生端实现，并将代码直出图片生成到 `course-content/runtime/lessons/legacy/L-2b/media`。

**Architecture:** 复用 L-2a 精品课的双端同步骨架、课堂码路由解析、结束课堂回跳和学生“不同步提示 + 手动跳转”机制；新增 `l2b-course` 课程配置与 `l2b-root-locus` 页面组件，把 17 步设计拆成结构化步骤数据、可复用面板和一个根轨迹工作区。运行时图片不走 `public` 占位路径，而是由 authoring 下的原始 Python 脚本直出到 `course-content/runtime/lessons/legacy/L-2b/media`，页面直接从仓库静态资源路径读取。

**Tech Stack:** Next.js 14、TypeScript、React、Tailwind、现有 `/api/session` 双端同步接口、Python3 + matplotlib、Node assert 脚本测试。

## 设计基线与关键约束

- 设计源：
  - `course-content/authoring/lessons/legacy/L-2b/design/interactive-page.md`
  - `course-content/authoring/lessons/legacy/L-2b/design/boppps.md`
  - `course-content/authoring/lessons/legacy/L-2b/design/handout.md`
  - `course-content/authoring/lessons/legacy/L-2b/design/multimedia.md`
- 技能约束优先于设计稿：
  - 学生端默认窄屏优先，信息节奏更紧凑。
  - 教师端必须保留结束课堂入口。
  - 学生端必须保留“不同步提示 + 手动跳转”，不能强制追页。
  - 完成后必须重新做“设计稿 vs 实现稿”差异核对，并更新 `./.codex/skills/interactive-lesson-implementation/notes/L-2b.md`。
- 用户额外要求：
  - 代码直出图片必须存放在 `course-content/runtime` 下。

## Task 1：建立课程注册骨架

**Files:**
- Create: `src/lib/l2b-course.ts`
- Create: `src/features/interactive/l2b-root-locus/entry-page.tsx`
- Create: `src/features/interactive/l2b-root-locus/course-header.tsx`
- Create: `src/features/interactive/l2b-root-locus/teacher-page.tsx`
- Create: `src/features/interactive/l2b-root-locus/student-page.tsx`
- Create: `src/features/interactive/l2b-root-locus/step-panels.tsx`
- Create: `src/features/interactive/l2b-root-locus/workspace-model.ts`
- Create: `src/features/interactive/l2b-root-locus/workspace.tsx`
- Create: `src/app/interactive-learning/courses/l2b-root-locus-fasttrack/page.tsx`
- Create: `src/app/interactive-learning/courses/l2b-root-locus-fasttrack/teacher/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/l2b-root-locus-fasttrack/student/[sessionId]/page.tsx`
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Create: `src/features/teacher/preset-lessons/presets/l2b-root-locus-fasttrack.ts`
- Modify: `src/lib/classroom-session-route.ts`

**Step 1: 先写失败性测试**

- Create: `scripts/tests/test-l2b-course-registration.ts`
- 断言点：
  - `src/lib/l2b-course.ts` 导出路由段、课程标题和步骤配置。
  - `learning-catalog` 已把 L-2b 挂到精品课程。
  - `preset-lessons/presets/index.ts` 已注册 L-2b 预设课。
  - `classroom-session-route.ts` 已识别 L-2b 标题并统一回到精品课路径。

**Step 2: 运行测试，确认 RED**

Run:
```bash
node --experimental-strip-types scripts/tests/test-l2b-course-registration.ts
```

Expected:
- 失败，提示缺失 `l2b-course` 导出或注册项。

**Step 3: 最小实现**

- 以 `src/lib/l2a-course.ts` 为骨架抽出 L-2b 版本，先完成：
  - 课程常量
  - 17 步基础配置
  - 工作区显示步骤集合
  - 学生状态结构
  - 精品课卡片元数据
- 挂接路由页和预设课文件。
- 在 `classroom-session-route.ts` 增加 L-2b 标题别名。

**Step 4: 运行测试，确认 GREEN**

Run:
```bash
node --experimental-strip-types scripts/tests/test-l2b-course-registration.ts
```

Expected:
- 通过。

## Task 2：先落运行时媒体生成链路

**Files:**
- Modify: `course-content/authoring/lessons/legacy/L-2b/media/raw/sh-01-pole-migration-locus.py`
- Modify: `course-content/authoring/lessons/legacy/L-2b/media/raw/sh-02-root-locus-performance-zones.py`
- Modify: `course-content/authoring/lessons/legacy/L-2b/media/raw/sh-03-root-locus-optimal-damping.py`
- Modify: `course-content/authoring/lessons/legacy/L-2b/media/raw/h-04-example1-root-locus.py`
- Modify: `course-content/authoring/lessons/legacy/L-2b/media/raw/h-05-example2-root-locus-crossing.py`
- Create: `scripts/generate_l2b_runtime_media.py`
- Create: `course-content/runtime/lessons/legacy/L-2b/media/`

**Step 1: 先写失败性测试**

- Create: `scripts/tests/test-l2b-runtime-media.ts`
- 断言点：
  - 运行生成脚本后，以下文件存在：
    - `course-content/runtime/lessons/legacy/L-2b/media/sh-01-pole-migration-locus.svg`
    - `course-content/runtime/lessons/legacy/L-2b/media/sh-02-root-locus-performance-zones.svg`
    - `course-content/runtime/lessons/legacy/L-2b/media/sh-03-root-locus-optimal-damping.svg`
    - `course-content/runtime/lessons/legacy/L-2b/media/h-04-example1-root-locus.svg`
    - `course-content/runtime/lessons/legacy/L-2b/media/h-05-example2-root-locus-crossing.svg`
  - SVG 文本中包含基本标题或坐标标注，避免空文件。

**Step 2: 运行测试，确认 RED**

Run:
```bash
node --experimental-strip-types scripts/tests/test-l2b-runtime-media.ts
```

Expected:
- 失败，提示生成脚本或媒体文件不存在。

**Step 3: 最小实现**

- 给 5 个原始 Python 脚本补齐统一输出参数能力，例如 `--output <path>`。
- 新增 `scripts/generate_l2b_runtime_media.py`，用 `python3` 依次调用 5 个原始脚本，把输出写到 `course-content/runtime/lessons/legacy/L-2b/media`。
- 首轮直接生成 SVG；如页面展示需要，可后续再补 PNG。

**Step 4: 运行测试，确认 GREEN**

Run:
```bash
python3 scripts/generate_l2b_runtime_media.py
node --experimental-strip-types scripts/tests/test-l2b-runtime-media.ts
```

Expected:
- 生成完成，测试通过。

## Task 3：实现步骤配置、页面面板与基础双端同步

**Files:**
- Modify: `src/lib/l2b-course.ts`
- Modify: `src/features/interactive/l2b-root-locus/entry-page.tsx`
- Modify: `src/features/interactive/l2b-root-locus/course-header.tsx`
- Modify: `src/features/interactive/l2b-root-locus/teacher-page.tsx`
- Modify: `src/features/interactive/l2b-root-locus/student-page.tsx`
- Modify: `src/features/interactive/l2b-root-locus/step-panels.tsx`

**Step 1: 先写失败性测试**

- Create: `scripts/tests/test-l2b-mobile-sync.ts`
- 断言点：
  - 学生页复用精品课浅色/浅填充样式。
  - 学生页保留紧凑移动端容器。
  - 教师页包含结束课堂入口。
  - 学生页包含“当前页面与教师不同步”提示和手动跳转 CTA。
  - 步骤面板中存在预测、验证、AI 对比、后测、总结等关键区块文案挂点。

**Step 2: 运行测试，确认 RED**

Run:
```bash
node --experimental-strip-types scripts/tests/test-l2b-mobile-sync.ts
```

Expected:
- 失败。

**Step 3: 最小实现**

- 先用结构化 `L2B_LESSON_STEPS` 覆盖 17 步标题、时长、页面类型、教师控制提示、学生活动区。
- 教师页复用 L-2a 的会话轮询、结束课堂和状态汇总。
- 学生页复用 L-2a 的首次对齐 + 后续不同步提示。
- `step-panels.tsx` 用数据驱动实现：
  - 展示类步骤
  - 填表/问答步骤
  - 测验步骤
  - AI 提示词步骤
  - 总结回顾步骤

**Step 4: 运行测试，确认 GREEN**

Run:
```bash
node --experimental-strip-types scripts/tests/test-l2b-mobile-sync.ts
```

Expected:
- 通过。

## Task 4：实现根轨迹工作区与步骤内门控

**Files:**
- Modify: `src/features/interactive/l2b-root-locus/workspace-model.ts`
- Modify: `src/features/interactive/l2b-root-locus/workspace.tsx`
- Modify: `src/features/interactive/l2b-root-locus/teacher-page.tsx`
- Modify: `src/features/interactive/l2b-root-locus/student-page.tsx`
- Modify: `src/lib/l2b-course.ts`

**Step 1: 先写失败性测试**

- Create: `scripts/tests/test-l2b-workspace-features.ts`
- 断言点：
  - 工作区存在广播模式 / 独立模式切换。
  - step-07 支持教师广播根轨迹拖动，学生端存在只读广播视图。
  - step-14 支持 45° 射线开关、当前 K 值、极点坐标、ζ 值显示。
  - step-10 支持轨迹点击取点信息卡。
  - step-15 支持 AI 提示词复制和三栏对比回显挂点。

**Step 2: 运行测试，确认 RED**

Run:
```bash
node --experimental-strip-types scripts/tests/test-l2b-workspace-features.ts
```

Expected:
- 失败。

**Step 3: 最小实现**

- `workspace-model.ts` 实现：
  - `s^2 + 2s + K = 0` 极点求解
  - 过渡到 `G(s)=K/[s(s+2)]` 的响应估算
  - 阻尼比、超调、调节时间近似计算
  - `step-11` 三阶系统例图数据只读映射
- `workspace.tsx` 实现：
  - 根轨迹 SVG
  - K 滑块
  - 响应曲线小图
  - 性能信息卡
  - 45° 射线开关
  - 点选信息卡
- 教师页增加步骤内控制状态：
  - step-04/16 揭示答案
  - step-07 切换到学生自主模式
  - step-15 依次解锁反思问题
  - step-17 逐条解锁总结结论

**Step 4: 运行测试，确认 GREEN**

Run:
```bash
node --experimental-strip-types scripts/tests/test-l2b-workspace-features.ts
```

Expected:
- 通过。

## Task 5：做设计稿回归、页面验证与笔记回写

**Files:**
- Modify: `./.codex/skills/interactive-lesson-implementation/notes/L-2b.md`
- Modify: `.codex/plans/2026-03-11-l2b-interactive-lesson-implementation.md`
- Modify: `docs/ProjectDescription.md`

**Step 1: 生成并核对实现差异清单**

- 对照 `interactive-page.md` 逐步核对：
  - 步骤数、标题、时长
  - 页面类型
  - 教师控制
  - 学生活动
  - 工作区出现时机
  - 媒体读取路径
- 明确：
  - 已消除差异
  - 保留差异
  - 有意偏离与理由

**Step 2: 运行验证命令**

Run:
```bash
python3 scripts/generate_l2b_runtime_media.py
node --experimental-strip-types scripts/tests/test-l2b-course-registration.ts
node --experimental-strip-types scripts/tests/test-l2b-runtime-media.ts
node --experimental-strip-types scripts/tests/test-l2b-mobile-sync.ts
node --experimental-strip-types scripts/tests/test-l2b-workspace-features.ts
npm run lint
npm run test
```

If feasible after implementation:
```bash
npm run dev
```
再用浏览器核对：
- 课程入口
- 教师创建课堂
- 学生通过课堂码加入
- 教师翻页后学生不同步提示
- step-07 广播/独立切换
- step-14 射线验证
- 教师结束课堂与回跳

**Step 3: 回写文档**

- 更新 `./.codex/skills/interactive-lesson-implementation/notes/L-2b.md`
- 更新 `docs/ProjectDescription.md`
- 在本计划文件追加实际完成状态与剩余差异

## 额外实现提示

- 运行时图片 URL 若无法直接从 `course-content/runtime` 被 Next 静态读取，则最小可行方案是：
  - 保持真实产物在 `course-content/runtime/lessons/legacy/L-2b/media`
  - 页面增加一个薄适配层，将这些文件映射到可读路径
  - 但不得改变“源文件产物存放在 runtime”这一要求
- `step-01` 与 `step-17` 的知识地图优先前端绘制，避免再引入额外静态媒体依赖。
- `step-11` 的三阶系统根轨迹优先直接使用运行时直出图，避免把高阶系统求解逻辑塞进实时工作区。
