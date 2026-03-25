# L-2d 互动课程收尾与校验计划

## 目标
- 确认 `L-2d` 按 `course-content/authoring/lessons/legacy/L-2d` 设计稿落地到 runtime 课程入口、教师/学生双端、三面板工作区与评分链路。
- 修复当前唯一已知验证断点，使 `L-2d` 定向测试可直接运行通过。
- 回写课程笔记，记录当前真实进度与剩余风险。

## 现状摘要
- `L-2d` 相关 runtime 文件、课程路由、课程配置、教师/学生页面、知识卡抽屉、预设课与定向测试脚本已在工作区存在。
- `npm run build` 已通过，且 `L-2d` 三个路由均出现在 Next.js 构建产物中。
- 4 个定向测试中，3 个已通过；`scripts/tests/test-l2d-runtime-export.ts` 因 ESM 环境下使用 `__dirname` 失败。
- `.codex/skills/interactive-lesson-implementation/notes/L-2d.md` 仍写着“尚无课程代码”，与当前实现不符，需要更新。

## 执行步骤
1. 修复 `scripts/tests/test-l2d-runtime-export.ts` 的路径解析方式，兼容当前 Node ESM 执行方式。
2. 重新运行全部 `L-2d` 定向测试，确认 4 项全部通过。
3. 补充一次 `npm run lint`，确认新增/现有 `L-2d` 文件不引入新的静态检查错误。
4. 更新 `.codex/skills/interactive-lesson-implementation/notes/L-2d.md`：
   - 已实现部分
   - 当前验证结论
   - 剩余风险与后续建议
5. 如需补充项目层说明，再最小化更新 `docs/ProjectDescription.md` 的相关课次描述。
