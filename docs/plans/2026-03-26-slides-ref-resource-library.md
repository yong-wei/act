# Slides Ref Resource Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable Markdown resource library under `course-content/slides-ref/` so old TeX slides and Chinese PDF slides can be referenced during syllabus refactor and lesson authoring.

**Architecture:** Add a Python extraction script that reads `slides-ref` source assets and writes a structured resource library with `tex/`, `pdf/`, and top-level index files. TeX extraction preserves titles, sections, frame titles, formula blocks, and drawing/code blocks as readable Markdown; PDF extraction produces page-based Markdown with source metadata and normalized text.

**Tech Stack:** Python 3, `pypdf`, repository-local tests under `course-content/tests/`

### Task 1: Define output contract

**Files:**
- Create: `course-content/slides-ref/resource-library/README.md`
- Create: `course-content/slides-ref/resource-library/.gitkeep`
- Create: `course-content/tests/test_extract_slides_ref_resources.py`

**Step 1: Write the failing tests**

- Assert TeX extraction emits:
  - title/subtitle metadata
  - section/subsection headings
  - frame headings
  - fenced `tex` blocks for `tikzpicture`
- Assert PDF markdown formatting emits:
  - source metadata
  - page headings
  - cleaned page text
- Assert full run writes:
  - `resource-library/tex/*.md`
  - `resource-library/pdf/*.md`
  - `resource-library/index.md`
  - `resource-library/manifest.json`

**Step 2: Run test to verify it fails**

Run: `pytest course-content/tests/test_extract_slides_ref_resources.py -q`

Expected: FAIL because extraction script and resource library do not exist yet.

### Task 2: Implement extraction script

**Files:**
- Create: `course-content/scripts/extract_slides_ref_resources.py`

**Step 1: Implement minimal CLI**

- Default input: `course-content/slides-ref`
- Default output: `course-content/slides-ref/resource-library`
- Generate:
  - `tex/<stem>.md`
  - `pdf/<stem>.md`
  - `index.md`
  - `manifest.json`

**Step 2: Implement TeX extraction**

- Parse `title`, `subtitle`, `section`, `subsection`, `frame`
- Clean common Beamer markup into readable Markdown
- Preserve `tikzpicture`, `equation`, `align`, `figure`, `table` blocks in fenced `tex` blocks

**Step 3: Implement PDF extraction**

- Read via `pypdf`
- Extract text page by page
- Normalize whitespace but keep page boundaries

### Task 3: Generate library and verify

**Files:**
- Modify: `course-content/slides-ref/resource-library/**` (generated)

**Step 1: Run tests**

Run: `pytest course-content/tests/test_extract_slides_ref_resources.py -q`

Expected: PASS

**Step 2: Run generator**

Run: `python3 course-content/scripts/extract_slides_ref_resources.py`

Expected:
- Markdown files generated for all `.tex` and `.pdf`
- top-level `index.md` and `manifest.json` generated

**Step 3: Spot check outputs**

- Check one TeX-derived file for headings + drawing block
- Check one PDF-derived file for per-page extraction
- Check index for source-to-output mapping
