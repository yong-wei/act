## 1. Local AI Task Dominance

- [ ] 1.1 Inventory AI/Prompt/Copilot/portfolio findings not closed by `audit-remediation-ai-task-boundaries`.
- [ ] 1.2 Ensure Prompt evaluation, AI workshop, Copilot reflection, and portfolio reflection expose primary local task inputs and output targets.
- [ ] 1.3 Prevent Global AI from capturing page-local task actions.
- [ ] 1.4 Add focus-order, inert/deprioritized background, and mobile safe-area rules for local AI task surfaces.

## 2. Task Status And Context

- [ ] 2.1 Add local stop, retry, clear, loading, degraded, completed, saved-draft, and discarded states where supported.
- [ ] 2.2 Preserve assignment/source/intent/output-target context across prompt history, workshop candidates, Copilot drafts, and portfolio flows.
- [ ] 2.3 Exclude raw prompt/tool/server context from candidate drafts and prevent candidate-to-evidence/profile/portfolio promotion before explicit save or submit.
- [ ] 2.4 Hide, disable with reason, or repair empty quick-question groups, nonfunctional clear actions, and 404 prompt links.
- [ ] 2.5 Update audit evidence with AI workspace finding ids and exclusions.

## 3. Verification

- [ ] 3.1 Add source/unit tests proving local task inputs, focus ordering, safe-area behavior, candidate boundaries, and status panels exist on target pages.
- [ ] 3.2 Capture browser evidence that local task inputs are not displaced by Global AI.
- [ ] 3.3 Run `rtk openspec validate audit-remediation-ai-prompt-workspace-polish --strict`.
