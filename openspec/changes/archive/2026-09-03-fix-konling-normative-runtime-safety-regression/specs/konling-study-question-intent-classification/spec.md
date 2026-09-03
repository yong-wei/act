## ADDED Requirements

### Requirement: Frozen normative status regression is gated
The repository SHALL keep a frozen normative-status regression set covering standard phrasings, implicit phrasings, multi-intent phrasings, standard-identifier phrasings, obligation phrasings, and negative course-vocabulary phrasings, and automatic tests SHALL report the normative status confusion matrix over that set.

#### Scenario: The frozen normative set is evaluated
- **WHEN** the normative runtime-safety tests run
- **THEN** they SHALL load the frozen normative-status cases
- **AND** normative status determination accuracy SHALL be at least 90%
- **AND** `verification-required` recall over the normative-risk cases SHALL be at least 90%
- **AND** negative course-vocabulary cases SHALL remain `not-applicable` so ordinary course questions are not blanket-refused.
