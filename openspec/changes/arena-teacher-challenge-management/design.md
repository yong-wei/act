## Context

Teacher publication config can publish Arena challenges and reports already aggregate participation, submissions, valid rate, scores, hard-constraint failures, weak metrics, method distribution, personal bests, and excellent solutions. The missing product layer is challenge selection and classroom review.

## Goals / Non-Goals

**Goals:**

- Help teachers select challenges by course stage and capability target.
- Show assignment progress and non-submitters in a class-aware way.
- Provide lecture-mode evidence: typical failure patterns, excellent summaries, and comparison candidates.

**Non-Goals:**

- Do not change official evaluation formulas.
- Do not implement student growth recommendations here.
- Do not expose private student solution payloads beyond allowed review policy.

## Decisions

- Reuse Arena training metadata from `arena-training-map`.
- Build report enhancements on `publication-report.ts` rather than duplicating aggregation in pages.
- Keep lecture-mode data anonymizable by default.

## Risks / Trade-offs

- Teacher reports can become overloaded. Prioritize teaching actions over raw metric volume.
- Class and visibility rules must remain correct for course/public publications.

## Migration Plan

1. Add challenge recommendation data for teacher config.
2. Extend publication report aggregation.
3. Update report page with lecture-mode sections.
4. Add class visibility and anonymization tests.
