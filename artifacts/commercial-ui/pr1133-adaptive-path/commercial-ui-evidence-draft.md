## Commercial UI Evidence — PR #1133

- Capture revision: `31a4bb90a8fede96ad1a4382e4e0a1beda7a7aa4`
- Capture target: `http://127.0.0.1:3063/assessment/adaptive-practice`
- UI evidence: **passed** for current-head component rendering at 1440/320, including configuration applied/unmet text, fewer-option explanation, route actions, low-budget blocked-generation message, and overflow checks.
- Backend E2E: **blocked-by-local-schema-drift** and recorded. The authenticated fixed demo account has no class binding; after a temporary local binding was restored, learner-state still returned HTTP 500 because the local database lacks current-head columns.
- Current-head UI projection fixture: deterministic Playwright route fulfillment exercises the real page components. This evidence is explicitly not production/backend E2E.
- Low-budget / minimum executable duration: the current-head blocked-generation response renders “你选择了 30 分钟，完成必需验证至少需要 32 分钟” at 1440/320 through a route-fulfilled UI fixture; this is not backend or production E2E evidence.
- Manifest: [manifest.json](./manifest.json)
