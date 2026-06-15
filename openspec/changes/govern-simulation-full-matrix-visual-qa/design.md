## Context

The existing governance spec already mentions simulation matrices and handoff alignment, but the latest audit shows that sampling and marker checks were not sufficient. A route-specific failure in cruise and global theme drift survived the earlier series. The acceptance model must now treat each active simulation as a required design surface.

## Goals / Non-Goals

**Goals:**

- Make all seven simulation detail routes mandatory in final visual QA.
- Require design-handoff and audit evidence references in every simulation UI acceptance package.
- Require independent browser-capable design review with pass/fail findings.
- Make screenshot manifests include layout, theme, runtime-noise, and content checks.

**Non-Goals:**

- No new visual design direction beyond the accepted handoff and user-requested corrections.
- No implementation of theme/layout/noise fixes; those are handled by prerequisite changes.
- No GitHub Actions integration while CI quota remains constrained.

## Decisions

- Use full active-route coverage. Representative route sampling missed cruise-specific geometry drift, so all active routes become mandatory.
- Use evidence comparison, not only capture presence. The reviewer must compare implementation screenshots to `design-handoff.md`, concept images, and 2026-06-15 audit contact sheets.
- Make this change depend on the theme, command-deck layout, and runtime-noise changes. Final governance should validate the repaired baseline, not the current broken baseline.
- Keep subagent review as a hard acceptance gate when implementation evidence is ready, matching the existing governance requirement for independent simulation handoff verification.

## Risks / Trade-offs

- [Risk] Full matrix capture increases local QA time. Mitigation: keep it local-only and scoped to simulation UI changes.
- [Risk] Visual comparison can become subjective. Mitigation: require explicit checklist fields for route, theme, viewport, handoff section, concept image, audit regression, and pass/fail finding.
- [Risk] Future simulations may be added without matrix updates. Mitigation: derive active routes from simulation catalog or route registry where possible.
