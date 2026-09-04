# konling-fair-baseline-replay-evaluation Delta

## MODIFIED Requirements

### Requirement: Scorer-caliber replay on fixed answers
The system SHALL score frozen snapshots deterministically under named scorer calibers and SHALL support replaying any saved batch of answers under additional calibers without invoking the generation model. Replay defaults SHALL pair the frozen previous alias caliber with the current alias caliber so the replay report separately presents the scorer-caliber delta between them.

#### Scenario: Replay never regenerates
- **WHEN** replay-scoring runs against an existing snapshot directory
- **THEN** no generation provider is called and no answer file is modified

#### Scenario: Calibers disagree on semantic headings
- **WHEN** one answer uses a semantically equivalent alias heading
- **THEN** the alias caliber counts the section as present
- **THEN** the strict-title caliber counts the same section as missing

#### Scenario: Alias caliber versions disagree on decorated headings
- **WHEN** an answer uses decorative-prefix headings such as `### 🔍 故障定位` and the frozen batch is replayed under the frozen and current alias calibers
- **THEN** the current alias caliber passes the structure evaluation for that answer
- **AND** the replay report SHALL contain a caliber delta comparing the frozen caliber with the current caliber on the same answers

#### Scenario: Default caliber is the current alias caliber
- **WHEN** product code evaluates structure without an explicit caliber
- **THEN** evaluation uses the current version of the alias caliber family
- **AND** explicitly requesting the frozen previous alias caliber reproduces the pre-upgrade behavior
