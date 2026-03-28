# 21三频段_各司其职 提取执行计划

目标：将 `course-content/slides-ref/21三频段_各司其职.pptx` 转为资源库正式提取包，产出可引用的 Markdown 教学材料与 TikZ 图。

方法：先依据 PDF 提取与 OOXML 文本确定三频段设计主线、性能约束与算例边界，再编写 `README.md`、`extracted.md` 和 4-6 张高价值图示，最后统一编译、转 PNG、清理并更新索引。

验证：正式包内必须存在 `README.md`、`extracted.md`、`tikz/*.tex`、`tikz/*.pdf`、`tikz/rendered/*.png`，且无 `.aux/.log`。
