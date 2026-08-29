# Characterization — batch 1

Capture: `45086cc56` denominator, then this revision deletes the private App Router trees.

## Canonical URLs (unchanged)

| URL | After |
| --- | --- |
| `/interactive-learning/courses/<routeSegment>` | Shared dispatcher → family `entry` adapter |
| `/interactive-learning/courses/<routeSegment>/student/<sessionId>` | Shared dispatcher → family `student` adapter |
| `/interactive-learning/courses/<routeSegment>/teacher/<sessionId>` | Shared dispatcher → family `teacher` adapter |
| `/interactive-learning/courses/<routeSegment>/teacher/<sessionId>/waiting` | Shared dispatcher → family `waiting` adapter |
| `/interactive-learning/courses/unit-1-5-three-domain-gain-sweep/demo` | Shared dispatcher → 1-5 `demo` adapter |
| `/interactive-learning/courses` | Catalog page, unchanged |

Student/teacher/waiting adapters keep the previous per-family auth, demo-step, layered-graph, and login-list behavior. Title changes still cannot pick a private folder; identity stays on `interactive-lesson-identity` + bundle binding.

## Retired / unknown

| URL | After |
| --- | --- |
| Unknown `routeSegment` | `notFound()` |
| `/interactive-learning/courses/<routeSegment>/demo` except 1-5 | `notFound()` |
| Deleted static family folders | No files; the dynamic segment still matches, then `notFound()` if unregistered |
| Old retired slugs such as `unit-1-1-laplace-transfer-function` | `notFound()`, no redirect to another lesson |

## Renderer

Uppercase `ResourceRenderer.tsx` had two in-repo consumers (`LessonPlayer.tsx` import, barrel export). Both are deleted. Lowercase `resource-renderer.tsx` remains the mainline.
