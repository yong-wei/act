## Context

The user's original requirement explicitly states that platform resources must be uniformly registered and accessible/manageable from a new teacher entrance. This change isolates that UI and API surface from the lower-level registry.

## Decisions

### Keep Stage 1 management focused

Stage 1 supports categorized search, single-node review, warning visibility, availability, privacy level, teacher policy, and path eligibility. Bulk operations and deep analytics wait until ResourceNode coverage is stable.

### Enforce course/class/resource scope

Teachers can only manage authorized resources. The management surface must not expose private learner evidence, hidden Arena evaluation details, or private Konling memory.

## Risks / Trade-offs

- Too much editing power can corrupt planning metadata; system-owned fields remain immutable.
- Deferring bulk operations may slow initial cleanup but keeps the first implementation reviewable.

## Migration Plan

1. Add teacher management routes and APIs behind a flag.
2. Connect registry audit warnings.
3. Add scoped single-node edit flows.
4. Add permission and privacy tests.

## Open Questions

- None.
