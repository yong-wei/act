# 22串联校正 提取执行计划

目标：将 `course-content/slides-ref/22串联校正.pptx` 转为资源库正式提取包，产出可引用的 Markdown 教学材料与 TikZ 图。

方法：先根据 PDF 提取与 OOXML 文本识别串联校正的设计目标、结构链路与方法分类，再编写 `README.md`、`extracted.md` 和 4-6 张高价值图示，随后统一编译、转 PNG、清理并更新索引。

验证：正式包内必须存在 `README.md`、`extracted.md`、`tikz/*.tex`、`tikz/*.pdf`、`tikz/rendered/*.png`，且无 `.aux/.log`。
