# 3-4 互动课程双轨设计与审查执行计划

目标：把 `3-4` 的互动课程设计升级为 V2 双轨真源，并完成一次课程审查导出。

步骤：
1. 对齐 `3-4` 的单元边界、实践课约束、资源采用单与旧审查缺口。
2. 重写 `course-content/authoring/lessons/3-4/design/interactive-page.md`：
   - 补齐 `文档职责 / 表述规则 / 全课总览 / 讲义核心内容映射`
   - 把每一步改写为页面蓝图，而非教师脚本
   - 显式承接不少于 45 分钟的学生实践训练
3. 新增 `course-content/authoring/lessons/3-4/design/interactive-contract.yaml`：
   - 与人读稿逐步骤一一对应
   - 补齐步骤级必需字段
4. 运行 `python3 course-content/scripts/review_lesson_content.py --lesson 3-4`
5. 根据审查结果修正 authoring 源文件并重新导出 runtime 审查包。
6. 汇总最终通过项、剩余风险与验证证据。
