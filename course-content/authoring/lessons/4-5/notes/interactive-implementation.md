# 4-5 互动课程实现对照

## 本轮目标

- 以 `design/4-5-interactive-page.md` 与 `design/4-5-interactive-contract.yaml` 为真源，完成 `4-5` 的 13 步精品互动课本地实现。
- 严格按讲义顺序重排页面：`step-02` 为课程目标，`step-09/10/11` 分别对应讲义 `6.4/6.5/6.6-6.7`，`step-12` 为独立后测，`step-13` 为独立总结。
- 正式页面只读取 `/course-runtime/lessons/4-5/media/...`，不回读 authoring 媒体，不引入曲线联动工作区和页内 AI 面板。

## 真源与实现落点

| 步骤 | 设计稿标题 | 页面模板 / 互动类型 | 内容真源与实现落点 | 当前状态 | 验证要点 |
| --- | --- | --- | --- | --- | --- |
| `step-01` | 无约束候选越界：时间指标更好，为什么仍不可交付 | `failure_evidence_hero_board` / `display` | `interactive-contract.yaml` + `src/lib/unit-4-5-course.ts` + `step-panels.tsx` | 已对齐 | 对象、结构、候选、失败图、问题句与收束句同屏常显 |
| `step-02` | 本次课程目标：完成这轮实践后应能做到什么 | `objective_chain_board` / `display` | 同上 | 已对齐 | 课程目标独立成页，不再混入步骤后段 |
| `step-03` | 自由目标收益与工程复核：更优为什么还不等于可用 | `dual_table_evidence_board` / `display` | 同上 | 已对齐 | 表 1 收益列、表 2 越界列、结论句齐全 |
| `step-04` | 三条硬约束第一次被显性提出 | `constraint_statement_board` / `activity_card_set` | `unit-4-5-course.ts` `step-panels.tsx` `student-page.tsx` `teacher-page.tsx` | 已对齐 | 三条硬约束常显、两张判断卡逐卡提交、参考答案独立揭示 |
| `step-05` | 参数范围与硬约束分别在回答什么 | `constraint_role_split_board` / `activity_card_set` | 同上 | 已对齐 | 设计对象列公式可渲染，职责判断题面公式可渲染 |
| `step-06` | 罚函数把边界写进模型 | `formula_reveal_board` / `teacher_reveal_only` | `unit-4-5-course.ts` `step-panels.tsx` | 已对齐 | 三个公式纵向通栏，解释链逐层显影 |
| `step-07` | 求解输入与六步求解链：求解器究竟在消费什么 | `solver_chain_board` / `teacher_reveal_only` | `unit-4-5-course.ts` `step-panels.tsx` `student-page.tsx` `teacher-page.tsx` | 已对齐 | 表 5 第二列公式可渲染，第一列改为中文，六步链补足细节 |
| `step-08` | 同一权重下，为什么会分出两组最优 | `same_weight_compare_board` / `teacher_reveal_only` | 同上 | 已对齐 | 三条控制器、表 6、比较图常显，解释链显影，隐藏判断卡受教师控制 |
| `step-09` | 权重影响：可行域不变时，收益会怎样被重新分配 | `weight_tradeoff_board` / `teacher_reveal_only` | `unit-4-5-course.ts` `step-panels.tsx` | 已对齐 | 必须使用 `4-5-weight-sweep-constrained-summary.png` |
| `step-10` | 同一主案例下：优化 PID 和优化超前结构为什么会分化 | `structure_compare_board` / `teacher_reveal_only` | `unit-4-5-course.ts` `step-panels.tsx` | 已对齐 | 必须使用 PID / 超前结构对比图，不提前展开 4-6 |
| `step-11` | 三方案闭环比较：当前结果为何可接受但不是终局 | `closure_acceptance_board` / `teacher_reveal_only` | `unit-4-5-course.ts` `step-panels.tsx` | 已对齐 | 表 9、可接受标准、余量告警、收束链同页 |
| `step-12` | 后测：边界、求解与解释是否已经成链 | `posttest_board` / `quiz_group` | `unit-4-5-course.ts` `step-panels.tsx` `student-page.tsx` `teacher-page.tsx` | 已对齐 | 三题后测逐题提交，后测页与总结页分离 |
| `step-13` | 总结：把越界证据、约束翻译与结构边界连成一条链 | `summary_exit_board` / `summary` | `unit-4-5-course.ts` `step-panels.tsx` | 已对齐 | 总结页嵌入 `4-5-info.png`，独立收束课程主线 |

## 关键文件

- 课程真源：`course-content/authoring/lessons/4-5/design/4-5-interactive-page.md`
- 机读合同：`course-content/authoring/lessons/4-5/design/4-5-interactive-contract.yaml`
- runtime 课程定义：`src/lib/unit-4-5-course.ts`
- 隐藏式页面 AI 上下文：`src/lib/unit-4-5-ai-contexts.ts`
- 全局 AI 注册：`src/lib/course-ai-contexts.ts`
- 页面实现：`src/features/interactive/unit-4-5-constraint-aware-parameter-optimization/step-panels.tsx`
- 入口与师生页面：`entry-page.tsx` `student-page.tsx` `teacher-page.tsx`
- App Router：`src/app/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/**`
- 平台接线：`src/features/teacher/preset-lessons/presets/unit-4-5-constraint-aware-parameter-optimization.ts`、`src/features/interactive/learning-catalog.ts`、`src/lib/classroom-session-route.ts`
- 严格审查入口：`course-content/scripts/review_lesson_content.py`

## 本轮实现补记

- `src/lib/unit-4-5-course.ts` 已改为严格贴合 13 步 contract 的本地实现契约，补齐 `summary` 页类型、`S` 阶段、后测与总结拆分，以及 `step-08` 到 `step-13` 的 `aiPageGoal`、`teacherControls`、媒体映射。
- `src/lib/course-ai-contexts.ts` 继续复用 `src/lib/unit-4-5-ai-contexts.ts` 导出的课程元数据与步骤上下文，避免双源。
- `step-panels.tsx` 已补齐课程目标独立页、同权重双最优页、权重扫掠页、结构差异页、三方案闭环页、后测页与总结页；并修正公式渲染、表格公式单元和信息图嵌入。
- `student-page.tsx` 继续只通过 `useGlobalAI().updatePageContext` 注入隐藏式页面上下文，没有页内 AI 卡片或跳转入口。
- 所有正式图片仍只走 `getUNIT_4_5MediaSrc()` 映射到 `/course-runtime/lessons/4-5/media/...`。

## 验证命令

```bash
rtk npm exec vitest run src/features/interactive/__tests__/unit-4-5-course.test.ts src/features/interactive/__tests__/unit-4-5-wiring.test.ts src/features/interactive/__tests__/learning-catalog.test.ts
rtk python3 course-content/scripts/review_lesson_content.py --lesson 4-5 --skip-export --strict-implementation-contract
rtk npm run lint
rtk npm run build
```
