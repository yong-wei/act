# 题库精修批次 01

本批次优先处理两类问题：

1. 第 1-2 章中可直接进入课程制作/作业制作的高价值公式题
2. 第 2 章中高频复用、但当前源 DOCX 缺图的基础建模题

---

## 已完成的公式精修

### AC-Q-0006 | 1-6 自整角机随动系统

- 文件：
  - `course-content/questions/questions/AC-Q-0006.md`
  - `course-content/questions/questions/AC-Q-0006.json`
- 处理内容：
  - 将原始裸 LaTeX/混排公式统一为规范 Markdown 公式
  - 修正偏差电压表达式的排版与符号
  - 修正被控量表述，从误写的 `\theta_0` 改为输出角位移 `\theta_\epsilon`
  - 标签从泛化的“频域分析”收紧为“系统组成 / 方框图”
- 当前状态：
  - `formula_status = clean`
  - `usage_status = cleaned`

### AC-Q-0010 | 1-10 系统分类判断

- 文件：
  - `course-content/questions/questions/AC-Q-0010.md`
  - `course-content/questions/questions/AC-Q-0010.json`
- 处理内容：
  - 将题面中的 7 个方程统一改写为规范行内公式
  - 清理错误的括号包裹和积分式乱码
  - 将答案区改成清晰的逐项分类结论
  - 删除误串入的章节标题尾巴
- 当前状态：
  - `formula_status = clean`
  - `usage_status = cleaned`

### AC-Q-0033 | 2-23 双摆系统

- 文件：
  - `course-content/questions/questions/AC-Q-0033.md`
  - `course-content/questions/questions/AC-Q-0033.json`
- 处理内容：
  - 将题面中的变量说明统一为规范行内公式
  - 修复梅森增益公式末尾的断裂行内公式
  - 将运动方程与传递函数表达式整理为连续、可读的 Markdown 公式
- 当前状态：
  - `formula_status = clean`
  - `usage_status = cleaned`

### AC-Q-0090 | 5-1 频率特性定义证明题

- 文件：
  - `course-content/questions/questions/AC-Q-0090.md`
  - `course-content/questions/questions/AC-Q-0090.json`
- 处理内容：
  - 修复复指数展开到三角恒等变换时的花括号混排
  - 统一相位项与三角项的排版，避免行内/行间公式交错断裂
- 当前状态：
  - `formula_status = clean`
  - `usage_status = cleaned`

### AC-Q-0134 | 6-16 汽车点火 PI 校正

- 文件：
  - `course-content/questions/questions/AC-Q-0134.md`
  - `course-content/questions/questions/AC-Q-0134.json`
- 处理内容：
  - 修复开环传递函数与劳斯表中的碎裂公式
  - 将动态性能指标与 MATLAB 验证段落改为规范公式/代码块表达
- 当前状态：
  - `formula_status = clean`
  - `usage_status = cleaned`

### 结构性修复 | AC-Q-0025

- 原问题：
  - 旧抽取逻辑未能识别 `2-16不完整` 这类无空格题头，导致 `2-15` 与 `2-16` 串题
- 当前状态：
  - 已通过修复题头切分逻辑完成分离
  - `AC-Q-0025` 现仅保留 `2-15` 内容，`formula_status = clean`
- 后续建议：
  - `2-15` 不再作为结构污染题处理
  - 后续如需继续优化，应转入题面参数补全与配图核对，而非再次拆题

---

## 已撤销的手工重绘任务

以下结论已撤销：`AC-Q-0012 / AC-Q-0013 / AC-Q-0014` 并非“源 DOCX 缺图”，而是旧抽取器漏掉了题号后表格中的嵌入图片。

- 当前状态：
  - `AC-Q-0012` 已恢复 3 张题面配图
  - `AC-Q-0013` 已恢复 2 张题面配图
  - `AC-Q-0014` 已恢复 2 张题面配图
- 处理结论：
  - 不再进入手工重绘清单
  - 后续缺图判断必须先核对是否存在 `w:tbl` 内嵌图片，再决定是否转入人工绘制

---

## 当前报告口径

- `missing-images.json` 已按 `figure_status = source_missing / text_reference_only` 区分“源 DOCX 缺图”和“仅文字引用示意图”。
- `extraction-report.json` 现应以 `missing_figure_questions`、`source_missing_questions`、`text_reference_only_questions` 为主读字段；`title_only_figures` 仅保留兼容别名。

---

## 下一批建议

完成本批次后，优先继续：

1. `AC-Q-0026` 这类“已拆题、但题面正文仍有脏串接且 `source_ref` 保留 `不完整` 痕迹”的半结构化题
2. 第 3 章中带 MATLAB 响应曲线、但题面图缺失的高价值时域分析题
