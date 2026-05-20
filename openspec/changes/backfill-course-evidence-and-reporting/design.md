## Context

Some existing sessions have durable interaction logs and final student states but incomplete submit payloads. Backfill must improve diagnostic value without mutating raw source truth destructively or inventing answers.

## Goals / Non-Goals

**Goals:**

- Provide dry-run first evidence enrichment.
- Enrich recoverable submissions and facts with manifest-derived scoring context.
- Regenerate reports for chosen sessions after enrichment.
- Make unrecoverable legacy evidence explicit.

**Non-Goals:**

- Automatically mutate production without operator intent.
- Fabricate missing answers.
- Rewrite course content or page code.

## Decisions

### Decision: Treat raw tables as source evidence

The backfill should read `StudentState`, `StudentStepResponse`, `InteractionLog`, and manifests, then write derived enrichment or update derived facts/reports where safe. It should not destroy original logs.

### Decision: Dry-run is mandatory

The command should default to dry-run and print recoverable, already enriched, and unrecoverable counts. Apply mode should require an explicit flag.

### Decision: Enrichment must be idempotent

Every enriched record must be guarded by stable source identity and evidence version metadata so repeated runs do not duplicate facts or repeatedly rewrite reports without cause.

## Risks / Trade-offs

- [Risk] Final `StudentState` may not represent every attempt. Mitigation: label recovered evidence as final-state-enriched, not attempt-perfect.
- [Risk] Manifest reference answers may have changed. Mitigation: use runtime manifest version available for the lesson/session where possible and record the manifest source.
- [Risk] Backfill can be expensive. Mitigation: support session, lesson, and date filters.

## Migration Plan

1. Add dry-run coverage and candidate selection.
2. Add enrichment for recoverable final-state answers.
3. Add report regeneration by session and date range.
4. Add tests and operator documentation.
