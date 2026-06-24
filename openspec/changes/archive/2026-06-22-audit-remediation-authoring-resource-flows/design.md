## Context

Authoring/resource issues are not P0 except prep-pack route failure, but they form a broad workflow debt: actions lose intent, long lists replace task pages, and quality reports are not reachable from governance contexts.

## Goals / Non-Goals

**Goals:**
- Preserve create/edit/clone/play/start intent across authoring and resource routes.
- Provide search, pagination, no-match, and preview/action states for large lists.
- Connect authoring governance to quality reports and repair actions.

**Non-Goals:**
- Do not rebuild the entire course authoring model.
- Do not fix P0 prep-pack 500 here; it is handled by `audit-remediation-p0-stability`.

## Decisions

- Authoring links must carry explicit intent and target identity rather than relying on generic list pages.
- Large knowledge/resource lists must offer search, filtering, pagination, and selected-state summaries.
- Quality report links must retain lesson/resource context and failure recovery.

## Risks / Trade-offs

- Many routes may share legacy list components. Mitigation: introduce wrappers or adapters before deeper refactors.
- Course-flow selection across 820 knowledge nodes can be expensive. Mitigation: virtualized or paged selection with stable selected summary.
