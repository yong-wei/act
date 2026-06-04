## 1. Mode Registry

- [ ] 1.1 Define Konling teaching-assistant mode ids, labels, supported roles, mounting surfaces, required context, optional context, and unavailable states.
- [ ] 1.2 Declare permitted tools, citation classes, privacy policies, and output contracts per mode.
- [ ] 1.3 Preserve existing chat behavior when no mode is requested.

## 2. Surface Integration

- [ ] 2.1 Integrate diagnosis explainer and path advisor with student learning overview/path center.
- [ ] 2.2 Integrate resource coach with ResourceNode launches and path execution context.
- [ ] 2.3 Integrate grading assistant and student feedback explainer with the document grading workbench when present.
- [ ] 2.4 Integrate class summarizer and prep coauthor with teacher report and prep-pack pages when present.

## 3. Verification

- [ ] 3.1 Add runtime tests for context scope, citation requirements, and unavailable dependencies.
- [ ] 3.2 Add tests that client hints cannot expand user, class, resource, path, grading, or prep-pack scope.
- [ ] 3.3 Add UI or contract tests for representative mode mounts.
- [ ] 3.4 Run `rtk openspec validate expand-konling-teaching-assistant-modes --strict`.
