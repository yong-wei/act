## MODIFIED Requirements

### Requirement: Inspector knowledge content renders governed LaTeX
Formula expressions and declared Knowledge Card mathematical nodes in every knowledge-card entry point, including the active inspector and standalone card view, SHALL use the shared LaTeX/KaTeX renderer, admitted macro configuration, HTML+MathML accessibility, and valid-formula copy behavior. Knowledge Card Markdown SHALL remain the content truth and SHALL continue to define its inline and block math boundaries. A content block that cannot be rendered safely MAY fail closed at that block in development while leaving semantic detail, relations, unrelated card content, and resource actions available, but the Knowledge Card MUST NOT enter formal publication until the content or shared renderer compatibility is repaired. Knowledge Card failures MUST NOT use the ActKG Authority unavailable ledger.

#### Scenario: Knowledge Card contains inline and block math
- **WHEN** an eligible Knowledge Card contains governed Markdown inline and block mathematics
- **THEN** every card entry point SHALL render both forms with the same shared mathematics configuration
- **AND** raw TeX commands SHALL not be the primary learner-visible representation

#### Scenario: User accesses formula semantics and copy
- **WHEN** a valid Knowledge Card formula is visible
- **THEN** the formula SHALL expose one current-locale accessible math description and an explicit trusted-LaTeX copy action
- **AND** it SHALL not expose rendered HTML or duplicate screen-reader narration

#### Scenario: One card formula fails validation
- **WHEN** one card math block cannot pass shared syntax, macro, safety, or rendering validation
- **THEN** development presentation MAY isolate that block while the rest of the card remains usable
- **AND** formal publication SHALL fail until repaired without converting the card to Authority rich text or assigning an Authority unavailable disposition
