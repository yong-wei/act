# Remaining PPTX Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish all remaining `course-content/slides-ref/*.pptx` extraction packages under `course-content/resource-library/pptx/`.

**Architecture:** Reuse the validated extraction contract already established in the resource library: each PPTX gets a dedicated directory with `README.md`, `extracted.md`, curated `tikz/*.tex`, compiled `tikz/*.pdf`, and rendered `tikz/rendered/*.png`. Work strictly in source order, and for each PPTX follow the same loop: scan OOXML text/media, write semantic extraction, build a small set of high-value reusable diagrams, compile, remove `.aux/.log`, update indexes, and run fresh verification.

**Tech Stack:** Python 3, `python-pptx`, OOXML zip parsing, TeX Live `pdflatex`, ImageMagick `magick`, repository Markdown indexes.

### Task 1: 收尾 `8稳定_控制系统首要任务`

**Files:**
- Create: `course-content/resource-library/pptx/8稳定_控制系统首要任务/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:**
1. 编译 `tikz/*.tex` 为 `pdf/png`
2. 清理 `.aux/.log`
3. 更新索引为 `done`
4. 执行 fresh verification

### Task 2: 完成 `9稳态误差_准确性的度量`

**Files:**
- Create: `course-content/resource-library/pptx/9稳态误差_准确性的度量/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:**
1. 扫描页结构、XML 文本、媒体依赖
2. 写 `README.md` 与 `extracted.md`
3. 生成 4-6 张高价值 `TikZ` 图
4. 编译、清理、更新索引、校验

### Task 3: 完成 `10.1校正_实现控制的手段`

**Files:**
- Create: `course-content/resource-library/pptx/10.1校正_实现控制的手段/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 4: 完成 `10.2时域分析综合`

**Files:**
- Create: `course-content/resource-library/pptx/10.2时域分析综合/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 5: 完成 `11放眼大局_根轨迹法`

**Files:**
- Create: `course-content/resource-library/pptx/11放眼大局_根轨迹法/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 6: 完成 `12根轨迹_基本形态`

**Files:**
- Create: `course-content/resource-library/pptx/12根轨迹_基本形态/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 7: 完成 `13根轨迹_细节修正`

**Files:**
- Create: `course-content/resource-library/pptx/13根轨迹_细节修正/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 8: 完成 `13时域分析习题2025`

**Files:**
- Create: `course-content/resource-library/pptx/13时域分析习题2025/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 9: 完成 `14参数根轨迹_广义定义`

**Files:**
- Create: `course-content/resource-library/pptx/14参数根轨迹_广义定义/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 10: 完成 `15.1根轨迹法_图形化思考`

**Files:**
- Create: `course-content/resource-library/pptx/15.1根轨迹法_图形化思考/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 11: 完成 `15.2根轨迹分析综合`

**Files:**
- Create: `course-content/resource-library/pptx/15.2根轨迹分析综合/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 12: 完成 `19稳定判据_频域的启示`

**Files:**
- Create: `course-content/resource-library/pptx/19稳定判据_频域的启示/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 13: 完成 `20宽备窄用_稳定裕度`

**Files:**
- Create: `course-content/resource-library/pptx/20宽备窄用_稳定裕度/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 14: 完成 `21三频段_各司其职`

**Files:**
- Create: `course-content/resource-library/pptx/21三频段_各司其职/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 15: 完成 `22串联校正`

**Files:**
- Create: `course-content/resource-library/pptx/22串联校正/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2

### Task 16: 完成 `23滞后超前`

**Files:**
- Create: `course-content/resource-library/pptx/23滞后超前/**`
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/index.md`

**Steps:** 同 Task 2
