## Purpose

Define the shared scoring contract for objective answers in manifest-driven
interactive lessons so browser submission telemetry and server-side learning
fact materialization produce the same versioned scoring evidence.

## Requirements

### Requirement: Manifest objective scoring is shared
The system SHALL score manifest objective submissions through a shared scoring
implementation used by both submission telemetry and LearningFact
materialization.

#### Scenario: Frontend and server scoring agree
- **WHEN** the same objective manifest metadata and submitted answer are scored
  in frontend telemetry and server materialization
- **THEN** both callers SHALL produce the same normalized score, correctness,
  scoring version, and scoring detail.

### Requirement: Objective scoring supports structural partial credit
The system SHALL score objective answers by question structure rather than by
opaque answer text alone.

#### Scenario: Multi-select answer is partly correct
- **WHEN** a student selects some correct options and includes or omits other
  options
- **THEN** the scoring detail SHALL identify correct hits, missed correct
  options, and extra wrong options
- **AND** the normalized score SHALL represent partial credit when the policy
  permits it.

#### Scenario: Unmapped reference tokens are preserved
- **WHEN** a reference answer contains a token that cannot be mapped to the
  card's configured options
- **THEN** the token SHALL remain in the normalized reference instead of being
  silently dropped.

#### Scenario: Ordering answer is partly correct
- **WHEN** a student submits an ordering answer with some items in the correct
  relative or absolute position
- **THEN** the scoring detail SHALL identify the matched structure and partial
  credit instead of treating every non-identical text answer as equally wrong.

#### Scenario: Extra objective tokens are not hidden by normalization
- **WHEN** a student submission contains duplicate or extra tokens such as
  `A|B|B|C`
- **THEN** scoring SHALL preserve the submitted token cardinality
- **AND** duplicate or extra tokens SHALL not be deduplicated into full credit.

#### Scenario: Matching answer ignores pair order
- **WHEN** the reference pairs are `1-3,2-4,5-1` and the student submits
  `5-1,1-3,2-4`
- **THEN** the answer SHALL be treated as structurally equivalent
- **AND** correctness SHALL be based on each prompt-side item paired with the
  submitted answer-side item.

#### Scenario: Hyphenated option values remain slot answers
- **WHEN** a matching submission contains option values with hyphens such as
  `few-errors-insufficient|rules-hard-cover`
- **THEN** those option values SHALL be treated as slot answers unless both
  sides of a parsed pair match the question's known item and option structure.

#### Scenario: Legacy matching answer preserves slot positions
- **WHEN** a `drag_match` card uses ordered `options` without explicit
  `referenceMatches`
- **AND** the student submission contains an empty slot such as `A||C`
- **THEN** the empty slot SHALL remain aligned to its original prompt-side
  position when partial credit is calculated.

### Requirement: Scoring evidence is versioned and traceable
The system SHALL store scoring results with enough context to explain and
recompute objective evidence.

#### Scenario: Objective fact is materialized
- **WHEN** an objective LearningFact is created from a manifest submission
- **THEN** its context SHALL include scoring version, normalized submitted
  answer, normalized reference, per-item detail, and unsupported reason when
  applicable.

#### Scenario: Unsupported-only card remains traceable
- **WHEN** a manifest submission carries an objective card with
  `unsupportedReason` but no scoreable answer
- **THEN** LearningFact materialization SHALL retain that card in
  `interactiveQuiz.cards`
- **AND** the fact SHALL not invent a numeric score for the unsupported card.
