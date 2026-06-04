## Context

Current Konling runtime already validates scope, builds server-owned context, records agent sessions and tool runs, and exposes tools. Active changes will add cited path coaching. This change organizes the same runtime into mode-specific product behaviors and UI contracts.

## Goals / Non-Goals

**Goals:**

- Define mode registry entries for diagnosis explainer, path advisor, resource coach, grading assistant, feedback explainer, class summarizer, and prep coauthor.
- Declare required context, optional context, permitted tools, citation classes, privacy policy, and fallback behavior per mode.
- Expose UI mounting contracts for learning center, resource pages, grading workbench, student feedback, teacher report, and prep-pack pages.
- Ensure low-confidence and missing-context states are visible.

**Non-Goals:**

- Creating a separate Konling runtime.
- Letting client hints expand authorization.
- Providing grading or prep-pack business logic in the mode layer.

## Decisions

### Decision 1: Modes are registered runtime contracts

Each mode should be a contract over context, tools, citations, and UI mounting, not a prompt string scattered through pages.

### Decision 2: Missing capabilities degrade explicitly

If grading, prep-pack, path, or RAG dependencies are unavailable, the corresponding mode should be disabled or downgraded with a visible reason.

### Decision 3: Teachers see summaries by default

Teacher-facing modes should default to privacy-safe summaries and risk signals rather than raw student long chats.

## Validation

- Runtime tests SHALL verify mode context requirements, scope checks, citation requirements, and fallback behavior.
- UI tests SHALL verify mode mounting on representative student and teacher surfaces.
- `rtk openspec validate expand-konling-teaching-assistant-modes --strict` SHALL pass.
