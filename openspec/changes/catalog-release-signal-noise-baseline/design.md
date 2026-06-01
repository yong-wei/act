## Context

The current migration branch has useful but noisy readiness signals. Treating them as one defect would couple unrelated work; ignoring them would make dependency upgrades unverifiable.

## Classification Model

The baseline should classify findings into these lanes:

- `stale-log-residue`: historical errors in `.logs/` that no longer reproduce.
- `command-scope-defect`: verification commands scanning the wrong files or resolving imports from the wrong base path.
- `existing-contract-drift`: tests or fixtures behind current runtime contracts.
- `real-blocking-debt`: a failing gate that represents actual product or governance debt.
- `owned-residual-risk`: true audit/deprecation findings that are deferred to a named migration issue.
- `environment-drift`: local, CI, or server version ambiguity that makes results non-reproducible.

## Evidence To Capture

- Branch and commit.
- Commands run and exact failing summaries.
- Affected files or scripts.
- Whether the signal should be eliminated, allowed temporarily, or preserved as a real blocker.
- The follow-up change responsible for removing or owning the signal.

## Boundaries

This change is documentation and coordination only. It must not modify source, tests, scripts, package manifests, lockfiles, or logs.

## Verification

- `rtk openspec validate catalog-release-signal-noise-baseline --strict`
- Confirm `git diff --name-only` for this change contains only the OpenSpec artifacts for this baseline.
