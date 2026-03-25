# 课外展示能力落地执行计划（2026-03-01）

## 背景
- 依据 `docs/ExtraCurricularScript.md` 与 `docs/ExtraCurricularScript_GapPlan_Handoff_2026-03-01.md`
- 用户确认：不做一次性展示表，主链路能力落地；正常路径可访问；`/review` 下有聚合入口

## 执行目标
1. 填充 `data/test_students.md` 全部31个账号数据
2. 为重点账号 `20230010102608` 和 `20230010102605` 构造高对比展示样本
3. 新增教师班级分析聚合能力（热力图、pre/post、题单、补强路径、相关分析）
4. 正常路径接入与评审聚合入口接入

## 实施步骤
1. 数据脚本：实现 `scripts/seed-extracurricular-showcase.mjs` 并执行
2. 后端：实现 `src/lib/extracurricular-analytics.ts` 与 `src/app/api/teacher/classes/[classId]/analytics/route.ts`，扩展 `src/app/api/user/profile/route.ts`
3. 前端：新增 `src/app/teacher/classes/[classId]/analytics/page.tsx`，修改 `src/app/teacher/classes/[classId]/page.tsx` 与 `src/app/(main)/profile/page.tsx`
4. 评审入口：新增 `src/app/review/extracurricular-showcase/page.tsx`，修改 `src/app/review/page.tsx`
5. 文档与验证：更新 `docs/ProjectDescription.md`，执行 `npm run lint && npm run test && npm run build`

## 验收标准
- 班级分析页可展示雷达热力图、前后测对比、题单分发、补强建议、相关趋势
- 个人中心可展示前后测能力变化与推荐学习路径
- `/review` 可一键进入课外展示聚合页
- 31名测试学生均有可展示数据，重点账号差异显著
