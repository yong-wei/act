# Assignment legacy document-grading retirement

Legacy `LearningEvidenceDraft(sourceType=document_rubric_grading)` writes are
retired. `/api/teacher/document-grading/submissions` stays 410.
Approve/writeback-preview keep the native `GradingRun` pipeline, then return
410 for the draft fallback.

Teacher workbench and student document-feedback no longer load drafts or demo
views. Assignment-bound pipeline reviews still redirect to the public review
API. Historical classification is read-only and cannot write LearningFact.

Native `/api/teacher/document-grading/pipeline/**` is not a deletion target.
Receipts keep source revision, hashes, and conclusion only.
