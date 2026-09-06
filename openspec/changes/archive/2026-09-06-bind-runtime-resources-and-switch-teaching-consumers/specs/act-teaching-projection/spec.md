## ADDED Requirements

### Requirement: Teaching resource consumers share one live course projection
All teaching-semantic consumers that read course resources or bindings MUST resolve the same live course Teaching Projection identity. The live set is `projection/current.json` plus the overlay inspector sidecar course pointer. Konling, path planning, course pages, and teaching-resource RAG MUST overlay that live identity onto their teaching pins when Authority release matches. Engineering-only consumers MAY keep a null projection. The domain-fragments overlay pointer and sealed consumer-activation identity MUST remain the canvas/authority identity and MUST NOT be overwritten by the course projection id.

#### Scenario: Restage updates live teaching pointers
- **WHEN** a new course Teaching Projection B′ is activated
- **THEN** the course current pointer and inspector sidecar SHALL name B′
- **AND** Konling, path planning, course pages, and teaching-resource RAG SHALL resolve B′ for resources
- **AND** `engineering-graph` and `engineering-rag` SHALL keep null projection ids
- **AND** domain-fragments `current.json` and consumer-activation `activation-0b72f577` SHALL stay

#### Scenario: Sidecar lags the course pointer
- **WHEN** `projection/current.json` names B′ but the inspector sidecar still names the predecessor
- **THEN** live teaching overlay SHALL NOT apply
- **AND** the restage MUST NOT be marked complete
