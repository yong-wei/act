## Design

This change productizes the existing SAR diagnostics report instead of rebuilding SAR. The implementation should consume the already-returned `sarDiagnostics` report from `/api/admin/data-governance/status` and present it through the admin data-governance surface.

## Surface Contract

The admin view should expose a SAR diagnostics panel or dedicated admin route reachable from `/admin/data-governance`. The visible surface must include:

- Event, entity, and relation counts.
- Source owner/type, authority, and privacy-scope breakdowns.
- Query trace summary count, average hop count, rejected/privacy ref counts, and limitation counts.
- Source Pack handoff count and verified citation rate.
- SAR candidate adoption/rejection comparison where available.
- Control-correction demo fixture status and query label.
- A clear empty/degraded state when `sarDiagnostics` is absent.

The panel should follow existing admin console density and status semantics. It should not introduce a separate visual language.

## Privacy And Safety

The UI may render IDs that are already redacted or diagnostic-safe. It must not render:

- Raw learner answers.
- Hidden Arena evaluation internals.
- Raw private Konling memory.
- Full audit-only trace payloads.
- Unverified SAR candidates as verified citations.

Tests should explicitly scan rendered output or serialized payloads for known forbidden fixture strings.

## Spec Hygiene

The implementation should replace the archived SAR spec placeholder Purpose with a concise statement that SAR is ACT's governed structured associative retrieval layer over stable platform references, not the final citation verifier and not the path-planning authority.

## Verification Strategy

Use a narrow verification set:

- OpenSpec strict validation for this change and affected specs.
- Admin data-governance status route tests for SAR payload safety.
- Admin data-governance overview/unit tests or route rendering tests for visible SAR diagnostics.
- A text/DOM assertion that raw private fixture strings are absent.

Browser screenshots are useful if the implementation creates or materially changes a visible route, but they are not required for this proposal-only change.
