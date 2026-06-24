# PPTX Slides Ref Conversion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert every `.pptx` under `course-content/slides-ref/` into a reusable Markdown-plus-TikZ teaching resource package with the same quality bar used for `3方框图_控制系统结构`.

**Architecture:** Each source `pptx` gets one dedicated output directory under `course-content/resource-library/pptx/<stem>/` containing a page-scoped `extracted.md`, a local `README.md`, and a `tikz/` subtree for reconstructed wireframe diagrams plus rendered PNG previews. Extraction uses `python3` + `python-pptx` + OOXML package inspection as the primary source, recovers additional formulas/labels from `ppt/media/*` assets when shape text is incomplete, and treats PDF/OCR only as fallback rather than baseline.

**Tech Stack:** Python 3, `python-pptx`, ZIP/XML inspection, TikZ/LaTeX, ImageMagick, repository Markdown assets

### Task 1: Establish shared contract and tracker

**Files:**
- Create: `course-content/resource-library/pptx/README.md`
- Modify: `course-content/resource-library/pptx/3方框图_控制系统结构/README.md`
- Modify: `course-content/resource-library/pptx/3方框图_控制系统结构/extracted.md`

**Step 1: Define package contract**

- Every extracted package must include:
  - `README.md`
  - `extracted.md`
  - `tikz/*.tex`
  - `tikz/*.pdf`
  - `tikz/rendered/*.png`
- `extracted.md` must embed image previews directly in Markdown.

**Step 2: Create global tracker**

- Add a status table for all `course-content/slides-ref/*.pptx`
- Mark `3方框图_控制系统结构` as completed
- Mark all remaining files as pending

**Step 3: Verification**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
root = Path('course-content/resource-library/pptx')
print(sorted(p.name for p in root.iterdir()))
PY
```

Expected:
- global tracker exists
- completed package is discoverable

### Task 2: Standardize one-file extraction workflow

**Files:**
- Create or reuse per target: `course-content/resource-library/pptx/<stem>/**`
- Modify: `.codex/memory/70-workflows/50-pptx-slides-ref-extraction.md`

**Step 1: Inventory source**

For each `pptx`:

- count slides
- identify non-body pages to exclude
- list slide titles
- inspect `ppt/slides/_rels/slide*.xml.rels`
- inspect `ppt/media/*` assets for formulas, labels, and screenshots

**Step 2: Draft `extracted.md`**

- page scope
- topic summary
- formulas
- example logic
- unresolved gaps called out explicitly

**Step 3: Rebuild core diagrams**

- prefer `TikZ` for block diagrams, signal-flow diagrams, circuits, and other wireframe structures
- compile every `.tex`
- render PNG previews
- embed previews into `extracted.md`

**Step 4: Verification**

Run per package:

```bash
python3 - <<'PY'
from pathlib import Path
pkg = Path('course-content/resource-library/pptx/<stem>')
print((pkg / 'README.md').exists(), (pkg / 'extracted.md').exists())
print(sorted((pkg / 'tikz' / 'rendered').glob('*.png')))
PY
```

Expected:
- package contract satisfied
- preview PNGs generated

### Task 3: Execute in priority batches

**Files:**
- Modify iteratively: `course-content/resource-library/pptx/**`

**Step 1: Batch A, control-structure core**

- `4信号流图_控制系统拓扑结构.pptx`
- `5.1梅森公式_数圈圈与消消乐.pptx`
- `2.1微分方程_控制系统基础模型.pptx`
- `2.2传递函数_控制系统数学模型.pptx`

**Step 2: Batch B, time-domain and modeling**

- `6性能指标_控制效果评价.pptx`
- `7.1衰减振荡_欠阻尼二阶系统.pptx`
- `7.2拉氏变换_工程直觉的数学实现.pptx`
- `8稳定_控制系统首要任务.pptx`
- `9稳态误差_准确性的度量.pptx`

**Step 3: Batch C, root-locus and frequency-domain family**

- remaining files in numerical order

**Step 4: Verification**

After each batch:

```bash
python3 - <<'PY'
from pathlib import Path
root = Path('course-content/resource-library/pptx')
for p in sorted(root.iterdir()):
    if p.is_dir():
        print(p.name, (p/'extracted.md').exists())
PY
```

Expected:
- completed batch packages all have `extracted.md`

### Task 4: Keep memory and tracker in sync

**Files:**
- Modify: `course-content/resource-library/pptx/README.md`
- Modify: `.codex/memory/02-recent-summary.md`
- Modify: `.codex/memory/70-workflows/00-index.md`
- Modify: `.codex/memory/70-workflows/50-pptx-slides-ref-extraction.md`

**Step 1: Update tracker after each completion**

- change status
- add output directory link
- add notes for any unresolved page gaps

**Step 2: Update memory when workflow changes materially**

- new stable recovery technique
- new failure mode
- new tooling constraint

**Step 3: Verification**

Run if available:

```bash
python3 .agents/skills/memory-maintenance/scripts/validate_memory.py
```

Expected:
- no broken memory structure
