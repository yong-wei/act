## Why

`docs/proposals/2026-06-26-sag.md` identifies `/teacher/classes/[classId]/kaq-evidence-trace` as the teacher-facing complement to administrator SAR diagnostics. Current routes provide student evidence drilldown and teacher intervention remediation, but they do not let a teacher inspect a K/A/Q graph node and see the associated SAR evidence, learner/class evidence, resource gaps, candidate resources, and trace limitations in one governed surface.

## What Changes

- Add a teacher K/A/Q evidence trace surface for authorized classes.
- Let teachers inspect a selected K/A/Q node, associated SAR events, safe learner/class evidence, resource coverage gaps, candidate resources, and trace limitations.
- Enforce class scope and redaction so teacher-only data does not leak to students and cross-class evidence is not exposed.
- Connect the surface to existing Graph Center, teacher evidence, and resource governance destinations where available.

## Impact

- Adds a new `teacher-kaq-evidence-trace` capability.
- Consumes persisted SAR records and associated evidence.
- Does not replace existing student evidence pages, teacher intervention workflow, or administrator SAR diagnostics.
