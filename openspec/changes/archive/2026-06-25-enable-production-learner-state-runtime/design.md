## Context

The learner-state service already exists and is guarded by `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED`. Production currently does not inject that flag into containers, so Konling sees learner-state as disabled and records missing learner-state context. The product direction is that learner-state is a core platform function; it should be enabled in production by contract.

At the same time, learner records may legitimately be absent for new students or for students who have not selected or executed a path. Those states must remain explicit and safe: they reduce personalization confidence but do not prevent content-grounded citation responses.

## Goals / Non-Goals

**Goals:**

- Make production learner-state reads enabled through deployment configuration.
- Keep app and worker runtime environments aligned.
- Ensure no-data learner-state and no-active-path states are explicit.
- Ensure Konling can answer with content citations even when learner evidence is missing.

**Non-Goals:**

- Do not fabricate learner-state, path execution, or evidence rows.
- Do not migrate legacy paths into active control-correction paths in this change.
- Do not implement new retrieval infrastructure.
- Do not change model provider selection.

## Decisions

1. Remove the assumption that production may run with learner-state disabled.
   - The environment flag remains as an implementation switch for local tests and emergency rollback.
   - Production examples and deployment injection must set it to `true`.

2. Keep missing learner data distinct from service disabled.
   - Disabled service is an operational problem.
   - Empty learner data is a valid learner state with limited personalization.

3. Inject the flag into both app and worker containers.
   - The app needs it for live Konling responses and learner-state APIs.
   - The worker may need it for evidence/cache refresh tasks that share runtime assumptions.

4. Do not promote legacy path rows during this change.
   - Existing legacy paths without `goalId=control-correction`, `pathStatus=active`, or execution rows remain non-authoritative for current path-execution citations.

## Risks / Trade-offs

- Enabling learner-state could expose stale or sparse data more often -> tests must assert explicit missing/stale/low-confidence markers.
- Production env drift can recur -> deployment scripts and examples must include the flag and validation should inspect container env.
- Users with no path execution still have no personalized path citation -> Konling must answer with content citations and mark personalization limited.

## Migration Plan

1. Add the learner-state flag to environment examples and Podman injection.
2. Set production `/home/projects/act/.env` to `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true`.
3. Redeploy app and worker containers.
4. Verify container env, `/api/readyz`, learner-state route behavior, and Konling concept explanation with sparse learner data.
