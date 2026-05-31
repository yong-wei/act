## Context

The audit includes findings that do not need a framework or SDK redesign. Applying these first reduces noise and may remove transitive findings shared with later migrations.

## Update Strategy

- Prefer patch or minor versions that remain within the current major line.
- Use the package manager to update direct dependencies and refresh the lockfile.
- Do not run `npm audit fix --force`.
- If a package requires a semver-major change to clear the finding, leave it for its dedicated major-migration issue.

## Validation Scope

Run dependency and test checks that can catch tooling and runtime regressions:

- `rtk npm audit --json` to compare remaining findings.
- `rtk npm run lint` if the lint script remains available.
- `rtk npm run test:unit` for dependency-sensitive unit tests.
- Target worker checks if `bullmq` changes affect queue imports.

## Risks

- Lockfile-only updates can mask the actual source package. The change should explain whether the vulnerable node was direct or transitive.
- `eslint-config-next` is currently not aligned with the installed Next package; updates here must not start the Next major migration.

## Verification

- Confirm no source code changes are needed beyond minimal compatibility fixes.
- Validate with `rtk openspec validate upgrade-low-risk-vulnerable-dependencies --strict`.
