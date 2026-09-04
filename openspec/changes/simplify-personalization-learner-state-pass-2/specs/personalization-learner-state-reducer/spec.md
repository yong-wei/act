## ADDED Requirements

### Requirement: Learner-state second pass reduces the mixed internal implementation
The second simplification pass SHALL make the existing pure reducer and effectful application boundary visible in module dependencies. Against commit `f79f1836fd57dce483d01194e627ef36d929d637`, the fixed baseline is all seven non-test `.ts`/`.tsx` files under `src/features/personalization/learner-state/`, totaling 127,848 bytes. Completion SHALL reduce that total to at most 102,278 bytes, counting any new production file or positive byte delta that receives code moved from the baseline set. It MUST NOT add a second reducer, forwarding facade, public export, or alternate evidence authority.

#### Scenario: Pure and effectful responsibilities are simplified
- **WHEN** the pass moves, inlines, or deletes a learner-state helper
- **THEN** reducer code SHALL remain deterministic and free of database, route, queue, cache-write, and persistence effects
- **AND** application/adapters SHALL retain authorization, reads, pagination, and persistence attachment.

#### Scenario: Behavior is compared with the baseline
- **WHEN** the simplified module is evaluated with the characterized Learning Record, Assessment, portrait, plugin, role, freshness, and no-evidence inputs
- **THEN** values, limitations, source identities, visibility, and ordering SHALL remain equivalent
- **AND** before/after evidence SHALL show the required byte reduction using the fixed calculation.

#### Scenario: A change only redistributes code
- **WHEN** the calculated after total exceeds 102,278 bytes or a new facade or duplicate reducer appears
- **THEN** the pass SHALL not be accepted
- **AND** the last passing implementation SHALL remain the rollback point.
