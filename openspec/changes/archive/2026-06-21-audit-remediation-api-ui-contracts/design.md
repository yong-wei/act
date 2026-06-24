## Context

The audit shows a recurrent failure pattern: query parameters look supported but are ignored or interpreted differently across UI and API. Fixing this requires a common handling rule, not isolated empty states.

## Goals / Non-Goals

**Goals:**
- Align visible search/filter/pagination/deep-link state with API behavior.
- Productize missing object and unsupported method errors.
- Preserve user context through `returnTo` and source parameters.

**Non-Goals:**
- Do not redesign all list pages in this change; mobile layout is handled separately.
- Do not create new domain objects beyond what each vertical remediation requires.

## Decisions

- Query parameters must be classified as supported, unsupported, ignored-by-design, or invalid; ignored parameters must not silently affect user expectations.
- UI state must display the active filter/search object and result count from the same source as the API response.
- Bad IDs and missing objects must keep the user in the current role/workflow with clear recovery actions.

## Risks / Trade-offs

- Existing pages may rely on permissive ignored params. Mitigation: introduce compatibility redirects only when they preserve visible state and recovery.
- Tight API/UI consistency can expose missing backend filters. Mitigation: vertical changes may add minimal filter support before claiming the finding fixed.
