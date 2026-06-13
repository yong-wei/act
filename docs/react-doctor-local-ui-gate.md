# React Doctor Local UI Gate

React Doctor remains a local error-level validation gate for migrated UI
surfaces. It is intentionally not wired into GitHub Actions while CI quota is
constrained.

Run the pinned local scan with:

```bash
rtk npm run test:react-doctor:ui-errors
```

The script executes from the repository root and loads `doctor.config.json` so
fixture and generated roots are excluded before React Doctor scans files:

```bash
npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .
```

Owned-surface gates use the same pinned React Doctor version, but route output
through a local wrapper that records included roots, excluded fixture roots, the
command, version, and grouped diagnostic totals:

```bash
rtk npm run test:react-doctor:owned-errors
rtk npm run test:react-doctor:owned-security
rtk npm run react-doctor:owned-warnings
```

`test:react-doctor:owned-errors` fails when owned product surfaces contain
error diagnostics. `test:react-doctor:owned-security` fails when owned product
surfaces contain Security category diagnostics. `react-doctor:owned-warnings`
groups all owned warnings by severity, category, rule, and owned surface without
failing release checks by default; Security warnings may appear in this summary,
but their blocker status is decided by the dedicated security channel.

The owned-surface boundary includes `src/`, `scripts/`, `docs/`, `openspec/`,
and root project configuration files. `doctor.config.json` excludes
`evaluate/`, generated build outputs, vendored public assets, coverage, and
artifact folders before scanning, and the owned wrapper keeps the same roots as
a report-level guard so embedded sample repositories or evidence fixtures do
not decide product release status.

For machine-readable evidence files, run the scripts through npm's silent mode:

```bash
rtk npm run --silent test:react-doctor:owned-errors > artifacts/react-doctor/owned-errors.json
rtk npm run --silent test:react-doctor:owned-security > artifacts/react-doctor/owned-security.json
rtk npm run --silent react-doctor:owned-warnings > artifacts/react-doctor/owned-warnings.json
```

Current local baseline on 2026-06-13:

- owned error diagnostics: 62, all `Bugs` category.
- owned Security diagnostics: 4 warnings.
- owned warning-summary diagnostics: 3,497 warnings, including the 4 Security
  diagnostics governed by the security blocker channel.
- `evaluate/` is declared as a React Doctor ignored root; the current React
  Doctor run did not emit diagnostics from that root.

For unified UI governance, use this output as a local review artifact for the
affected migrated routes or representative route set. Existing error classes
are owned by the active React Doctor cleanup changes under `openspec/changes/`;
do not connect this gate to CI or treat unrelated active cleanup findings as a
commercial UI governance failure.

Business identity must not be encoded through JSX `role` attributes. Student
or teacher surface identity should use explicit domain props such as
`viewerRole` or non-ARIA metadata such as `data-role`; `role="student"` and
`role="teacher"` are invalid ARIA roles and are rejected by local UI contract
tests.
