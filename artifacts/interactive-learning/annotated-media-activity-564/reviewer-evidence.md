# Annotated Media Activity Reviewer Evidence

- Shared runtime registers `visual.annotatedMedia` and `visual.embedded-activity` as canonical manifest module classes.
- Registry gate rejects missing media metadata, invalid annotation regions, unrecorded required hotspots, broken activity anchors, and visible engineering-name leaks.
- Evidence contract records selected hotspots, omitted required annotations, evidence roles, reveal state, embedded activity answers, feedback fields, and teacher-only diagnostics policy.
- `/api/interactive/events` materializes annotated media drafts into `StudentStepResponse.responseData.annotatedMediaEvidence` and exposes teacher/admin-only `diagnostics=annotated-media`.
- Browser acceptance covers student, teacher, and guest roles across light, dark, mobile, desktop, and projection states.
