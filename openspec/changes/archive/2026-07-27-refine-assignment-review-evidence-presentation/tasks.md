## 1. Original-response projection

- [x] 1.1 Consume the unified sealed-answer review projection with rendered response content, exact attachment identities, frozen submission order and provenance, safe display data, and protected read actions without conversion artifacts.
- [x] 1.2 Reuse persisted checksum/size verification, purpose authorization, private no-store, and `nosniff` for every original asset read.
- [x] 1.3 Normalize display names to safe basenames and prevent paths, provider metadata, and signed URLs from entering logs or durable UI state.

## 2. Format presentation

- [x] 2.1 Render saved Markdown, formulas, and embedded images in their original positions.
- [x] 2.2 Add protected direct previews for PNG/JPEG and an isolated PDF reader with open/download fallback.
- [x] 2.3 Add numbered DOC/DOCX/PPTX file cards with protected open/download actions.
- [x] 2.4 Present Markdown and TXT attachments through the existing protected original-file card or direct-preview capability without defining a new complex reader.
- [x] 2.5 Remove conversion text, technical status, provider details, and error codes from the assignment original-response region.

## 3. Incomplete-suggestion review

- [x] 3.1 Display the non-technical missing-attachment notice and safe attachment names beside the affected AI suggestion.
- [x] 3.2 Keep the original-response region unchanged when attachment understanding is unavailable.
- [x] 3.3 Add the revision-bound teacher confirmation control and send confirmation plus omitted asset identities to the govern-owned approval contract.
- [x] 3.4 Consume success, missing-confirmation, and stale-revision results end to end without implementing a parallel server gate or audit writer.

## 4. Verification

- [x] 4.1 Add format-specific component tests for rendered response Markdown/images, Markdown/TXT protected presentation, PNG/JPEG, PDF fallback, and office-file cards.
- [x] 4.2 Add security tests for authorization, integrity mismatch, cache/headers, safe filenames, and signed-URL non-disclosure.
- [x] 4.3 Add end-to-end approval-consumption tests proving the UI sends confirmation and handles govern-owned missing-confirmation and stale-revision rejection.
- [x] 4.4 Run affected unit/integration tests, typecheck, and browser accessibility acceptance for the teacher workbench.
