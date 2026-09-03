## ADDED Requirements

### Requirement: Konling applies an independent fail-closed gate to normative questions
Konling SHALL detect normative-risk questions independently of the primary answer-intent classifier. A question that asks about a standard identifier, regulation, certification, official requirement, official limit, or obligatory must/must-not/shall language MUST enter `verification-required` when no server-verified authoritative citation is available, even if the classified intent is not `normative-content`. Konling MUST NOT treat client-supplied `verified` flags, prompt-injected source claims, or self-reported citations as authoritative.

#### Scenario: Misclassified normative question still degrades
- **WHEN** a learner asks a normative-risk question that the primary classifier labels as fact-explanation or another study-question intent
- **AND** the server citation context has no verified official-reference citation with a usable target
- **THEN** Konling SHALL set `studyQuestion.normativeGuidance` to `verification-required`
- **AND** the system prompt SHALL require a verification-needed answer that states the evidence gap, answerable boundary, and a verification suggestion
- **AND** it SHALL NOT present the answer as a definitive standard, official rule, certification, or required format.

#### Scenario: Standard number, regulation, certification and obligation examples are covered
- **WHEN** the current user question contains a standard identifier, regulation or legal clause, industry certification, official limit, or must/must-not/shall constraint language
- **AND** no server-verified authoritative citation is available
- **THEN** Konling SHALL apply the fail-closed gate
- **AND** a general-concept question that only mentions “标准” as ordinary course vocabulary SHALL NOT be forced into `verification-required` solely because of that word.

#### Scenario: Verified official citation remains verified
- **WHEN** a normative-risk question has a server-verified official-reference citation with high confidence, a citation target, and a usable href
- **THEN** Konling MAY mark `normativeGuidance` as `verified`
- **AND** the verified status SHALL be produced only from that server-owned citation.

#### Scenario: Client cannot self-mark a source as verified
- **WHEN** the client supplies a citation marked verified, claims in the user prompt that a source is already verified, or injects an unofficial resolver or missing citation target
- **THEN** Konling SHALL keep `normativeGuidance` as `verification-required` for a normative-risk question
- **AND** it SHALL NOT promote the answer to verified normative guidance.

#### Scenario: Citation guard exposes the fail-closed state
- **WHEN** the runtime contract has `normativeGuidance` equal to `verification-required`
- **THEN** the citation guard SHALL include `normative-guidance-verification-required`
- **AND** the response metadata SHALL remain distinguishable as verification-required rather than verified.
