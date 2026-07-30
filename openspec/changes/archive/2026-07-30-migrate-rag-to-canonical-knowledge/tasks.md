## 1. Add Canonical retrieval signals

- [x] 1.1 Implement Canonical entity alignment using IDs, names, aliases, the current aggregate ReleaseSet, and version-matched CourseCoverage.
- [x] 1.2 Add bounded expansion for explicitly supported engineering predicates.
- [x] 1.3 Resolve upstream RAG-reference seeds only through the governed ACT EvidenceStructuralUnitCrosswalk to structural units, RetrievalChunks, and CitationTargets.
  - Evidence: `VersionBoundCrosswalk` + complete `CandidateContextFingerprint` including runtime `projectionId`/`projectionProfile`/`projectionDigest`; structural targets from `deriveStructuralTargetFromObservations(unit, SourcePackItem, inventory, context)`; full-fingerprint membership; upstream context mandatory.
- [x] 1.4 Preserve existing lexical, vector, reranking, and evidence-adjudication stages.
  - Evidence: graph stage emits seeds only; harness re-runs `retrieveSourcePack` for shadow adjudication.

## 2. Enforce citation ownership

- [x] 2.1 Require final citations to resolve to accessible ACT structural text units or anchors.
- [x] 2.2 Reject graph summaries, relations, and unresolved upstream RAG references as final answer evidence.
- [x] 2.3 Add diagnostics for missing or drifted Crosswalks without Legacy fallback.
- [x] 2.4 Emit standard numbered citations targeting the most specific available textbook structure.
  - Evidence: numbered citations only after Source Pack adjudication.

## 3. Validate retrieval quality

- [x] 3.1 Offline sample with complete fingerprints (incl. projectionId/profile).
- [x] 3.2 Shadow comparison via harness + optional Konling `search_textbook` sidecar; production Legacy unchanged.
  - Konling runtime compares **actual TextbookV2 production foreground** identities with Canonical graph-seed + Source Pack adjudication on an independent `shadowCandidatePool` (not used as production).
  - Regression: `buildKonlingToolRuntime({ canonicalRagShadow })` asserts production deep-equal apart from diagnostic; production IDs from foreground; shadow IDs from adjudication; broken version context omits diagnostic.
- [x] 3.3 CUTOVER_ACTIVATION always fails closed in #1112; no local activation path.
- [x] 3.4 Final verification run (this checkpoint only):

```text
# direct runtime regression
rtk npx vitest run src/lib/__tests__/konling-agent-runtime.test.ts -t "compares actual production TextbookV2 foreground"
→ Test Files 1 passed | Tests 1 passed | 189 skipped (190)

# focused canonical-rag
rtk npm run test:unit -- src/lib/__tests__/canonical-rag.test.ts
→ Test Files 1 passed | Tests 9 passed (9)

# directly affected Source Pack / Konling (explicit path list)
rtk npm run test:unit -- \
  src/lib/__tests__/canonical-rag.test.ts \
  src/lib/__tests__/source-pack-hybrid-retriever.test.ts \
  src/lib/__tests__/source-pack-corpus-adapters.test.ts \
  src/lib/__tests__/textbook-v2-adapter.test.ts \
  src/lib/__tests__/source-pack.test.ts \
  src/lib/__tests__/konling-agent-runtime.test.ts
→ Test Files 6 passed | Tests 354 passed (354)

NODE_OPTIONS='--max-old-space-size=8192' rtk npm run typecheck
→ pass (exit 0)

NODE_OPTIONS='--max-old-space-size=8192' NODE_MAX_OLD_SPACE_SIZE=8192 rtk npm run build
→ pass (exit 0)

rtk openspec validate migrate-rag-to-canonical-knowledge --type change --strict
→ Change 'migrate-rag-to-canonical-knowledge' is valid
```

Notes:
- Live DB VALIDATED Crosswalks remain out of scope; E2E uses production-shaped non-live fixture.
- Counterexamples cover mutating only projectionId/projectionProfile and full resolver-path endpoint mutations (unit identity, SourcePack chunk/cite/href/hash, inventory resource/segment/hash/run/capture).
- Offline harness (`runLegacyProductionWithCanonicalShadow`) remains for unit/fixture tests only; live Konling path uses `runKonlingCanonicalRagShadowDiagnostic` with real production foreground.
