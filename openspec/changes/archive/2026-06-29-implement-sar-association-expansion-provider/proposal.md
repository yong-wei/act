## Why

SAR should provide structured multi-hop association, not another hybrid retrieval stack. Source Pack owns profile-aware retrieval, ranking, diversification, and citation hydration. SAR should resolve seed refs, expand through event/entity relations, and return candidates plus trace that Source Pack, Konling, Graph Center, and path planning can consume.

## What Changes

- Add a deterministic association expansion provider over projected SAR events/entities.
- Support 0-hop, 1-hop, and 2-hop expansion from query seeds.
- Enforce role, student, class, privacy, and authority filters before returning candidates.
- Return trace, selected refs, rejected refs, limitations, and optional Source Pack seed refs.

## Impact

- Extends `structured-associative-retrieval`.
- Proposed modules: `src/lib/data-governance/sar-association-expansion.ts`, `sar-trace.ts`, and service tests.
- Depends on SAR contract and projection changes.
