## MODIFIED Requirements

### Requirement: Konling applies an independent fail-closed gate to normative questions
Konling SHALL detect normative-risk questions independently of the primary answer-intent classifier. A question that asks about a standard identifier, regulation, certification, official requirement, official limit, or obligatory must/must-not/shall language MUST enter `verification-required` when no server-verified authoritative citation is available, even if the classified intent is not `normative-content`. Konling MUST NOT treat client-supplied `verified` flags, prompt-injected source claims, or self-reported citations as authoritative. The independent detection vocabulary SHALL cover at least the normative keyword surface used by the primary study-question intent classifier, so a mode whose answer intent falls back to a non-normative classification cannot bypass the gate.

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

#### Scenario: Independent detection keeps parity with the classifier vocabulary
- **WHEN** a mode resolves its answer intent through a fixed fallback such as `fact-explanation` instead of the generic study-question classifier
- **AND** the current user question matches a normative keyword that the generic classifier treats as `normative-content`, such as 国家标准, 行业标准, 标准格式, 规范格式, 规范书写, or 国标格式
- **AND** no server-verified authoritative citation is available
- **THEN** the independent normative-risk detector SHALL still trigger `verification-required` for that question.

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

## ADDED Requirements

### Requirement: Konling degrades non-compliant normative answers before delivery
When `normativeGuidance` is `verification-required`, Konling SHALL scan the final assistant answer for normative compliance before it is persisted or delivered as the final revision, and SHALL enforce the degradation deterministically in server-side post-processing rather than relying on the system prompt alone.

#### Scenario: Non-compliant answer is replaced by the degraded template
- **WHEN** `normativeGuidance` is `verification-required` and the final answer contains an unhedged authoritative obligation assertion, a standard identifier without a server-verified official-reference citation, or an authority link outside server-assigned citations
- **THEN** Konling SHALL replace the delivered answer body with a server-owned degraded notice that states the evidence gap, the answerable boundary, and a verification suggestion
- **AND** the degraded body SHALL NOT contain authoritative obligation assertions, standard identifiers, or authority links
- **AND** the citation guard SHALL record the normative compliance state and detected violation classes.

#### Scenario: Compliant answer passes through unchanged
- **WHEN** `normativeGuidance` is `verification-required` and the final answer already states the verification-needed framing with hedged language
- **THEN** the delivered answer body SHALL remain unchanged by the normative degradation step.

#### Scenario: Verified and non-normative answers are never degraded
- **WHEN** `normativeGuidance` is `verified` or `not-applicable`
- **THEN** the normative degradation step SHALL NOT modify the answer body.

#### Scenario: Both delivery routes enforce the gate
- **WHEN** a final answer is produced through the streaming chat route finalize path or the session messages route
- **THEN** both routes SHALL apply the same normative compliance scan and degradation before persisting or returning the final answer
- **AND** both metadata payloads SHALL expose the normative compliance state.
