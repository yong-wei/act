## Context

Commercial teaching platforms need reports that look trustworthy outside the browser. Report surfaces cannot simply reuse app cards; they need readable print/export layout, low-contrast brand watermark, privacy scope, and source provenance.

## Goals / Non-Goals

**Goals:**

- Define report-ledger layout and visual semantics.
- Preserve privacy and evidence provenance in screenshots/exports.
- Ensure brand watermark does not obscure content.

**Non-Goals:**

- Do not redesign teacher/admin operational consoles.
- Do not change data calculations or report metrics.

## Decisions

### Decision 1: Reports are ledgers, not dashboards

Reports should emphasize traceability, source, status, and conclusion. They can use platform brand language, but not the same dense interactive controls as app pages.

### Decision 2: Export readability is an acceptance criterion

Watermarks, visual textures, and theme treatment must be validated against charts, formulas, names, tables, and privacy labels.

## Risks / Trade-offs

- Some reports may not yet exist. -> Define archetype and apply to available report/snapshot surfaces first.
- Print/export capture can be hard to automate. -> Use screenshot evidence initially and add print/export checks where available.
