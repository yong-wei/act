## Context

Batch B contains the unit-4 design sequence, unit-5 advanced methods, and the
Cruise course.  These routes use the same shared route loader/session framework
as Batch A but exercise more compute, control-workbench, simulation, and
teacher-projection modules.  The Rust/control-engine runtime remains the
numerical authority; route migration only composes its registered browser
surface.

## Goals / Non-Goals

**Goals:**

- Move every Batch-B route variant to one shared Classroom/session path.
- Preserve course identity, bundle/hash binding, class authorization, role-safe
  projections, simulation/runtime boundaries, and durable response evidence.
- Retire private route/session authorities after zero-caller proof.

**Non-Goals:**

- Rewriting simulation models, adding TypeScript physics, changing course
  content, lesson IDs, URL shapes, or Classroom/manifest contracts.
- Migrating Batch A again or changing the C11 qualification result.
- Introducing a second shell, direct Prisma route reads, or preview writes.

## Decisions

### 1. Keep an immutable Batch-B denominator

The ordered membership is fixed to units 4 and 5 plus Cruise.  Aliases and
course titles resolve to canonical identities but cannot pull other lessons
into the batch.  Batch-A code is consumed through its qualified shared path.

### 2. Compose advanced capabilities through existing plugins

Route adapters pass manifest and session context to the existing shared shell.
Control-workbench, interactive-figure, generated-slide, and simulation-backed
views are selected by the existing manifest plugin/registry contracts.  The
shell does not gain course-name branches, physics logic, or a private fallback.

### 3. Preserve persistence and role boundaries

Student and teacher routes use one session/access mechanism.  Live cursor and
presence data remain distinct from durable submission evidence and attempts;
teacher projection does not expose student-private or AI-only fields.  The Rust
engine remains behind the existing simulation adapter, and preview remains
read-only.

### 4. Qualify the hard cases before deletion

Characterize at least one ordinary, compute, visual, simulation, and
response-producing lesson, plus Cruise.  Exercise launch/join/waiting,
reconnect, submit/resubmit, teacher reveal, finish, runtime hash drift,
optional resources, and preview.  Delete private authorities only after all
route and test callers are migrated.

## Risks / Trade-offs

- [Simulation-backed modules render with the wrong role or runtime binding] →
  assert plugin identity, bundle/hash, Rust adapter boundaries, and student/
  teacher projections in route tests.
- [A compute submission is persisted only as live state] → test durable attempt
  identity and evidence after refresh/reconnect and teacher review.
- [Cruise-specific behavior is lost in generic routing] → retain only declared
  course configuration and compare Cruise characterization before deletion.
- [Batch boundaries drift] → reject route identities outside the explicit list
  and bind the ledger to the batch membership digest.

## Migration Plan

1. Confirm C11 qualification and freeze Batch-B inventory and behavior matrix.
2. Switch entry, student, teacher, waiting, and demo routes to C10 plus the
   existing shared Classroom shell.
3. Wire advanced manifest/plugin and simulation surfaces through existing
   adapters; verify live/evidence and role boundaries.
4. Re-run caller inventories and delete private authorities at zero consumers.
5. Roll back before deletion proof by restoring the last qualified adapter
   without rebinding sessions or changing runtime hashes.

## Open Questions

None.  Any lesson-specific behavior must be represented by its existing
manifest/plugin configuration; a new route or renderer authority is out of
scope.
