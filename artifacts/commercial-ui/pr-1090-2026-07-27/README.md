# PR #1090 Commercial UI Evidence

Captured from the PR worktree with `PLAYWRIGHT_PORT=3200` and the governed adaptive-path Playwright fixture.

## Representative routes

| Surface | Representative route | Desktop | 320px |
| --- | --- | --- | --- |
| Adaptive path center | `/assessment/adaptive-practice?demo=1&source=adaptive-path-center&intent=path-execution...` | `adaptive-path-center-desktop-1440.png` | `adaptive-path-center-mobile-320.png` |
| Interactive resource | `/interactive-learning/resources/lesson15-series-precheck?source=adaptive-path-center...` | `interactive-resource-desktop-1440.png` | `interactive-resource-mobile-320.png` |
| Interactive course runtime | `/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?source=adaptive-path-center...` | `interactive-course-runtime-desktop-1440.png` | `interactive-course-runtime-mobile-320.png` |
| Arena challenge | `/arena/challenges/task-second-order-lead-pid?journeyFixture=1&source=adaptive-path-center...` | `arena-challenge-desktop-1440.png` | `arena-challenge-mobile-320.png` |
| Control Workbench | `/interactive-learning/control-workbench?source=adaptive-path-center...` | `control-workbench-desktop-1440.png` | `control-workbench-mobile-320.png` |
| Knowledge | `/knowledge?source=adaptive-path-center...` | `knowledge-desktop-1440.png` | `knowledge-mobile-320.png` |

The ready-state continuation is shown separately in `control-workbench-ready-next-desktop-1440.png` and `control-workbench-ready-next-mobile-320.png`.

## Assertions

- Every representative path-context page exposes exactly one link named `返回学习路径`.
- Every desktop and 320px capture passes the document-level horizontal-overflow assertion.
- The Arena-to-Workbench flow preserves path context through official submission.
- After accepted completion, `复盘 Arena 评测证据` remains visible and navigates to the next knowledge node.
- The changed controls use existing platform colors, motion, shell, status, and module primitives; no new visual primitive or migration exception is introduced.
