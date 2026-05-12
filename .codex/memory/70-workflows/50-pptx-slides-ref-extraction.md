# PPTX 课件提取为资源库流程

状态: active
最后更新: 2026-03-26
摘要: 记录将 `course-content/slides-ref/*.pptx` 转为“Markdown 正文提取 + TikZ 线框图重建 + PNG 预览”的稳定流程，重点保存本轮从 `3方框图_控制系统结构.pptx` 中总结出的失败模式、补救手段与交付约束。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/00-index.md)
下游: []
相关:
- [../../docs/archive/plans/2026-03-26-pptx-slides-ref-conversion.md](/Users/YW/Documents/Site/act.just.edu.cn/docs/archive/plans/2026-03-26-pptx-slides-ref-conversion.md)
- [../../course-content/resource-library/pptx/README.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/README.md)
- [../../course-content/resource-library/pptx/3方框图_控制系统结构/README.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/3方框图_控制系统结构/README.md)

## 适用场景

- `slides-ref` 下的旧版中文课件 `pptx`
- 需要为大纲重构、讲义创作或互动课设计建立可检索教学资源库
- 课件中含有大量方框图、信号流图、电路图、结构图等线框类图示

## 标准产物

每个源文件建立一个独立目录：

`course-content/resource-library/pptx/<课件名>/`

目录至少包含：

- `README.md`
- `extracted.md`
- `tikz/*.tex`
- `tikz/*.pdf`
- `tikz/rendered/*.png`

其中：

- `extracted.md` 必须按页或按主题整理正文信息
- `extracted.md` 中直接嵌入对应图片，不能只写文件名
- 对缺失信息必须显式标注，不能臆造补写

## 稳定做法

1. 以 `pptx` 为主源，不以 `pdf` 或 OCR 为主源
2. 先用 `python3` + `python-pptx` 读取页数、页标题、可直接提取的文本
3. 再检查 `ppt/slides/_rels/slide*.xml.rels`，确认每页关联的 `ppt/media/*`
4. 对公式、块内标签和局部变量名，优先从 `ppt/media/*.png` 小图块恢复
5. 需要人工识别时，先做媒体拼图样张，再决定 `TikZ` 重建方式
6. 线框类图示统一重建为 `TikZ`
7. `TikZ` 必须编译为 `pdf`，再导出 `png` 预览并做肉眼检查

## 本轮遇到的主要问题与解决方式

### 1. 仅看 shape 文本会丢关键信息

问题：

- 很多页的结构图不是纯文本框，而是 `GROUP + LINE + AUTO_SHAPE`
- 公式、块名、变量名经常不在 `shape.text` 中

解决：

- 不止读 `slide.xml` 的 `<a:t>`
- 同时读 `slide*.xml.rels`，找到关联的 `ppt/media/*.png`
- 用媒体图块恢复 `G`、`H_1`、`1/G`、`R(s)`、`Y(s)` 及公式结果

### 2. 复杂结构图难以直接自动还原

问题：

- 自动抽取能给出几何关系，但不能稳定恢复所有局部标签

解决：

- 先恢复“逻辑结构”和“最终公式”
- 再用 `TikZ` 按教学语义重建，而不是逐像素摹写
- 目标是“信息完整、可复用”，不是机械复刻

### 3. `soffice` 转 PDF 不稳定

问题：

- 当前环境下 `soffice --headless --convert-to pdf` 对 `pptx` 输出不稳定，不能作为主链路依赖

解决：

- 不把 PPTX 转 PDF 作为前置步骤
- 主流程直接读 OOXML 包结构
- 仅在确实需要时再考虑额外可视化辅助

### 4. 单张媒体太多时不易核读

问题：

- 一页可能关联十几到几十个 `ppt/media/*.png`
- 直接逐个查看效率很低

解决：

- 先生成 contact sheet 样张
- 按页分组，而不是把所有媒体混看
- 对关键页单独出样张，例如第 11、12、13、14、15、18、29、30 页

### 5. `TikZ` 编译成功不代表最终可交付

问题：

- 公式、箭头和局部反馈支路可能不遮挡，但整体仍可能不易读

解决：

- 编译后必须导出 `png`
- 对每张关键图做至少一次肉眼检查
- 发现拥挤或线条绕行过度时，直接回改 `TikZ`

## 已验证的可靠命令模式

- 扫描全部 `pptx`：
  - `python3` + `python-pptx`
- 抽取 `slide.xml` 文本：
  - 直接读 `ppt/slides/slide*.xml`
- 抽取每页媒体依赖：
  - 读 `ppt/slides/_rels/slide*.xml.rels`
- 编译 `TikZ`：
  - `pdflatex -interaction=nonstopmode -halt-on-error`
- 导出预览：
  - `magick -density 300 <pdf> -quality 100 <png>`

## 当前推荐顺序

1. 先做“结构与拓扑类”课件，因为最适合沉淀为可复用图元库
2. 再做“建模与时域类”课件
3. 最后做“根轨迹与频域类”课件

## 当前已验证样例

- `3方框图_控制系统结构.pptx`
  - 已完成正式提取
  - 产物位于 `course-content/resource-library/pptx/3方框图_控制系统结构/`
