## ADDED Requirements

### Requirement: Knowledge graph visual QA blocks unreadable graph regressions
Commercial UI governance SHALL verify that the knowledge graph satisfies the approved visual grammar, compact tool behavior, and readability evidence before accepting it as migrated.

#### Scenario: Knowledge graph route is checked
- **WHEN** governance checks `/knowledge`
- **THEN** the checks SHALL verify collapsed default local tools, graphical relation legend samples, localized filter labels, bounded node scaling, fine-line relation styles, active filter summaries, and selected-node preservation across tool open and close
- **AND** text-only legends, raw schema labels, permanent desktop chapter/filter/legend/resource panels, or all-edge tangle defaults SHALL fail or be reported according to governance mode.

#### Scenario: Runtime relation coverage is checked
- **WHEN** governance checks knowledge graph visual semantics
- **THEN** the checks SHALL read the runtime knowledge graph relation types and verify each type has a mapped Chinese label, visual family, direction semantics, density policy, and legend explanation
- **AND** unmapped runtime relation types SHALL fail the check or be reported as blocking coverage gaps.
