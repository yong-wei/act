## 1. Active Authority contract

- [x] 1.1 Map the `engineering-graph` READY/use-combination Authority resolver to a browser-safe active graph response; require matching Authority identity and null engineering projection without gating on Teaching Projection.
- [x] 1.2 Add active graph canvas and node-detail API routes that resolve only the committed `engineering-graph` selection and fail closed on absent/non-READY selection, global-pointer fallthrough or mismatched identities.
- [x] 1.3 Add unit and route tests for `engineering-graph` identity correlation, null-projection availability, role projection, query-parameter non-selection, unavailable states and no Legacy fallback.

## 2. Knowledge workspace modes

- [x] 2.1 Replace the ordinary fixed-candidate default with active Authority, historical Legacy and administrator-only candidate diagnostic modes.
- [x] 2.2 Render durable mode and provenance labels, reset incompatible local selection on a mode change, and preserve the independent Legacy component path.
- [x] 2.3 Add client-boundary and component tests that forbid server-only activation imports and verify no selector or learning-state write occurs from mode switching.

## 3. Cutover-aware application refresh

- [ ] 3.1 Implement a dedicated local-to-remote application refresh command that validates final image provenance plus the remote immutable marker/receipt/journal/selector cutover baseline before remote mutation.
- [ ] 3.2 Under the shared deployment lock, atomically normalize the durable runtime env to one `ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover` value while retaining other content, ownership and permissions; a clean shell and systemd-equivalent `--app-only` start must read that persisted mode without an ambient override.
- [ ] 3.3 Make the refresh transaction preserve all Authority/Projection/prerequisite/consumer selectors and production cutover marker/receipt/journal, replace app and worker with one declared image digest in cutover mode, and write one non-overwritable `app-refresh/<refreshId>.json` receipt with only safe hashes/status.
- [ ] 3.4 Implement identity-constrained post-replacement recovery to the recorded preceding image digest for both app and worker while retaining persistent cutover mode and leaving selector or production cutover control state untouched.
- [ ] 3.5 Add static and behavior tests proving the refresh rejects missing/drifted cutover evidence, never invokes the Legacy deploy path, never mutates selectors/marker/receipt/journal, retains the Legacy guard, rejects mixed app/worker identities, covers env missing/legacy/cutover/duplicate normalization, clean systemd-equivalent starts, protected-digest drift, receipt redaction and recovery after app/worker/postflight failure.

## 4. Local acceptance

- [ ] 4.1 Run focused unit, API and deployment tests; then run typecheck, lint and the affected domain suite with the 12 GiB Node heap.
- [ ] 4.2 Capture the required `/knowledge` product QA states from the final source revision and obtain independent visual review evidence.
- [ ] 4.3 Run the final full test suite and strict OpenSpec validation; resolve accepted findings and record non-blocking residual test scope.

## 5. Release and production verification

- [ ] 5.1 Commit the completed change, integrate the frozen revision into `integration` and then `main`, and record the release revision/image identity.
- [ ] 5.2 Build the fixed production image locally with Docker Desktop configured to 24 GiB memory and 8 GiB swap, `NODE_MAX_OLD_SPACE_SIZE=12288`, tar export and provenance verification.
- [ ] 5.3 Revalidate the remote committed cutover receipt, marker, journal, four selectors, `engineering-graph` READY/null-projection combination, six READY consumers, OCI identity and capacity before refresh.
- [ ] 5.4 Deploy through the cutover-aware refresh transaction and verify app/worker mode and image identity, local/public readiness, active Authority API identity and authenticated active/Legacy workspace switching.
- [ ] 5.5 Confirm no parallel local build remains and close Docker Desktop after final deployment verification.
