## ADDED Requirements

### Requirement: Every Authority surface uses the localized presentation record

Root, domain, relation-family, neighborhood, search, node detail, accessibility,
knowledge-card, and infograph surfaces MUST use the same resolved display label
and aliases for a selected Authority snapshot. Association and requests MUST
continue to use internal stable identity.

#### Scenario: A learner opens a localized node

- **WHEN** a visible node has a resolved Chinese primary label
- **THEN** the canvas, search result, accessible name, and inspector SHALL show
  the same Chinese label without exposing its internal ID

#### Scenario: A card is opened from a localized node

- **WHEN** the learner selects its knowledge card or infograph
- **THEN** the media SHALL be resolved by stable identity while the inspector
  retains the localized human-facing label
