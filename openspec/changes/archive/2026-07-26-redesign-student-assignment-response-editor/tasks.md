## 1. Dependency integration

- [x] 1.1 Integrate the shared assignment-embedded editor for the question response body and embedded image references.
- [x] 1.2 Integrate the unified answer, attachment-count, format, ordering, and submission APIs without adding client-only contract variants.
- [x] 1.3 Remove active UI branching on legacy `TEXT` and `FILE` response rules while retaining read compatibility.

## 2. Attachment interaction

- [x] 2.1 Build file selection and drag-and-drop upload with the agreed Chinese format, size, and remaining-count preflight feedback.
- [x] 2.2 Build the numbered attachment list with waiting, uploading, finalized, failed, retrying, and removing states.
- [x] 2.3 Add pointer drag sorting plus keyboard-operable move controls and submit complete revision-guarded orders.
- [x] 2.4 Display the grading-order explanation and combined embedded/independent attachment count.
- [x] 2.5 Map every known structured server error to the affected control and a safe Chinese message.

## 3. Question submission state

- [x] 3.1 Compose text save, asset upload, and answer readiness into clear draft, submit-ready, submitting, submitted, and failed states.
- [x] 3.2 Build the question error summary and links to empty content, unfinished uploads, failed assets, or stale ordering.
- [x] 3.3 Preserve focus movement, next-unsubmitted-question action, and state announcements after submit success or failure.

## 4. Verification

- [x] 4.1 Add component tests for text-only, attachment-only, mixed, over-limit, unsupported-format, upload failure, reorder conflict, and retry flows.
- [x] 4.2 Add keyboard, screen-reader, and 320px/375px responsive tests for editing, upload, sorting, validation, and submission.
- [x] 4.3 Run affected unit/integration tests, typecheck, and browser acceptance against the real unified APIs.
