# Five-class migration handoff

This inventory is the input to the four downstream changes. It does not migrate
implementations in this change.

| Class | Owner | Current roots | Replacement | Follow-up change | Deletion condition |
| --- | --- | --- | --- | --- | --- |
| content-export-review | course | `course-content/scripts` | `tools/` content compiler entry | `isolate-content-knowledge-runtime-release-toolchains` | all callers use qualified tool entry and old path is absent |
| knowledge-release | knowledge | `scripts/knowledge-cutover`, `scripts/knowledge`, `src/lib/teaching-projection/{publish,qualify,rebase}` | `tools/` knowledge release + Teaching Projection CLI | `extract-teaching-projection-publishing-cli`, `isolate-content-knowledge-runtime-release-toolchains` | old publish/qualify/rebase and script callers deleted |
| runtime-oss-release | platform | `scripts/runtime-release`, `scripts/release` | `tools/` runtime release entry | `isolate-content-knowledge-runtime-release-toolchains` | product reads qualified runtime manifests only |
| evidence-visual-qa | assessment | `scripts/tests`, `artifacts` | external CI/object-store evidence with repo manifests | `externalize-run-specific-qa-evidence-artifacts` | product tests do not import run-specific bytes |
| migration-backfill | learning-record | `scripts/migrations`, `scripts/db` | apply-gated tool commands | `isolate-migration-backfill-competition-toolchains` | unauthorized apply fail-closed; product graph has no script imports |
| competition-material | arena | `evaluate` | dry-run-default tool commands | `isolate-migration-backfill-competition-toolchains` | helpers isolated or archived with caller evidence |

`tools/glb-model-optimizer` and `tools/skillopt-sleep` remain existing tools owned outside this series.

This change fail-closes new production TypeScript module imports of tool implementations. Pre-existing production path strings and subprocess invocations are recorded as caller inventory and are not migrated here.

| Product caller | Tool path | Edge class | Follow-up change |
| --- | --- | --- | --- |
| `src/lib/runtime-external-input-bundle.ts` | `scripts/release/textbook-runtime-v2-provenance.mjs`, `course-content/scripts/textbook_hybrid_retrieval.py`, `course-content/scripts/validate_structured_textbook_runtime_v2.mjs`, `course-content/scripts/validate_written_textbook_runtime_v2.py` | dynamic import / exec | `isolate-content-knowledge-runtime-release-toolchains` |
| `src/lib/canonical-learning-fact-identity/inventory.ts` | `scripts/db/backfill-learning-facts-from-event-batches.ts`, `scripts/db/backfill-learning-facts-from-interaction-logs.ts`, `scripts/db/backfill-unit-4-1-growth-governance.ts`, `scripts/migrations/002-migrate-to-learning-facts.ts` | path inventory | `isolate-migration-backfill-competition-toolchains` |
| `src/lib/canonical-resource-binding/capture-revision.ts` | `scripts/db/import-canonical-resource-binding-shadow.ts` | path inventory | `isolate-migration-backfill-competition-toolchains` |
| `src/lib/commercial-ui-capture-revision.ts` | `scripts/tests/capture-adaptive-path-product-qa.ts` | path inventory | `externalize-run-specific-qa-evidence-artifacts` |
| `src/lib/commercial-ui-governance.ts` | `scripts/tests/capture-simulation-command-deck-qa.ts` and `artifacts/commercial-ui/**` | path inventory | `externalize-run-specific-qa-evidence-artifacts` |
| `src/lib/architecture-test-commands/conventions.ts` | `scripts/tests/**` | command convention inventory | `externalize-run-specific-qa-evidence-artifacts` |
| `src/lib/teaching-projection/{publish,qualify,rebase}` | remains in product `src/lib` | implementation still in product graph | `extract-teaching-projection-publishing-cli` |

Non-overlap: this boundary does not change `coordinate-latest-authority-and-active-oss-cutover` selectors or `stabilize-commercial-ui-qa-capture-contract` capture gates.

Rollback for this boundary change is to remove `tools/boundary` registry/entry only. Production selectors are unchanged.
