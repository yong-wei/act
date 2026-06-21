## 1. Writeback Contract

- [ ] 1.1 Define K/A/Q evidence writeback input, target, authority, confidence, limitation, and version-ref payloads.
- [ ] 1.2 Define evidence source classes and preview/official distinctions.
- [ ] 1.3 Define AI-generated and teacher-approved flags.

## 2. Governance And Audit

- [ ] 2.1 Add validation helpers that block or degrade writeback when required graph/resource/version refs are missing.
- [ ] 2.2 Add audit event payloads for evidence materialization and writeback.
- [ ] 2.3 Preserve privacy projection for student, teacher, admin, and service consumers.

## 3. Integration Boundaries

- [ ] 3.1 Connect path execution and terminal validation outcomes as candidate writeback inputs.
- [ ] 3.2 Connect governed Konling intervention outcomes without treating raw prose as mastery.
- [ ] 3.3 Connect approved grading/rubric outcomes as capability or quality evidence where mapped.

## 4. Verification

- [ ] 4.1 Add tests for knowledge/capability/quality routing.
- [ ] 4.2 Add tests that preview-only evidence cannot satisfy official terminal validation.
- [ ] 4.3 Add tests that missing version refs block or degrade production writeback.
- [ ] 4.4 Run `rtk openspec validate govern-kaq-evidence-writeback --strict`.
