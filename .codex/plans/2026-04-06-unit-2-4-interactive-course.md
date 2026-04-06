# 2-4 互动课程执行计划

1. 建立 `2-4` 实现对照表，锁定双轨真源与 `2-3` 复用骨架。
2. 先写 `unit-2-4-course.test.ts` 失败测试，覆盖课程定义、AI 注册、媒体映射与契约对齐。
3. 实现 `src/lib/unit-2-4-course.ts` 与 `src/lib/unit-2-4-ai-contexts.ts`，让课程定义与 AI 注册转绿。
4. 复制并改造 `2-3` 的入口页、教师页、学生页、步骤面板与工作区，完成 `2-4` 静态承载和互动实现。
5. 注册课程目录、课堂路由、预置教案与动态路由页面。
6. 运行 `check_contract_alignment.py --lesson 2-4`、定向 vitest、`npm run lint`、`npm run test`、`npm run build`。
7. 更新 `docs/ProjectDescription.md`，总结验证结果与剩余风险。
