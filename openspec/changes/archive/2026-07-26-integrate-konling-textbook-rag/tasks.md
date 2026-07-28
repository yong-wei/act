## 1. Shared Tool and Context Contracts

- [x] 1.1 Register the textbook RAG tool in the shared server-side page-tool registry
- [x] 1.2 Preserve the existing generic page-context injection while exposing only the tools allowed for each page, mode, and role
- [x] 1.3 Verify that tool availability, autonomous non-use, failures, and personalized claims produce the specified diagnostic states

## 2. Textbook Retrieval and Evidence Handoff

- [x] 2.1 Adapt Source Pack textbook retrieval to the structured runtime and hybrid retrieval service
- [x] 2.2 Treat current knowledge-node bindings only as candidate-expansion signals, never as direct evidence
- [x] 2.3 Split retrieved windows into directly supporting structure units or fragment anchors and apply the approved source priority
- [x] 2.4 Hand only bounded candidate text, stable locations, and server-assigned citation numbers to the answering model

## 3. Unified Citation Contract

- [x] 3.1 Assign one server-owned `[1]`, `[2]`, ... sequence across textbook content and learning evidence
- [x] 3.2 Update the answer contract and shared renderer to accept only assigned numbers and unified source records
- [x] 3.3 Deterministically normalize known nonstandard citation forms and remove raw internal citation identifiers from production output
- [x] 3.4 Implement one frozen-context citation-mapping retry for unknown or ambiguous references without regenerating answer prose
- [x] 3.5 Replace the same streamed message revision and expose only the approved partial or complete verification status to users

## 4. External Retrieval Timing

- [x] 4.1 Start the initial streamed answer from lexical or local-fusion results after the measured soft-timeout threshold
- [x] 4.2 Display exactly “正在后台优化响应” while external embedding or reranking continues within the measured P95 limit
- [x] 4.3 Compare stable evidence identifiers when background results arrive and regenerate the same message only when preferred or used evidence changes
- [x] 4.4 End the optimization state without another model call when the final evidence set is equivalent

## 5. Final Runtime Cutover

- [x] 5.1 Migrate every textbook runtime consumer to structure units, retrieval windows, navigation indexes, and fragment anchors
- [x] 5.2 Remove the old `sections/chunks/search-documents/citation-map` runtime, transitional v2 test artifacts, and all legacy fallback readers
- [x] 5.3 Update export and deployment workflows for a stop-the-world rollout of matching application and textbook runtime versions
- [x] 5.4 Verify that no legacy mapping, redirect, dual-format production path, or startup content-hash gate remains

## 6. End-to-End Verification

- [x] 6.1 Add tests for page-tool selection, context injection, source priority, evidence adjudication, unified numbering, repair retry, and background refresh
- [x] 6.2 Rebuild all six textbooks and the reference collection locally and verify index, citation, navigation, and reader resolution
- [x] 6.3 Run browser acceptance for the known unit-step-response query and representative content and learning-evidence citations
- [x] 6.4 Complete full local type, test, build, and deployment-smoke verification before production cutover
