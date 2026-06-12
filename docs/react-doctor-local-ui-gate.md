# React Doctor Local UI Gate

React Doctor remains a local error-level validation gate for migrated UI
surfaces. It is intentionally not wired into GitHub Actions while CI quota is
constrained.

Run the pinned local scan with:

```bash
rtk npm run test:react-doctor:ui-errors
```

The script executes:

```bash
npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .
```

For unified UI governance, use this output as a local review artifact for the
affected migrated routes or representative route set. Existing error classes
are owned by the active React Doctor cleanup changes under `openspec/changes/`;
do not connect this gate to CI or treat unrelated active cleanup findings as a
commercial UI governance failure.
