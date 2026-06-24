## ADDED Requirements

### Requirement: Knowledge graph semantic-map evidence is required
Commercial UI governance SHALL require current evidence that the knowledge graph presents a readable semantic map, not only that relation mappings exist.

#### Scenario: Semantic-map presentation is checked
- **WHEN** governance validates `/knowledge`
- **THEN** checks SHALL include default semantic map, selected-neighborhood clarity, dense/all-relations mode, graphical legend consistency, light theme, and dark theme
- **AND** screenshots alone SHALL NOT pass unless current source or DOM evidence also proves graph and legend styles share the same visual contract.

#### Scenario: Presentation regression is detected
- **WHEN** relation edges are globally thick or saturated, relation types rely on color alone, semantic clusters are absent or decorative, labels are unreadable, or the graph returns to an all-edge tangle by default
- **THEN** governance SHALL fail or report a blocking semantic-map presentation regression.
