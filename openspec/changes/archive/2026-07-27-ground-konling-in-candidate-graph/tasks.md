## 1. Inject candidate page context

- [x] 1.1 Add ReleaseSet, selected Canonical Object, graph filter, and coverage fields to the existing page-context contract.
- [x] 1.2 Preserve conversation history and append changed page context before the next user message.

## 2. Add focused Canonical tools

- [x] 2.1 Implement Repository-backed Canonical search, role-safe node detail, and bounded neighbor tools.
- [x] 2.2 Register these tools only for candidate graph context and preserve predicate, direction, governance, and Release provenance.
- [x] 2.3 Enforce server-side rejection of candidate-driven fact, portrait, recommendation, and path mutations.
- [x] 2.4 Keep existing answer citation and diagnostic contracts, including explicit candidate provenance.

## 3. Verify read-only behavior

- [x] 3.1 Add tool tests proving names are not used to infer Legacy mappings.
- [x] 3.2 Add integration tests proving candidate questions cannot reach any governed learning-state writer.
- [x] 3.3 Run browser acceptance for selected-object explanation, candidate search, cross-page continuation, and visible diagnostics.
- [x] 3.4 Verify V2 graph and candidate-Konling acceptance against the same ReleaseSet, then open the public activation gate and set candidate mode as the migration-period default.
- [x] 3.5 Add a failure-path test proving any unmet acceptance condition leaves ordinary users on the Legacy graph.
- [x] 3.6 Run targeted AI runtime tests, typecheck, and strict OpenSpec validation.
