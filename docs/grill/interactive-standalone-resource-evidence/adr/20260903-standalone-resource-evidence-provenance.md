# Preserve Standalone Resource Provenance at the Runtime Boundary

Standalone interactive resources must pass an explicit standalone launch context into the shared runtime and persist authenticated learner events as `standalone_resource` events. The runtime must not infer learning provenance from a presentation flag such as `embedded`, because the same renderer is used by classroom and direct-resource entrypoints; explicit context preserves correct event classification without treating participation as mastery.

## Considered Options

- Infer standalone status from `embedded` or whether a classroom session exists: rejected because the shared renderer currently forces the presentation flag and can silently classify direct-resource activity as classroom activity.
- Keep all standalone activity in browser storage: rejected because it loses authenticated activity on device changes/restarts and disconnects the resource from governed learning evidence.
- Pass an explicit launch surface/context and use the existing server event ingestion path: accepted because it preserves the classroom boundary, reuses existing provenance classification, and keeps evidence eligibility governed by event type.
