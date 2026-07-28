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
