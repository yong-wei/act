## MODIFIED Requirements

### Requirement: Retrieval separates teaching knowledge and learner evidence
The retrieval layer SHALL distinguish high-authority teaching knowledge from personalized learner evidence.

#### Scenario: Concept explanation is requested
- **WHEN** a user requests a course concept explanation
- **THEN** retrieval SHALL prioritize high-authority course content, terminology, runtime handouts, textbooks, reference sections, figures, knowledge cards, and graph-bound resource chunks
- **AND** learner evidence SHALL NOT be required unless the answer makes personalized claims.
- **AND** missing learner evidence SHALL NOT prevent the response from returning verified teaching-content citations when those citations are available.

#### Scenario: Personalized recommendation is requested
- **WHEN** a diagnosis, path, grading, Konling, or prep-pack response makes a personalized claim
- **THEN** retrieval SHALL include authorized learner evidence where available
- **AND** the response SHALL expose a limitation when learner evidence is missing or low confidence.
- **AND** the limitation SHALL affect personalization scope, confidence, and recommendation style rather than causing teaching-content retrieval to fail.
