## Why

SAR already provides Graph Center associated evidence and draft/suggested resource gap candidates. The remaining gap is governance: a suggested candidate should become an auditable review object that a teacher or administrator can accept, reject, defer, or invalidate. Without that workflow, SAR suggestions remain passive diagnostics and cannot safely improve ResourceNode or graph coverage.

## What Changes

- Add a governed review workflow for SAR suggested resource bindings.
- Preserve the rule that SAR never automatically mutates K/A/Q graph bindings or ResourceNode governance state.
- Let authorized reviewers accept, reject, defer, annotate, and audit suggested bindings.
- Connect accepted suggestions to ResourceNode governance updates only after review.

## Impact

- Extends `structured-associative-retrieval`.
- Extends `teacher-resource-node-management`.
- May affect Graph Center candidate actions and resource governance APIs.
- Does not implement SAR projection refresh or teacher evidence trace UI.
