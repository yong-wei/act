# 20宽备窄用_稳定裕度 提取执行计划

目标：将 `course-content/slides-ref/20宽备窄用_稳定裕度.pptx` 转为资源库正式提取包，产出可引用的 Markdown 教学材料与 TikZ 图。

方法：先基于既有 PDF 提取和 OOXML 结构确认正文页边界、稳定裕度主线与典型示例，再编写 `README.md`、`extracted.md` 和 4-6 张高价值图示，最后统一编译、转 PNG、清理与更新索引。

验证：正式包内必须存在 `README.md`、`extracted.md`、`tikz/*.tex`、`tikz/*.pdf`、`tikz/rendered/*.png`，且无 `.aux/.log`，并更新资源库索引。
