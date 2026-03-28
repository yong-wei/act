# 题库精修批次 02

本批次聚焦“混排公式”收尾清理，目标是将 `unresolved-formulas.json` 清零，并把剩余 `raw + mixed` 题全部转入可复用的 `cleaned` 状态。

---

## 本批次处理原则

1. 先修抽取器的误报边界，不再把 `(\Delta = 2%)`、`\left[...\right]` 这类正常注记当成 `mixed`
2. 再对真实坏串逐题人工精修，统一改成规范 Markdown 公式或代码块
3. 所有精修题统一设置：
   - `formula_status = clean`
   - `usage_status = cleaned`

---

## 本批次已完成的题目

- `AC-Q-0026`
- `AC-Q-0030`
- `AC-Q-0032`
- `AC-Q-0054`
- `AC-Q-0056`
- `AC-Q-0057`
- `AC-Q-0062`
- `AC-Q-0063`
- `AC-Q-0064`
- `AC-Q-0065`
- `AC-Q-0068`
- `AC-Q-0073`
- `AC-Q-0079`
- `AC-Q-0081`
- `AC-Q-0087`
- `AC-Q-0089`
- `AC-Q-0095`
- `AC-Q-0103`
- `AC-Q-0113`
- `AC-Q-0116`
- `AC-Q-0118`
- `AC-Q-0125`
- `AC-Q-0138`

---

## 典型修复类型

- 修复断裂美元定界符，如 `$...$$...$`、`$$...$...`
- 将方括号串接的伪公式改写为规范独立公式行
- 将混排的 MATLAB/Octave 语句改写为 fenced code block
- 修复根轨迹区间、特征方程展开式和闭环传递函数中的碎裂乘积项
- 修复串联校正、PI/滞后校正题中的分母连写和性能指标公式排版

---

## 收口结果

- `course-content/questions/reports/unresolved-formulas.json` 已清零
- `course-content/questions/reports/extraction-report.json` 中 `mixed_formula_questions = 0`
- 已新增批次回归测试，覆盖本批 23 题的 `cleaned` 持久化状态
