## Context

Portrait v2 is the canonical cumulative learner-attainment projection. The
class cumulative route already reads valid native portrait v2 records, while
the teacher student route independently builds a recent, class-scoped legacy
projection. That split makes the teacher detail contradict the class card and
student profile. It also passes a vector whose dimension timestamps were
generated after the last source fact into a compatibility validator bounded by
that fact timestamp.

## Goals / Non-Goals

**Goals:**

- Give an authorized teacher the learner's valid native cumulative portrait in
  the student detail whenever the class cumulative view can use it.
- Preserve the recent class-scoped evidence drawer and recent-only diagnostic
  signals without allowing their absence to remove cumulative attainment.
- Keep cumulative class insight requests independent from recent compatibility
  projection construction.

**Non-Goals:**

- Do not change portrait materialization, raw LearningFacts, class membership,
  authorization, or the student profile contract.
- Do not synthesize a portrait for a learner without a valid native portrait.
- Do not relabel recent diagnostics as cumulative attainment.

## Decisions

### Select native portrait v2 once for the teacher detail primary result

The teacher student route will use the same validated native portrait reader
and reviewer projection as the class cumulative route. Its summary becomes
the detail's primary score, dimensions, generation timestamp, and fact count.
Recent scoped facts remain available for the evidence drawer and diagnostic
metadata only. Recomputing a compatibility portrait from scoped facts was
rejected because it neither has the cumulative semantics requested by the
parent view nor carries a valid materialization clock.

### Treat missing recent scoped evidence as a diagnostic boundary only

When a valid native portrait exists but the learner has no recent fact in the
current class, the detail will still return the cumulative portrait. The
evidence drawer will retain its existing empty recent state. A learner with no
valid native portrait remains an explicit no-evidence result; no zero vector
or compatibility substitute is generated.

The `no-evidence-after-revocation` lifecycle state is different from ordinary
absence of recent facts: it suppresses an older native portrait until a later
governed rebuild creates a non-revoked state. Class comparisons expose scores
only when both the learner dimension and the cumulative class mean have
evidence; missing values remain unavailable rather than becoming zero.

### Construct recent compatibility projections only for recent class scope

The class insights route will build recent class-scoped projections and
compatibility summaries only when `scope=recent`. Cumulative scope uses its
native portrait map directly. This preserves the independent cumulative
materialization contract and removes the invalid timestamp conversion from an
unrelated cumulative request.

## Risks / Trade-offs

- [A native portrait is absent while historical facts exist] → Return the
  existing no-evidence state; the established materialization/backfill path,
  rather than the teacher route, remains responsible for producing the native
  projection.
- [Recent diagnostic labels could look cumulative] → Keep their existing
  scoped drawer and activity fields distinct from the primary portrait.
- [Recent-scope behavior regresses] → Add regression tests for the recent
  projection branch and leave its selection path unchanged.

## Migration Plan

1. Deploy the route-only change with its focused tests and type check.
2. Verify a completed-course learner displays the existing native portrait in
   teacher detail, and a learner with current scoped evidence no longer makes
   the cumulative class request fail.
3. Roll back by reverting this route change; derived data remains unchanged.

## Open Questions

None.
