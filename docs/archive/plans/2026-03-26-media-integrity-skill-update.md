# Media Integrity Skill Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为课程内容审核技能补充多媒体完整性与命名一致性检查，并在课程制作技能中同步加入相同的媒体命名硬约束。

**Architecture:** 先在 `lesson-content-review` 中把“媒体完整性”明确成结构性检查的一部分，覆盖封面图、信息图、生成式课件、导入视频、课程视频、播客音频与统一前缀命名；再在 `lesson` 中把这些文件名与命名规则写成制作阶段硬约束，并同步修正现有旧示例，避免技能间互相打架。

**Tech Stack:** Markdown, apply_patch, ripgrep, shell inspection

### Task 1: Extend Review Skill

**Files:**
- Modify: `./.agents/skills/lesson-content-review/SKILL.md`

**Step 1: Add media integrity checks**

- Add explicit checks for the existence of:
  - `[单元编号]-cover-comic.png`
  - `[单元编号]-info.png`
  - `[单元编号]-slides.pdf`
  - `[单元编号]-intro-video.mp4`
  - `[单元编号]-course.mp4`
  - `[单元编号]-audio.m4a`

**Step 2: Add naming consistency checks**

- Require all media, including code-generated figures and line diagrams, to use the lesson-unit prefix.
- Give a canonical example such as `2-1-cover-comic.png`.

**Step 3: Propagate to checklist and mistakes**

- Update workflow, quick checks, and common mistakes so missing files and unprefixed names are treated as review failures.

### Task 2: Extend Lesson Skill

**Files:**
- Modify: `./.agents/skills/lesson/SKILL.md`

**Step 1: Add naming convention as a hard constraint**

- State that all final media deliverables must use the lesson prefix, including AI-generated media, code-generated figures, wire diagrams, PDFs, and audio/video outputs.

**Step 2: Rewrite outdated file examples**

- Replace old examples like `cover-comic.png` and `info.png` with `[单元编号]-cover-comic.png` and `[单元编号]-info.png`.
- Update any referenced prompt/asset examples where needed so the skill remains internally consistent.

### Task 3: Verify Consistency

**Files:**
- Inspect: `./.agents/skills/lesson-content-review/SKILL.md`
- Inspect: `./.agents/skills/lesson/SKILL.md`

**Step 1: Search for stale names**

- Re-scan for old unprefixed examples such as `cover-comic.png`, `info.png`, `slides.pdf`, `intro-video.mp4`, `course.mp4`, and `audio.m4a`.

**Step 2: Confirm rule symmetry**

- Ensure the production skill and the review skill describe the same naming contract and do not impose contradictory requirements.
