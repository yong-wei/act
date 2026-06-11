## 1. Student Diagnosis Surface

- [ ] 1.1 Add student diagnosis data loader from role-based diagnosis and report snapshots.
- [ ] 1.2 Implement diagnosis radar or dimension summary panel with score, confidence, percentile, and growth state.
- [ ] 1.3 Implement dimension insight cards with evidence refs, limitations, and next-action links.
- [ ] 1.4 Implement role-filtered evidence drawer and path option entry points.

## 2. Teacher Diagnosis Surfaces

- [ ] 2.1 Add teacher class diagnosis loader with cohort distributions, weak-point clusters, evidence coverage, and prep-pack eligibility.
- [ ] 2.2 Add teacher-student drilldown with dimension details, root causes, path execution state, grading evidence, and intervention resources.
- [ ] 2.3 Ensure teacher pages preserve class-scope authorization and do not expose private Konling memory or raw answer bodies.
- [ ] 2.4 Add prep-pack entry panel that remains disabled when required diagnosis evidence is missing.

## 3. Navigation and Status

- [ ] 3.1 Integrate diagnosis surfaces into existing learner center and teacher workspaces.
- [ ] 3.2 Use shared status/evidence UI for source coverage, confidence, freshness, and limitations.
- [ ] 3.3 Add empty and degraded states for missing snapshot, cold start, stale evidence, and insufficient cohort size.

## 4. Verification

- [ ] 4.1 Add role-specific rendering tests.
- [ ] 4.2 Add authorization and privacy redaction tests.
- [ ] 4.3 Run `rtk openspec validate learner-teacher-diagnosis-surfaces --strict`.
