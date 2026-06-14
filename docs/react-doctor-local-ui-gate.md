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

Warning-mode reports include an `advisoryBaseline` object. It classifies each
owned warning into one of four planning buckets:

- `product-risk`: accessibility, App Router, or state/effect warnings that can
  affect product behavior.
- `mechanical-cleanup`: unused files, unused exports, metadata, and component
  hygiene work that should be handled with graph-backed cleanup.
- `tool-noise`: scanner limitations that need evidence before suppression or
  rewrite, currently including R3F/Three `no-unknown-property` diagnostics.
- `deferred`: advisory warnings that are real but not yet promoted to a child
  remediation scope.

The report also preserves machine-readable counts by rule, owned surface, and
file. Downstream remediation changes should use those deltas as local evidence;
they must not turn the warning channel into a CI blocker unless a later
OpenSpec change explicitly promotes a rule family.

Current local baseline on 2026-06-14:

- error-only UI diagnostics: 0.
- owned error diagnostics: 0.
- owned Security diagnostics: 0 selected diagnostics.
- owned warning-summary diagnostics: 3,418 advisory warnings.
- advisory buckets: `product-risk` 1,060, `mechanical-cleanup` 681,
  `tool-noise` 186, `deferred` 1,491.
- `evaluate/` is declared as a React Doctor ignored root; the current React
  Doctor run did not emit diagnostics from that root.

For unified UI governance, use this output as a local review artifact for the
affected migrated routes or representative route set. The blocker channels are
clean; the warning channel is advisory planning evidence for the active React
Doctor cleanup series under `openspec/changes/`. Do not connect this gate to CI
or treat unrelated advisory warning findings as a commercial UI governance
failure.

Business identity must not be encoded through JSX `role` attributes. Student
or teacher surface identity should use explicit domain props such as
`viewerRole` or non-ARIA metadata such as `data-role`; `role="student"` and
`role="teacher"` are invalid ARIA roles and are rejected by local UI contract
tests.
