## Context

The canonical role-based diagnosis specification requires teacher views to preserve current-class authorization, evidence references, coverage, confidence, and evidence cutoffs. It also excludes legacy `participation` and `ai_misuse` flags from current diagnosis. The original change mixed backend infrastructure with an unimplemented dashboard workflow and did not define report authorization or worker execution.

## Goals and non-goals

Goals:

- Provide an executable deterministic risk pipeline for the three current risk types.
- Provide teacher-scoped diagnosis tools that expose only governed summaries.
- Provide authorized, durable class and student diagnosis reports.
- Preserve preparation navigation without automatically creating teaching actions.

Non-goals:

- Teacher dashboard entry and diagnosis report rendering.
- Student-facing diagnosis surfaces.
- AI-generated risk flags or automatic interventions.

## Decisions

### Current risk state is evidence-driven

The scanner evaluates only `constraint`, `stagnation`, and `cross_domain`. Each rule may create a flag, update its governed summary, resolve an active flag when the rule clears, or leave the state unchanged. A partial unique index enforces one active flag per student and risk type, and a concurrent create retries against the winning active row. Legacy risk types remain audit-only. The worker scans students with a stable user-id cursor so the job is bounded and resumable at page boundaries.

### Authorization is revalidated inside diagnosis tools

The runtime does not trust model-supplied scope. Each tool revalidates that the active class exists, is active, and belongs to the authenticated teacher. Student requests additionally require current class membership. Tool output consists of whitelisted summaries, coverage, confidence, evidence cutoff, and opaque references; raw evidence JSON and private submissions are not returned.

### Reports use server-derived scope

The report API derives class or student scope from the authenticated teacher, route class, and optional target student. The database stores class, creator, target, evidence cutoff, report version, and structured report content as separate governed fields. Writes accept only allowlisted finding, evidence-reference, coverage, confidence, and limitation fields. Risk summaries and the generator version are produced by the server rather than accepted from the client. Reads repeat the same class ownership and membership checks.

### Preparation links are report metadata

A finding with a knowledge-node identifier receives a server-generated preparation link. The link is navigation only and does not create a preparation pack or intervention.

## Risks and mitigations

- A scan rule failure could block later students. The scanner isolates failures per rule and records failure counts.
- Large cohorts could cause unbounded jobs. The worker uses bounded pages and supports a maximum-student limit.
- JSON reports could become a data-exfiltration path. The service uses strict allowlisted schemas, validates governed evidence-reference prefixes, derives report metadata on the server, and persists only after authorization.

## Verification

- Unit tests cover risk transitions, paging, teacher scope, membership, redaction, report validation, persistence, and reads.
- Prisma schema validation and strict OpenSpec validation verify contract shape.
- TypeScript typecheck verifies runtime and worker integration.
