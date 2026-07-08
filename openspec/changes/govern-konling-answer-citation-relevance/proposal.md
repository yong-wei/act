## Why

Konling answers from the knowledge graph workspace can currently promote unrelated textbook chunks such as `ch01-advanced-problems-031__chunk-001` as high-confidence content citations for arbitrary questions. The immediate problem is not citation rendering, but retrieval governance: the `konling-answer` Source Pack profile can select canonical, high-authority textbook chunks without requiring enough query, selected-node, objective, or SAR relevance.

## What Changes

- Add answer-citation relevance gates to the `konling-answer` Source Pack profile so high-authority textbook chunks cannot be selected unless they are relevant to the current question or server-owned graph context.
- Require Konling to downgrade or omit content citations when no selected Source Pack item meets the answer relevance contract, rather than presenting low-related chunks as `high` confidence citations.
- Add auditable limitation codes for omitted or downgraded answer citations, including insufficient query relevance and missing selected-node coverage.
- Add regression coverage for the knowledge graph citation leakage case, including explicit guards against defaulting to `ch01-advanced-problems-031__chunk-001` and adjacent `ADVANCED PROBLEMS` chunks when the user query is unrelated.
- Keep large-scale textbook search-document review, semantic field completion, and resource-shard cleanup outside this change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `source-pack-retrieval`: `konling-answer` retrieval must enforce answer-specific relevance thresholds and report limitations when selected evidence does not cover the current question or graph context.
- `konling-agent-runtime`: Konling must not present low-related Source Pack items as high-confidence answer citations; it must surface missing or downgraded citation context in runtime metadata.

## Impact

- Affects `src/lib/source-pack/*` ranking/profile contracts, `src/lib/konling-agent-runtime.ts` citation context construction, and related unit tests.
- Affects `/knowledge` Konling answer grounding because that surface supplies selected-node and current-query context to the runtime.
- Does not introduce new external services, database migrations, or large resource backfills.
