# 课程内容更新流程

状态: active
最后更新: 2026-03-20
摘要: 记录课程运行时内容、预置教案、代码直出媒体和资源注册之间的基本更新顺序；当前已被 `1-1` 精品互动课完整验证。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/00-index.md)
下游: []
相关:
- [../40-domain/20-premium-courses.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/20-premium-courses.md)

## 基本顺序

1. 明确课程目标和课堂步骤
2. 若存在代码直出媒体，先生成到 `course-content/authoring/lessons/<lesson>/media/processed` 做内容审核，不要直接写入 runtime
3. 确认知识卡编排、讲义、媒体源文件和必要的全局知识图增量都已落到 `authoring`
4. 执行 `bash course-content/scripts/export-runtime.sh <lesson>`，生成 `course-content/runtime/lessons/<lesson>`
5. 确认资源注册、课程目录、预置教案、课堂码路由与 AI 上下文接线
6. 更新课堂页与工作区实现
7. 跑针对性测试、`lint/test/build` 并验证入口
