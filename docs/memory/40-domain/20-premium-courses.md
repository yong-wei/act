# 精品课程体系

状态: active
最后更新: 2026-06-12
摘要: 记录精品课程与普通课堂路由的差异，以及当前标准互动课的稳定入口；`1-1` 当前是“看见系统全貌”标准互动课，路由为 `unit-1-1-see-the-full-picture`。
上游:
- [10-lesson-framework.md](10-lesson-framework.md)
下游: []
相关:
- [../20-architecture/30-auth-and-session.md](../20-architecture/30-auth-and-session.md)
- [../70-workflows/30-content-update-flow.md](../70-workflows/30-content-update-flow.md)

## 定义

精品课程是指根据课程内容映射到独立路由段、拥有专用入口页和专用教师/学生课堂页的一类课程。新标准互动课应优先消费 runtime 的 `lesson.json`、`interactive-manifest.json`、讲义、知识图、知识卡和媒体说明，并通过 manifest runtime 与注册模块实现。

## 当前已知课程族

- 标准互动课: `1-1`、`1-2`、`1-3`
- 控制与仿真相关旧课: L-2a、L-2b、L-2c、L-2d、L-sum、Cruise comfort
- 当前 App Router 下还存在 `unit-2-1` 到 `unit-5-6` 等课程页，后续判断具体状态时应查看对应 authoring/runtime 和实现文件，不要只靠旧课程族名称。

## 1-1 当前事实

- `1-1` 的课程定位是“看见系统全貌”，不是旧记忆里的 Laplace 变换课。
- 固定路由段是 `unit-1-1-see-the-full-picture`。
- 入口路由是 `/interactive-learning/courses/unit-1-1-see-the-full-picture`。
- 教师页与学生页位于该路由下的私有 `[sessionId]` 子路由。
- 作者态位于 `course-content/authoring/lessons/1-1`。
- 运行态位于 `course-content/runtime/lessons/1-1`。
- 当前实现入口包括 `src/lib/unit-1-1-course.ts`、`src/lib/lesson-1-1-ai-contexts.ts`、`src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/page.tsx` 和 `src/features/interactive/unit-1-1-see-the-full-picture/*`。
- 作者态材料、互动契约和 acceptance 已齐备；manifest audit 已达到 15 steps、91 modules、0 issues。
- 当前剩余工程口径是把 `1-1` 纳入严格实现契约注册，并补充必要课堂页/e2e 验收。

## 记忆重点

- 课程标题归一化会影响路由映射，但当前新标准课不能只靠标题猜测路由；优先查 `src/lib/platform-role-navigation.ts`、课程列表、App Router 实现和 runtime manifest。
- 同一套 `/api/session` 与 `/state` 能被多门精品课程复用，但前端课堂页实现彼此独立。
- 对于存在代码直出媒体的精品课程，稳定做法是先把输出落到 `authoring/.../media/processed` 审核，再走 runtime 导出链。
- `sync_runtime_knowledge.py --check` 当前仍可能带有 legacy `concepts/*.mdx` 路径预期；对已采用 `cards/nodes/*.md` 与 runtime knowledge cards 的标准课，应结合 review 和 manifest audit 判断就绪状态。
