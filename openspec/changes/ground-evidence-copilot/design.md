## Context

The current page creates `evidenceSummary` locally from `source`, `weakPoint`, and `nextStep`. It sends that object as `taskContext`, but the chat route destructures no governed evidence input and builds its runtime from regular page/context fields. The resulting evidence mode is a presentation label rather than a server-verified learning-evidence workflow.

## Design

### 1. Server-owned resolution

When the request identifies Evidence Copilot, the route resolves the current authenticated user first. A dedicated resolver reads the existing governed learner-state/evidence projection for that user and returns a compact student-safe descriptor. The resolver must use the same user scope and source eligibility rules as profile and adaptive-learning consumers.

The resolver may accept bounded navigation hints (`source`, `assignment`, `intent`) to select or explain an entry point, but it must not treat those strings as evidence facts, source references, scores, weak points, or diagnoses.

### 2. Prompt boundary

Only the server projection enters the private model context. The prompt must clearly delimit evidence data from instructions and include availability/limitation metadata. Missing or low-confidence fields remain absent or explicitly marked; they are never replaced with model guesses or fabricated zeros.

### 3. Student-facing state

The page receives or derives a safe Evidence Copilot state containing evidence status, source coverage, confidence/freshness limitations, and a real next action. The UI may describe a known count of zero, but must use “暂无” or “不可用” when the value is unknown because evidence is missing or the service is unavailable.

### 4. Writeback boundary

Answers remain advisory. The change does not write assistant prose into official results, `LearningFact`, leaderboard data, or learner-profile claims. Any future reflection or practice draft must use a separate explicit-save workflow.

## Non-Goals

- Do not accept arbitrary client prompt instructions as task context.
- Do not expose raw private evidence, internal reason codes, or teacher/admin data to students.
- Do not replace the existing general Copilot runtime or conversation library.
- Do not make evidence availability imply mastery or a verified causal diagnosis.

## Verification Strategy

- Unit tests for server resolution and student-safe projection.
- Route tests for authenticated ownership, tampered hints, missing/partial/unavailable evidence, and ordinary chat compatibility.
- Browser acceptance for `/ai/copilot?context=evidence` at desktop and 320px, including truthful limitations and a reachable next action.
- OpenSpec strict validation, focused tests, typecheck, and `git diff --check` at the implementation checkpoint.
