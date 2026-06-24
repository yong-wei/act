## Context

Simulation and Arena governance specs already define compact summaries, preview/official boundaries, user isolation, replay confidence, and hidden-internal restrictions. This change consumes those contracts to decide whether a control-correction path is complete, failed, or needs fallback.

## Goals / Non-Goals

**Goals:**

- Define terminal validation states for simulation and Arena.
- Connect validation outcomes to path status, current node, alternatives, fallback generation, and Konling correction.
- Require official-vs-preview provenance in path outcomes.
- Provide tests for valid submission, invalid submission, repeated simulation failure, and insufficient evidence.

**Non-Goals:**

- Changing official Arena scoring rules.
- Copying raw high-frequency simulation traces into path records.
- Treating preview-only Arena evidence as official evaluation evidence.

## Decisions

### Decision 1: Terminal validation is evidence-gated

Path completion for control-correction must require evidence that satisfies the configured terminal policy. Resource views alone do not prove competency transfer.

### Decision 2: Preview and official evidence remain distinct

Preview-only simulation or Arena activity may support coaching context, but it must not be shown as official score, rank, or hard validation unless policy allows preview validation explicitly.

### Decision 3: Failure triggers fallback, not silent completion

Repeated simulation failure, invalid Arena submission, missing replay confidence, or weak evidence must trigger fallback or low-confidence states.

## Validation

- Tests SHALL cover successful terminal completion, repeated simulation failure, invalid Arena submission, preview-only evidence, and missing replay confidence.
- Konling correction tests SHALL verify cited failure analysis without hidden evaluator details.
- `rtk openspec validate close-control-correction-simulation-arena-validation --strict` SHALL pass.
