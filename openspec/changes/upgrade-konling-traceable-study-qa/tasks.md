## 1. Runtime answer contracts

- [x] 1.1 Extend the generic Konling runtime with study-question intents, step contracts, normative verification state, and presentation-only preferences.
- [x] 1.2 Classify the latest scoped learner question and include the resolved study-question contract in the runtime prompt and stream metadata.
- [x] 1.3 Preserve Source Pack verification metadata needed to determine whether a citation can support normative guidance.

## 2. Citation traceability presentation

- [x] 2.1 Parse only server-known citation identifiers from material-answer markers and attach answer-unit bindings to final citation metadata.
- [x] 2.2 Extend the existing citation panel to show the resolved answer form, normative verification state, and answer-unit evidence bindings without rendering model-authored links.

## 3. Verification and local comparison

- [x] 3.1 Add focused runtime and citation-presentation tests for all study-question contracts, normative evidence downgrade, and invalid evidence markers.
- [x] 3.2 Run focused tests, scoped TypeScript verification, OpenSpec validation, and the local application; capture contract and rendered citation-panel comparison evidence.

## 4. Answer-unit citation coverage and validation (#1819)

- [x] 4.1 Map every study-question section to an evidence-required or model-derived citation policy and expose the mapping to prompt, guard, and presentation layers.
- [x] 4.2 Bind per-unit citation markers to their answer section, compute per-section traceability coverage, and downgrade uncovered evidence-required sections with section-scoped reasons.
- [x] 4.3 Report unverified or out-of-range numeric citation markers and strip them from persisted answer bodies on both streaming and session-message paths.
- [x] 4.4 Add regression tests covering all six study-question intents, normative fail-closed coverage exemption, derivation labeling, and invalid-marker stripping.
