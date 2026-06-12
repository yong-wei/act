## 1. Demo Fixture Package

- [x] 1.1 Extend the intelligent teaching assistant demo package with upgraded diagnosis, grading, path, Konling, prep-pack overlay, and effect-report fixtures.
- [x] 1.2 Ensure seed/reset is deterministic and idempotent.
- [x] 1.3 Keep synthetic fixture data clearly separated from real user evidence.

## 2. Closed-loop Acceptance

- [x] 2.1 Add acceptance checks for document submission, conversion, draft grading, teacher approval, and writeback preview.
- [x] 2.2 Add acceptance checks for diagnosis refresh, three-style path selection, and path execution evidence.
- [x] 2.3 Add acceptance checks for Konling cited explanations and prep-pack overlay activation.
- [x] 2.4 Add privacy checks for raw answer bodies, private Konling memory, hidden Arena internals, raw traces, and secrets.

## 3. Effect Report

- [x] 3.1 Define effect metrics for grading time saved, teacher edit rate, path adoption, Arena/simulation second-attempt improvement, and user feedback.
- [x] 3.2 Add report builder/export payload with metric definitions, source windows, numerator/denominator, exclusions, and caveats.
- [x] 3.3 Add runbook for local demo rehearsal and evidence collection.

## 4. Verification

- [x] 4.1 Add deterministic seed/reset tests.
- [x] 4.2 Add closed-loop demo acceptance tests.
- [x] 4.3 Add effect-report metric validation tests.
- [x] 4.4 Run `rtk openspec validate assistant-closeloop-demo-effect-report --strict`.
