# Frozen denominator

Capture tree: `45086cc56` (`integration` after #1574 squash).  
Pilot receipt: `openspec/changes/archive/2026-08-29-migrate-one-manifest-course-to-shared-classroom-shell/`.

This inventory is filesystem + identity-registry + import scan. It is not the approximate “32 / ~96” observation; it is the exact list used by the first batch.

## Pilot

Qualified: canonical `1-2` / `unit-1-2-modeling-from-object-to-system`.  
Private header authority deleted. App Router files still exist as identity wrappers and are in this denominator.

## Runtime-first families (32)

Each family has four App Router surfaces: entry, student, teacher, waiting. Total **128** private route files.

| routeSegment | canonicalId | feature dir | student policy | teacher policy | waiting auth |
| --- | --- | --- | --- | --- | --- |
| cruise-comfort-boppps | cruise-comfort-boppps | cruise-comfort-standard-course | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-1-1-see-the-full-picture | 1-1 | unit-1-1-see-the-full-picture | layered graph + demoStep | login list | none |
| unit-1-2-modeling-from-object-to-system | 1-2 | unit-1-2-modeling-from-object-to-system | simple | login list | login list |
| unit-1-3-parameter-pole-migration | 1-3 | unit-1-3-parameter-pole-migration | simple | login list | login list |
| unit-1-4-time-frequency-views | 1-4 | unit-1-4-time-frequency-views | simple | login list | login list |
| unit-1-5-three-domain-gain-sweep | 1-5 | unit-1-5-three-domain-gain-sweep | simple | login list | login list |
| unit-2-1-modeling-language | 2-1 | unit-2-1-modeling-language | demoStep | login list | none |
| unit-2-2-time-domain-response | 2-2 | unit-2-2-time-response | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-2-3-frequency-response-bode-intro | 2-3 | unit-2-3-frequency-response | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-2-4-nyquist-margin-entry | 2-4 | unit-2-4-nyquist-margin-entry | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-3-1-pure-pole-stability-and-dynamics | 3-1 | unit-3-1-pure-pole-stability-and-dynamics | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-3-2-routh-stability-boundary | 3-2 | unit-3-2-routh-stability-boundary | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-3-3-root-locus-rules | 3-3 | unit-3-3-root-locus-rules | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-3-4-root-locus-reading-validation | 3-4 | unit-3-4-root-locus-reading-validation | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-3-5-zero-dynamic-improvement | 3-5 | unit-3-5-zero-dynamic-improvement | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-3-6-zero-design-workshop | 3-6 | unit-3-6-zero-design-workshop | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-3-7-steady-error-low-frequency-compensation | 3-7 | unit-3-7-steady-error-low-frequency-compensation | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-3-8-frequency-domain-translation-judgment | 3-8 | unit-3-8-frequency-domain-translation-judgment | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-3-9-cross-domain-mapping-lab | 3-9 | unit-3-9-cross-domain-mapping-lab | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-4-1-design-task-expression | 4-1 | unit-4-1-design-task-expression | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-4-2-controller-selection-first-start | 4-2 | unit-4-2-controller-selection-first-start | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-4-3-initial-scheme-practice-first-validation | 4-3 | unit-4-3-initial-scheme-practice-first-validation | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-4-4-fixed-structure-optimization-modeling | 4-4 | unit-4-4-fixed-structure-optimization-modeling | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-4-5-constraint-aware-parameter-optimization | 4-5 | unit-4-5-constraint-aware-parameter-optimization | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-4-6-fixed-structure-boundary-structural-encoding | 4-6 | unit-4-6-fixed-structure-boundary-structural-encoding | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-4-7-destroyer-hifi-design-closure | 4-7 | unit-4-7-destroyer-hifi-design-closure | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-5-1-linear-backbone-boundaries | 5-1 | unit-5-1-linear-backbone-boundaries | role+demo guard | unauth→entry, non-teacher→student | none |
| unit-5-2-nonlinear-analysis-entry | 5-2 | unit-5-2-nonlinear-analysis-entry | simple | none | none |
| unit-5-3-mass-coordination-chain | 5-3 | unit-5-3-mass-coordination-chain | simple | none | none |
| unit-5-4-data-driven-mpc-transition | 5-4 | unit-5-4-data-driven-mpc-transition | simple | none | none |
| unit-5-5-policy-learning-entry-risk | 5-5 | unit-5-5-policy-learning-entry-risk | simple | none | none |
| unit-5-6-method-comparison-cold-chain | 5-6 | unit-5-6-method-comparison-cold-chain | simple | none | none |

Canonical ingress aliases (`routeSegments` in `interactive-lesson-identity.ts`) stay classified as bounded ingress, not as private bridges, until a family is deleted. They must still resolve to one canonical id.

## Generic classroom shell (not a private course bridge)

- `/classroom/student/[sessionId]`
- `/classroom/teacher/[sessionId]`
- `/classroom/teacher/[sessionId]/review`
- `/classroom/join`

Bound interactive sessions are sent to `/interactive-learning/courses/<routeSegment>/...` by `buildSessionParticipantHref`. Plan-title fallback remains C2 compatibility for unbound sessions only.

## Uppercase renderer consumers

Path: `src/features/lesson-engine/ResourceRenderer.tsx` (legacy `LessonStep` / `@/types/schema` API).

| Consumer | Class |
| --- | --- |
| `src/features/lesson-engine/LessonPlayer.tsx` | import |
| `src/features/lesson-engine/index.ts` | barrel export |

No App Router, test, or generated-courseware file imports this path. Lowercase `resource-renderer.tsx` is the mainline (`student-player`, `teacher-player`, `orchestrator-builder`, resources page).

## Direct `/api/session` producers

Course App Router pages do not call `/api/session`. Session create/join stays in classroom application-service routes. This change must not add a private producer.

## Replacement for private App Router trees

Shared dispatcher at:

- `/interactive-learning/courses/[routeSegment]`
- `/interactive-learning/courses/[routeSegment]/student/[sessionId]`
- `/interactive-learning/courses/[routeSegment]/teacher/[sessionId]`
- `/interactive-learning/courses/[routeSegment]/teacher/[sessionId]/waiting`

Same public URLs. No `redirect()` from a deleted static folder. Unknown `routeSegment` uses repository `notFound()`.
