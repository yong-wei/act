## 1. Fenced cumulative materialization

- [x] 1.1 Return the generation from fenced learner rebuild requests and enqueue
  selected full rebuilds without staging recent class work.
- [x] 1.2 Add a cumulative class job scope that aggregates current-membership
  native portrait v2 records into `class-competency.cumulative.v1` without
  changing recent snapshot behavior.

## 2. Operator backfill command

- [x] 2.1 Add the dry-run-first cumulative-attainment command, stable run-id
  validation, direct BullMQ enqueueing, wait/verification, and deterministic
  pilot limiting.
- [x] 2.2 Add the package script and privacy-safe aggregate operational output.

## 3. Cumulative teacher and student delivery

- [x] 3.1 Add cumulative/recent scope handling to authorized teacher insights
  and heatmap APIs, retaining exact recent semantics.
- [x] 3.2 Default teacher pages to cumulative attainment with an explicit
  recent switch, cumulative labels, and no synthetic trend; label student
  portrait generation time.

## 4. Verification

- [x] 4.1 Add focused unit coverage for historical-only portraits, no-evidence
  learners, fencing/retry recovery, isolated cumulative class versions, and
  teacher scope defaults/switching.
- [x] 4.2 Add and run disposable PostgreSQL plus Redis/BullMQ integration
  verification for the backfill-to-learner-to-class path.
- [x] 4.3 Run OpenSpec strict validation, focused tests, typecheck, and an
  independent data-governance review.
