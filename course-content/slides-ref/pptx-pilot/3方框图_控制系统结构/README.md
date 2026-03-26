# PPTX 提取验证样本

- 样本对：
  - `course-content/slides-ref/3方框图_控制系统结构.pptx`
  - `course-content/slides-ref/3方框图_控制系统结构.pdf`
- 验证目标：
  - 检查 `pptx` 是否能比 `pdf` 更完整地保留文本、公式、图示结构。
  - 验证“对象级抽取 + 人工校对 + TikZ 重建”是否可行。

## 本轮结论

1. `pptx` 对文本和图形对象的保留显著优于 `pdf`。
2. 对于“方框图组成”“典型连接方式”这类页，标题、说明文字、线段、分组形状、圆形节点都能直接读出。
3. 对于复杂结构图化简页，几何对象可以读出，但块内公式、局部标签并不总能直接从对象文本中恢复，仍需要页面预览或人工辨识补全。
4. 因此后续推荐路线不是“先 OCR 再猜图”，而是：
   - `pptx` 对象层提取为主；
   - OCR 只用于补图中嵌字或截图公式；
   - 典型页人工重建为 `TikZ`。

## 本样本包内容

- [sample-extraction.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/slides-ref/pptx-pilot/3方框图_控制系统结构/sample-extraction.md)
  - 选取第 4、5、11、29 页做对象级提取说明。
- [object-summary.json](/Users/YW/Documents/Site/act.just.edu.cn/course-content/slides-ref/pptx-pilot/3方框图_控制系统结构/object-summary.json)
  - 选定页的递归形状摘要，保留对象类型、位置和可见文本。
- [basic-components-tikz.tex](/Users/YW/Documents/Site/act.just.edu.cn/course-content/slides-ref/pptx-pilot/3方框图_控制系统结构/basic-components-tikz.tex)
  - 依据第 4、5 页内容手工重建的一张 `TikZ` 示意图，用于验证“PPTX -> TikZ”这条路线的可行性。

## 建议

- 若继续批量化，优先处理：
  - `3方框图_控制系统结构`
  - `4信号流图_控制系统拓扑结构`
  - `2.1微分方程_控制系统基础模型`
- 它们最适合沉淀为“文字可检索 + 图示可重建”的教学资源库。
