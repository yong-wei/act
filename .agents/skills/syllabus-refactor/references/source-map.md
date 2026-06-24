# 源文件与使用时机

## 默认主版本

- `note/blueprint.md`
  - 用途：课程重构的唯一持续更新版完整大纲
  - 规则：后续讨论只改这里，不再把 `docs/SyllabusRefactor.md` 当作主版本之外的其他文件当作主版本

## 默认恢复文件

- `note/main.md`
  - 用途：快速恢复当前全局状态

- `note/decisions.md`
  - 用途：恢复关键决策、理由和已否决方案

## 按需读取文件

- `docs/SyllabusRefactor.md`
  - 用途：首次拷贝生成 `note/blueprint.md` 的基线文件；需要追溯初始课程大纲版本时读取

- `docs/ReportRefactor.md`
  - 用途：追溯这份课程大纲背后的成果报告表述与四举措依据

- `.claude/jiaochuang/scoring-rubric.md`
  - 用途：需要把课程设计映射回比赛维度时读取

- `.claude/jiaochuang/implementation.md`
  - 用途：需要检查比赛硬约束、专家反馈或材料规格时读取

- `course-content/docs/course-system-audit-2026-06-04.md`
  - 用途：需要借用“高压质疑、证据导向、系统一致性”视角时读取

## 外部资源处理规则

用户后续补充的培养方案、企业需求、论文、政策、兄弟院校课程大纲等，默认都属于“候选资源”。

处理顺序：

1. 判断是否真的改善课程结构或能力效率
2. 判断是否与当前蓝图冲突
3. 决定保留、改写或舍弃
4. 若采纳，在 `note/decisions.md` 中记录来源与理由
