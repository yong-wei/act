## Why

The current `/knowledge` route is a knowledge graph workspace. It already uses AppShell and has strong visual and ResourceNode-aware contracts, but it is not yet a graph center that can switch among knowledge, capability, and quality domains or filter by K/A/Q objectives.

The first product step should be a read-only graph-center foundation backed by structured payloads, not a large rewrite of `KnowledgeGraphSystem`.

## What Changes

- Add a graph-center read-only payload/service boundary for K/A/Q graph domains.
- Introduce a graph-center route or compatibility path while keeping `/knowledge` usable as the knowledge-domain entry.
- Support graph domain switching, objective filtering, portrait-dimension filtering, and node detail inspection.
- Preserve existing `/knowledge` AppShell and local-tool contracts.

## Capabilities

### New Capabilities
- `graph-center-ui`: read-only graph-center route, payload, and UI contract.

### Modified Capabilities
- None in this proposal. Existing knowledge workspace specs remain authoritative for `/knowledge` compatibility.

## Dependencies

- Depends on `introduce-kaq-graph-schema`.
- Depends on `seed-autocontrol-kaq-graph-catalog`.

## Impact

- Adds product entry for K/A/Q graph exploration.
- Does not implement learner or class overlays.
- Does not bypass ResourceNode launch or source-of-record boundaries.
