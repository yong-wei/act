## 1. Data And Pipeline

- [x] 1.1 Define submission asset, converted document, rubric definition, grading run, grading annotation, and review-state contracts.
- [x] 1.2 Add a conversion adapter boundary with MarkItDown as the first PDF/Office-to-Markdown adapter.
- [x] 1.3 Preserve page, block, span, checksum, and conversion confidence metadata for grading and citation.

## 2. Grading And Writeback

- [x] 2.1 Define analytic rubric schema with criterion levels, weights, evidence requirements, and profile writeback mappings.
- [x] 2.2 Define grading draft output, citation requirements, teacher edit behavior, and approval workflow.
- [x] 2.3 Write approved grading results into governed evidence and registered goal dimensions without bypassing feature-cache confidence policies.

## 3. UI Integration

- [x] 3.1 Build teacher grading workbench with upload queue, conversion status, preview, rubric tree, draft grading, annotation editor, and approval actions.
- [x] 3.2 Build student feedback view with annotated document, rubric breakdown, evidence capsules, and profile impact summary.
- [x] 3.3 Integrate Konling entry points for teacher grading assistant and student feedback explainer where available.

## 4. Verification

- [x] 4.1 Add conversion worker tests for success, failure, retry, and fallback mapping.
- [x] 4.2 Add route/UI tests for teacher review and student feedback access.
- [x] 4.3 Add evidence writeback tests for approved and rejected grading runs.
- [x] 4.4 Run `rtk openspec validate add-document-rubric-grading-workbench --strict`.
