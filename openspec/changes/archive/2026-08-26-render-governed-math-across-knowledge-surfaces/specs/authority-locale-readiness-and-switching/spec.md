## ADDED Requirements

### Requirement: Rich-text mathematics preserves locale and slot integrity
Authority locale qualification SHALL validate each localized rich-text document's locale, deterministic fallback, math-slot sequence, same-release math references, and current-locale accessible labels. Chinese and English documents in one equivalence group MUST preserve identical math-slot identities and occurrence counts. The product MUST NOT fill a missing accessible label, text span, or unavailable fallback from another language.

#### Scenario: Chinese and English rich documents have matching math slots
- **WHEN** both locale documents reference the same qualified math assets in the same slot order and each asset has the selected-locale accessible label
- **THEN** rich-text locale qualification SHALL pass for those documents
- **AND** language switching SHALL replace surrounding text and accessibility labels without changing math identity or graph state

#### Scenario: One locale has slot drift
- **WHEN** a locale document drops, duplicates, reorders, or replaces a math slot relative to its qualified equivalent
- **THEN** that locale qualification SHALL fail closed
- **AND** the product SHALL NOT repair parity from another release or by scanning fallback text

#### Scenario: Formula is registered unavailable in the selected locale
- **WHEN** a math span has a current matching registered-unavailable disposition and safe selected-locale fallback
- **THEN** the product MAY present that bounded fallback without switching language or inserting another locale's label
- **AND** the exception SHALL remain bound to the exact Authority and locale qualification evidence
