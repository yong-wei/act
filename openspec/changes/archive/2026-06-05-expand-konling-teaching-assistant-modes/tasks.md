## 1. Mode Registry

- [x] 1.1 Define Konling teaching-assistant mode ids, labels, supported roles, mounting surfaces, required context, optional context, and unavailable states.
- [x] 1.2 Declare permitted tools, citation classes, privacy policies, and output contracts per mode.
- [x] 1.3 Preserve existing chat behavior when no mode is requested.

## 2. Surface Integration

- [x] 2.1 Integrate diagnosis explainer and path advisor with student learning overview/path center.
- [x] 2.2 Integrate resource coach with ResourceNode launches and path execution context.
- [x] 2.3 Integrate grading assistant and student feedback explainer with the document grading workbench when present.
- [x] 2.4 Integrate class summarizer and prep coauthor with teacher report and prep-pack pages when present.

## 3. Verification

- [x] 3.1 Add runtime tests for context scope, citation requirements, and unavailable dependencies.
- [x] 3.2 Add tests that client hints cannot expand user, class, resource, path, grading, or prep-pack scope.
- [x] 3.3 Add UI or contract tests for representative mode mounts.
- [x] 3.4 Run `rtk openspec validate expand-konling-teaching-assistant-modes --strict`.
