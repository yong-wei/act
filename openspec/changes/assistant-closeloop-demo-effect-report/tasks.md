## 1. Demo Fixture Package

- [ ] 1.1 Extend the intelligent teaching assistant demo package with upgraded diagnosis, grading, path, Konling, prep-pack overlay, and effect-report fixtures.
- [ ] 1.2 Ensure seed/reset is deterministic and idempotent.
- [ ] 1.3 Keep synthetic fixture data clearly separated from real user evidence.

## 2. Closed-loop Acceptance

- [ ] 2.1 Add acceptance checks for document submission, conversion, draft grading, teacher approval, and writeback preview.
- [ ] 2.2 Add acceptance checks for diagnosis refresh, three-style path selection, and path execution evidence.
- [ ] 2.3 Add acceptance checks for Konling cited explanations and prep-pack overlay activation.
- [ ] 2.4 Add privacy checks for raw answer bodies, private Konling memory, hidden Arena internals, raw traces, and secrets.

## 3. Effect Report

- [ ] 3.1 Define effect metrics for grading time saved, teacher edit rate, path adoption, Arena/simulation second-attempt improvement, and user feedback.
- [ ] 3.2 Add report builder/export payload with metric definitions, source windows, numerator/denominator, exclusions, and caveats.
- [ ] 3.3 Add runbook for local demo rehearsal and evidence collection.

## 4. Verification

- [ ] 4.1 Add deterministic seed/reset tests.
- [ ] 4.2 Add closed-loop demo acceptance tests.
- [ ] 4.3 Add effect-report metric validation tests.
- [ ] 4.4 Run `rtk openspec validate assistant-closeloop-demo-effect-report --strict`.
