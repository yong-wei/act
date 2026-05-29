## 1. Teacher Entrance

- [x] 1.1 Add a teacher ResourceNode management route/entry point.
- [x] 1.2 Implement categorized browse/search by node type, course/module, knowledge mapping, availability, teacher policy, privacy level, and path eligibility.
- [x] 1.3 Show registry audit warnings and path-exclusion reasons.

## 2. Scoped Management

- [x] 2.1 Add scoped single-node edit APIs for permitted metadata.
- [x] 2.2 Protect source id, protocol version, hidden evaluation internals, private learner evidence, and private Konling memory.
- [x] 2.3 Add permission checks for course, class, and resource scope.

## 3. Validation

- [x] 3.1 Add tests for teacher permissions, warning display, scoped edits, immutable fields, and privacy redaction.
- [x] 3.2 Validate with `rtk proxy openspec validate add-teacher-resource-node-management --strict`.
