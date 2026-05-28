## Why

Future UI work cannot stop at the student experience. Evidence governance, ResourceNode warnings, teacher policy, path eligibility, privacy scopes, and data-center reporting all need coherent teacher/admin workspaces. The report already identifies teacher/admin/data center as a core role surface, and the active adaptive series adds teacher ResourceNode management and governance contracts.

## What Changes

- Define teacher governance workspace UI that consumes the existing `teacher-resource-node-management` capability for ResourceNode browse/search, mapping warnings, evidence instrumentation, availability, privacy, policy, and path eligibility.
- Define admin/data-center UI for evidence source coverage, readiness, missing context, replay/confidence, adaptive evaluation events, and governance status.
- Keep raw traces, hidden official evaluation internals, raw answers, and private Konling memory restricted.

## Capabilities

### New Capabilities
- `teacher-admin-governance-workspaces-ui`: Defines teacher and admin governance workspace UI contracts for resources, evidence, privacy, and data center status.

## Impact

- Affects teacher resource/admin routes, admin data governance/states pages, evidence timeline browser, and future ResourceNode management routes.
- Depends on shared shell/status UI, evidence governance, ResourceNode registry, teacher ResourceNode management, and adaptive governance contracts.
- Does not own teacher homepage/dashboard redesign and does not reimplement the `teacher-resource-node-management` backend or edit rules.
