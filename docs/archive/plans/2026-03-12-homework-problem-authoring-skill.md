# Homework Problem Authoring Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a project-local skill that generates homework problems by question ID from `course-content/authoring/shared/homework-framework.md`, using a multi-agent draft-judge-solve workflow with anti-cheating file-access constraints.

**Architecture:** Keep the skill lean in `SKILL.md`, move the deterministic question-id extraction logic into a Python helper script, and place structured prompt/output contracts in `references/`. The main orchestrator may read the framework and prepare a minimal task package, but drafting and solving agents must operate only on that package plus temporary files.

**Tech Stack:** Project-local Codex skills, Python 3 helper script, Markdown references, validation with the bundled `quick_validate.py`.

### Task 1: Create plan and skeleton

**Files:**
- Create: `docs/plans/2026-03-12-homework-problem-authoring-skill.md`
- Create: `.agents/skills/homework-problem-authoring/SKILL.md`
- Create: `.agents/skills/homework-problem-authoring/agents/openai.yaml`

**Step 1: Define skill scope and name**

Choose `homework-problem-authoring` as the folder name. Target a trigger description that explicitly mentions question IDs like `T1-1`, the homework framework file, multi-agent drafting/judging/solving, and anti-cheating constraints.

**Step 2: Initialize the skill directory**

Run:

```bash
python3 /Users/YW/.agents/skills/.system/skill-creator/scripts/init_skill.py \
  homework-problem-authoring \
  --path .agents/skills \
  --resources scripts,references \
  --interface 'display_name=作业题目生成' \
  --interface 'short_description=按题号从作业框架生成完整习题，并通过多智能体裁判与作答复核稳定性' \
  --interface 'default_prompt=使用 $homework-problem-authoring 按题号生成题面、标准答案、评分标准和参考作答。'
```

Expected: new skill directory exists with `SKILL.md`, `agents/openai.yaml`, `scripts/`, and `references/`.

### Task 2: Add deterministic question extraction support

**Files:**
- Create: `.agents/skills/homework-problem-authoring/scripts/extract_homework_question.py`
- Create: `scripts/tests/test_extract_homework_question.py`

**Step 1: Write the failing test**

Add a test that invokes the helper on `T3-2` and asserts the extracted JSON includes:
- `question_id = "T3-2"`
- `question_type = "C"`
- the Chinese title for the item
- the ability and synopsis fields

**Step 2: Run test to verify it fails**

Run:

```bash
python3 scripts/tests/test_extract_homework_question.py
```

Expected: fail because the helper script does not exist yet.

**Step 3: Write minimal implementation**

Implement a Python 3 script that reads the framework file, extracts the exact Part B block for a given question ID, and prints normalized JSON with the fields needed by the orchestrator.

**Step 4: Run test to verify it passes**

Run:

```bash
python3 scripts/tests/test_extract_homework_question.py
```

Expected: pass with no output other than the success marker.

### Task 3: Write the skill instructions and reference contract

**Files:**
- Modify: `.agents/skills/homework-problem-authoring/SKILL.md`
- Create: `.agents/skills/homework-problem-authoring/references/output-contract.md`

**Step 1: Write the trigger description**

Frontmatter should start with `Use when...` and mention:
- user supplies homework question IDs like `T1-1`
- work is based on `course-content/authoring/shared/homework-framework.md`
- another Codex instance needs to generate, judge, and validate assignment problems

**Step 2: Encode the workflow**

Document:
- question-id extraction
- task package construction
- 3 drafting agents
- judge selection via temporary files
- 3 solving agents
- type-specific consensus rules for `C`, `X`, `D`
- second solving round when needed
- final output assembly
- hard rule that drafting/solving agents may not read project files

**Step 3: Encode output contracts**

Put JSON/Markdown output templates, temp directory layout, and acceptance checklist in `references/output-contract.md`.

### Task 4: Validate and pressure-test the skill

**Files:**
- Modify as needed based on validation findings

**Step 1: Run structural validation**

Run:

```bash
python3 /Users/YW/.agents/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/homework-problem-authoring
```

Expected: validation passes.

**Step 2: Re-run the pressure scenario**

Use a subagent with the finished skill instructions available and verify it now preserves:
- temp-file handoff
- correct `C/X/D` consensus rules
- file-access isolation wording

**Step 3: Refactor loopholes**

If the pressure test still leaves ambiguity, tighten `SKILL.md` and `references/output-contract.md`, then re-run the quick validation.
