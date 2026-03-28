# Resource Library Chinese Localization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 全面检查并修订 `course-content/resource-library/pptx/` 下所有提取物中的可见英文表述，使正文与图片预览统一为中文表述。

**Architecture:** 只处理读者可见内容，不改文件名、路径名、LaTeX 宏名、样式名和命令。先建立“可见英文”清单，再按目录分批修改 `README.md`、`extracted.md` 与 `tikz/*.tex` 中会渲染到图片上的英文文本；对变更过的 `tikz` 文件重新编译生成 `pdf/png`，最后复扫确认残留。

**Tech Stack:** `rg`、`python3`、Markdown、LaTeX/TikZ、`pdflatex`、ImageMagick `magick`

---

### Task 1: 建立疑似可见英文清单

**Files:**
- Modify: `course-content/resource-library/pptx/**/README.md`
- Modify: `course-content/resource-library/pptx/**/extracted.md`
- Modify: `course-content/resource-library/pptx/**/tikz/*.tex`
- Create: 临时扫描输出（不入库）

**Steps:**
1. 用 `rg` 与 `python3` 组合扫描 Markdown 正文和 TikZ 文本节点。
2. 排除命令名、宏名、路径名、文件扩展名、数学变量。
3. 生成人工修订所需的文件与短语清单。

### Task 2: 修订 Markdown 可见表述

**Files:**
- Modify: `course-content/resource-library/pptx/**/README.md`
- Modify: `course-content/resource-library/pptx/**/extracted.md`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:**
1. 将状态词、说明性标题、预览描述统一改为中文。
2. 保留路径代码、文件名和命令行片段不变。
3. 复查 Markdown 中是否仍存在读者可见英文。

### Task 3: 修订 TikZ 图中的可见英文并重编译

**Files:**
- Modify: `course-content/resource-library/pptx/**/tikz/*.tex`
- Regenerate: `course-content/resource-library/pptx/**/tikz/*.pdf`
- Regenerate: `course-content/resource-library/pptx/**/tikz/rendered/*.png`

**Steps:**
1. 把节点标签、表格单元格、卡片标题和注释性短语改为中文。
2. 逐包重跑 `pdflatex -interaction=nonstopmode -halt-on-error`。
3. 用 `magick -density 300` 重新导出 PNG。
4. 删除 `.aux/.log` 等中间文件。

### Task 4: 全量复扫与结果确认

**Files:**
- Verify: `course-content/resource-library/pptx/**`

**Steps:**
1. 再次扫描全部 Markdown 与 TikZ，确认没有残留可见英文。
2. 抽查若干 PNG，确认图中标签已中文化且未出现遮挡。
3. 汇总仍需人工判断的边界项并报告。
