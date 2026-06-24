## Overview

The graph-center foundation should start with a service/payload boundary. The UI can reuse existing graph rendering patterns where appropriate, but graph-center state should be driven by graph domain, objective filter, portrait dimension, and selected node rather than by page-local knowledge-only assumptions.

## Route Strategy

The safest first step is to add `/graph-center` as the new read-only center and keep `/knowledge` as a compatibility entry for `domain=knowledge`. `/knowledge` may link to the graph center but should not be removed until all existing visual and local-tool contracts are preserved.

## Payload

The service should expose:

- available graph domains;
- graph nodes and edges for selected domain;
- available objective filters;
- available portrait dimensions;
- selected node detail;
- limitations, including partial seed coverage or unavailable overlays.

## UI

The page uses AppShell. Desktop shows graph domain tabs, objective filters, a primary graph/list surface, and node detail. Mobile must provide a list/detail fallback because graph canvas interaction is not sufficient for accessibility.

## Boundaries

Read-only graph-center foundation does not compute learner mastery, class heat, or resource coverage. Those are later overlays.
