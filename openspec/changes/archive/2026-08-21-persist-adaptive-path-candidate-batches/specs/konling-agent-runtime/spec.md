## ADDED Requirements

### Requirement: Konling generation results expose persisted batch identity
After successful adaptive path generation, Konling SHALL receive and expose the persisted candidate batch ID and candidate IDs returned by the server, and SHALL NOT derive those identities from assistant text.

#### Scenario: Successful generation returns shared identity
- **WHEN** Konling completes a path generation request successfully
- **THEN** its structured result references the same batch ID and candidate IDs that the path center can read

### Requirement: Konling reads planner candidates without rewriting them
When explaining a persisted batch, Konling SHALL use the server-owned batch projection and SHALL preserve planner ordering, candidate content, and recommendation provenance.

#### Scenario: Explanation uses stored candidates
- **WHEN** Konling explains or links to a candidate from a successful batch
- **THEN** it references the persisted candidate and does not independently re-rank, regenerate, or rewrite the candidate set
