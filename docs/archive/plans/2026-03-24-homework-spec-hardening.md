# Homework Spec Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the homework framework from coarse question outlines to extraction-ready authoring specs so the homework-problem-authoring skill can generate stable problems without crossing module boundaries.

**Architecture:** Treat `course-content/syllabus-refactor/homework-framework.md` as the new source of truth. Harden the framework at two levels: assignment-level boundary cards and per-question authoring contracts. Then upgrade the extraction script and its tests so downstream problem-authoring receives structured fields such as prerequisites, forbidden knowledge, stem contract, and scoring anchors.

**Tech Stack:** Markdown, Python 3, repository script tests, skill documentation

### Task 1: Define the new spec contract

**Files:**
- Modify: `course-content/syllabus-refactor/homework-framework.md`
- Modify: `docs/plans/2026-03-24-homework-spec-hardening.md`

**Step 1: Re-read the current framework and extraction script**

Run: `sed -n '1,260p' course-content/syllabus-refactor/homework-framework.md && sed -n '1,240p' .agents/skills/homework-problem-authoring/scripts/extract_homework_question.py`
Expected: Current framework is too coarse and script only extracts a minimal thin payload.

**Step 2: Define the target field set**

Implementation:
- Assignment-level cards must include:
  - learned capabilities
  - forbidden not-yet-learned knowledge
  - closed-question common constraints
  - open-question boundary
- Per-question specs must include:
  - assignment
  - module/unit mapping
  - question positioning
  - ability
  - prerequisites
  - forbidden knowledge
  - boundary
  - stem contract
  - parameterization policy
  - allowed methods
  - scoring anchors
  - common pitfalls
  - synopsis
  - why-for-exam

### Task 2: Write failing regression tests first

**Files:**
- Modify: `scripts/tests/test_extract_homework_question.py`
- Modify: `scripts/tests/test-homework-problem-authoring-skill.ts`

**Step 1: Update Python extraction test for the new truth path and new fields**

Implementation:
- Point the test framework path to `course-content/syllabus-refactor/homework-framework.md`.
- Assert presence of new extracted fields such as `prerequisites`, `forbidden_knowledge`, `stem_contract`, `scoring_anchors`.

**Step 2: Run the Python test and confirm failure**

Run: `python3 scripts/tests/test_extract_homework_question.py`
Expected: FAIL because the script does not yet extract the new fields and still points at the old framework shape.

**Step 3: Update the skill contract test**

Implementation:
- Assert that the skill references the new framework truth source.

**Step 4: Run the skill test and confirm failure if needed**

Run: `npx --yes tsx scripts/tests/test-homework-problem-authoring-skill.ts`
Expected: May fail if the skill text still points to the old framework path or old extraction assumptions.

### Task 3: Harden the homework framework

**Files:**
- Modify: `course-content/syllabus-refactor/homework-framework.md`

**Step 1: Add assignment-level boundary cards**

Implementation:
- For `HW1` to `HW7`, explicitly state:
  - students already know
  - students do not know yet
  - closed-question shared constraints
  - open-question boundary

**Step 2: Expand all 20 questions into extraction-ready specs**

Implementation:
- Rewrite each question block to the normalized format expected by the extraction script.
- Keep the question IDs stable.

### Task 4: Upgrade extraction and skill references

**Files:**
- Modify: `.agents/skills/homework-problem-authoring/scripts/extract_homework_question.py`
- Modify: `.agents/skills/homework-problem-authoring/SKILL.md`
- Modify: `scripts/tests/test_extract_homework_question.py`
- Modify: `scripts/tests/test-homework-problem-authoring-skill.ts`
- Modify: `docs/ProjectDescription.md`

**Step 1: Extend extraction logic**

Implementation:
- Parse both single-line fields and multi-line bullet sections.
- Emit structured JSON for the new field set.

**Step 2: Switch the source-of-truth path**

Implementation:
- Update skill and tests from `course-content/authoring/shared/homework-framework.md` to `course-content/syllabus-refactor/homework-framework.md`.

### Task 5: Verify the new contract

**Files:**
- Modify: `course-content/syllabus-refactor/homework-framework.md`
- Modify: `.agents/skills/homework-problem-authoring/scripts/extract_homework_question.py`
- Modify: `.agents/skills/homework-problem-authoring/SKILL.md`
- Modify: `scripts/tests/test_extract_homework_question.py`
- Modify: `scripts/tests/test-homework-problem-authoring-skill.ts`
- Modify: `docs/ProjectDescription.md`

**Step 1: Run Python regression test**

Run: `python3 scripts/tests/test_extract_homework_question.py`
Expected: PASS and show the extraction script can parse the richer authoring contract.

**Step 2: Run skill contract test**

Run: `npx --yes tsx scripts/tests/test-homework-problem-authoring-skill.ts`
Expected: PASS and confirm the skill references the new truth source and extraction flow.

**Step 3: Run formatting check**

Run: `git diff --check -- course-content/syllabus-refactor/homework-framework.md .agents/skills/homework-problem-authoring/scripts/extract_homework_question.py .agents/skills/homework-problem-authoring/SKILL.md scripts/tests/test_extract_homework_question.py scripts/tests/test-homework-problem-authoring-skill.ts docs/ProjectDescription.md docs/plans/2026-03-24-homework-spec-hardening.md`
Expected: No whitespace or conflict-marker errors.
