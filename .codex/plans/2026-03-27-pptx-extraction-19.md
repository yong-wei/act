# 19稳定判据_频域的启示 提取执行计划

目标：将 `course-content/slides-ref/19稳定判据_频域的启示.pptx` 转为资源库正式提取包，产出可引用的 Markdown 教学材料与 TikZ 线框图。

方法：先依据既有 `pdf`/`pptx` 参考材料确定正文页边界和教学主线，再按教学语义重组 `README.md`、`extracted.md` 与 4-6 张高价值 TikZ 图，之后统一编译、转 PNG、清理中间文件并更新索引。

验证：检查正式包内 `README.md`、`extracted.md`、`tikz/*.tex`、`tikz/*.pdf`、`tikz/rendered/*.png` 完整，且无 `.aux/.log`；同时核对资源库索引已更新。

步骤：
1. 读取提取工作流记忆与 `19` 的现有参考文件。
2. 确定正文页、剔除封面/目录/结束页，提炼教学主线与图示清单。
3. 新建 `course-content/resource-library/pptx/19稳定判据_频域的启示/`。
4. 编写 `README.md`，记录来源、页边界、主题、图示清单与复用提示。
5. 编写 `extracted.md`，按教学逻辑重组关键文本、公式、图示，并直接嵌入 PNG 图。
6. 为关键线框图编写 4-6 个 `tikz/*.tex` 文件。
7. 运行 `pdflatex` 生成 `tikz/*.pdf`。
8. 使用 `magick` 转换 `tikz/rendered/*.png`。
9. 清理 `tikz/*.aux` 与 `tikz/*.log`。
10. 更新 `course-content/resource-library/pptx/README.md` 与 `course-content/resource-library/index.md`。
11. 运行 fresh verification 并记录结果。
