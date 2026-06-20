# ACT App Router 页面路由覆盖附录

生成日期：2026-06-20

页面文件总数：205

## 功能区块统计

| 功能区块 | 页面数 |
|---|---:|
| `00-public-auth` | 3 |
| `10-student-cockpit-profile` | 6 |
| `20-interactive-learning` | 23 |
| `21-course-entry` | 29 |
| `22-course-student-runtime` | 29 |
| `23-course-teacher-waiting` | 29 |
| `24-course-teacher-runtime` | 29 |
| `30-simulations` | 9 |
| `40-arena` | 4 |
| `50-ai-assessment-path` | 5 |
| `60-knowledge` | 1 |
| `70-teacher-data` | 20 |
| `80-admin-governance` | 8 |
| `90-review-internal` | 9 |
| `99-other` | 1 |

## 路由明细

| # | 功能区块 | 路由 | 页面文件 |
|---:|---|---|---|
| 1 | `00-public-auth` | `/login` | `src/app/(auth)/login/page.tsx` |
| 2 | `00-public-auth` | `/register` | `src/app/(auth)/register/page.tsx` |
| 3 | `10-student-cockpit-profile` | `/dashboard` | `src/app/(main)/dashboard/page.tsx` |
| 4 | `10-student-cockpit-profile` | `/missions` | `src/app/(main)/missions/page.tsx` |
| 5 | `10-student-cockpit-profile` | `/profile/evidence` | `src/app/(main)/profile/evidence/page.tsx` |
| 6 | `10-student-cockpit-profile` | `/profile/growth` | `src/app/(main)/profile/growth/page.tsx` |
| 7 | `10-student-cockpit-profile` | `/profile` | `src/app/(main)/profile/page.tsx` |
| 8 | `10-student-cockpit-profile` | `/profile/portfolio` | `src/app/(main)/profile/portfolio/page.tsx` |
| 9 | `70-teacher-data` | `/teacher/students/[studentId]/diagnosis` | `src/app/(main)/teacher/students/[studentId]/diagnosis/page.tsx` |
| 10 | `70-teacher-data` | `/teacher/students/[studentId]/evidence` | `src/app/(main)/teacher/students/[studentId]/evidence/page.tsx` |
| 11 | `70-teacher-data` | `/teacher/grading-workbench` | `src/app/(teacher-report-ledger)/teacher/grading-workbench/page.tsx` |
| 12 | `80-admin-governance` | `/admin/config` | `src/app/admin/config/page.tsx` |
| 13 | `80-admin-governance` | `/admin/data-governance` | `src/app/admin/data-governance/page.tsx` |
| 14 | `80-admin-governance` | `/admin/lesson-plans/[id]/edit` | `src/app/admin/lesson-plans/[id]/edit/page.tsx` |
| 15 | `80-admin-governance` | `/admin/lesson-plans/new` | `src/app/admin/lesson-plans/new/page.tsx` |
| 16 | `80-admin-governance` | `/admin/lesson-plans` | `src/app/admin/lesson-plans/page.tsx` |
| 17 | `80-admin-governance` | `/admin` | `src/app/admin/page.tsx` |
| 18 | `80-admin-governance` | `/admin/states` | `src/app/admin/states/page.tsx` |
| 19 | `80-admin-governance` | `/admin/users` | `src/app/admin/users/page.tsx` |
| 20 | `50-ai-assessment-path` | `/ai/copilot` | `src/app/ai/copilot/page.tsx` |
| 21 | `50-ai-assessment-path` | `/ai` | `src/app/ai/page.tsx` |
| 22 | `40-arena` | `/arena/challenges/[taskId]` | `src/app/arena/challenges/[taskId]/page.tsx` |
| 23 | `40-arena` | `/arena` | `src/app/arena/page.tsx` |
| 24 | `50-ai-assessment-path` | `/assessment/adaptive-practice` | `src/app/assessment/adaptive-practice/page.tsx` |
| 25 | `50-ai-assessment-path` | `/assessment/document-feedback` | `src/app/assessment/document-feedback/page.tsx` |
| 26 | `20-interactive-learning` | `/classroom/join` | `src/app/classroom/join/page.tsx` |
| 27 | `20-interactive-learning` | `/classroom/student/[sessionId]` | `src/app/classroom/student/[sessionId]/page.tsx` |
| 28 | `20-interactive-learning` | `/classroom/teacher/[sessionId]` | `src/app/classroom/teacher/[sessionId]/page.tsx` |
| 29 | `20-interactive-learning` | `/classroom/teacher/[sessionId]/review` | `src/app/classroom/teacher/[sessionId]/review/page.tsx` |
| 30 | `70-teacher-data` | `/data-center` | `src/app/data-center/page.tsx` |
| 31 | `99-other` | `/ethics` | `src/app/ethics/page.tsx` |
| 32 | `50-ai-assessment-path` | `/evaluation/prompt-assessment` | `src/app/evaluation/prompt-assessment/page.tsx` |
| 33 | `20-interactive-learning` | `/interactive-learning/argument-principle` | `src/app/interactive-learning/argument-principle/page.tsx` |
| 34 | `20-interactive-learning` | `/interactive-learning/chapter-components/[category]` | `src/app/interactive-learning/chapter-components/[category]/page.tsx` |
| 35 | `20-interactive-learning` | `/interactive-learning/chapter-components` | `src/app/interactive-learning/chapter-components/page.tsx` |
| 36 | `20-interactive-learning` | `/interactive-learning/control-map` | `src/app/interactive-learning/control-map/page.tsx` |
| 37 | `20-interactive-learning` | `/interactive-learning/control-odyssey` | `src/app/interactive-learning/control-odyssey/page.tsx` |
| 38 | `20-interactive-learning` | `/interactive-learning/control-workbench` | `src/app/interactive-learning/control-workbench/page.tsx` |
| 39 | `21-course-entry` | `/interactive-learning/courses/cruise-comfort-boppps` | `src/app/interactive-learning/courses/cruise-comfort-boppps/page.tsx` |
| 40 | `22-course-student-runtime` | `/interactive-learning/courses/cruise-comfort-boppps/student/[sessionId]` | `src/app/interactive-learning/courses/cruise-comfort-boppps/student/[sessionId]/page.tsx` |
| 41 | `24-course-teacher-runtime` | `/interactive-learning/courses/cruise-comfort-boppps/teacher/[sessionId]` | `src/app/interactive-learning/courses/cruise-comfort-boppps/teacher/[sessionId]/page.tsx` |
| 42 | `23-course-teacher-waiting` | `/interactive-learning/courses/cruise-comfort-boppps/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/cruise-comfort-boppps/teacher/[sessionId]/waiting/page.tsx` |
| 43 | `20-interactive-learning` | `/interactive-learning/courses` | `src/app/interactive-learning/courses/page.tsx` |
| 44 | `21-course-entry` | `/interactive-learning/courses/unit-1-1-see-the-full-picture` | `src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/page.tsx` |
| 45 | `22-course-student-runtime` | `/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]` | `src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]/page.tsx` |
| 46 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]/page.tsx` |
| 47 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]/waiting/page.tsx` |
| 48 | `21-course-entry` | `/interactive-learning/courses/unit-1-2-modeling-from-object-to-system` | `src/app/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/page.tsx` |
| 49 | `22-course-student-runtime` | `/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/student/[sessionId]` | `src/app/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/student/[sessionId]/page.tsx` |
| 50 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/teacher/[sessionId]/page.tsx` |
| 51 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/teacher/[sessionId]/waiting/page.tsx` |
| 52 | `21-course-entry` | `/interactive-learning/courses/unit-2-1-modeling-language` | `src/app/interactive-learning/courses/unit-2-1-modeling-language/page.tsx` |
| 53 | `22-course-student-runtime` | `/interactive-learning/courses/unit-2-1-modeling-language/student/[sessionId]` | `src/app/interactive-learning/courses/unit-2-1-modeling-language/student/[sessionId]/page.tsx` |
| 54 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-2-1-modeling-language/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-2-1-modeling-language/teacher/[sessionId]/page.tsx` |
| 55 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-2-1-modeling-language/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-2-1-modeling-language/teacher/[sessionId]/waiting/page.tsx` |
| 56 | `21-course-entry` | `/interactive-learning/courses/unit-2-2-time-domain-response` | `src/app/interactive-learning/courses/unit-2-2-time-domain-response/page.tsx` |
| 57 | `22-course-student-runtime` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/[sessionId]` | `src/app/interactive-learning/courses/unit-2-2-time-domain-response/student/[sessionId]/page.tsx` |
| 58 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-2-2-time-domain-response/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-2-2-time-domain-response/teacher/[sessionId]/page.tsx` |
| 59 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-2-2-time-domain-response/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-2-2-time-domain-response/teacher/[sessionId]/waiting/page.tsx` |
| 60 | `21-course-entry` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro` | `src/app/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/page.tsx` |
| 61 | `22-course-student-runtime` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/[sessionId]` | `src/app/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/[sessionId]/page.tsx` |
| 62 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/teacher/[sessionId]/page.tsx` |
| 63 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/teacher/[sessionId]/waiting/page.tsx` |
| 64 | `21-course-entry` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry` | `src/app/interactive-learning/courses/unit-2-4-nyquist-margin-entry/page.tsx` |
| 65 | `22-course-student-runtime` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/[sessionId]` | `src/app/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/[sessionId]/page.tsx` |
| 66 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-2-4-nyquist-margin-entry/teacher/[sessionId]/page.tsx` |
| 67 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-2-4-nyquist-margin-entry/teacher/[sessionId]/waiting/page.tsx` |
| 68 | `21-course-entry` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics` | `src/app/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/page.tsx` |
| 69 | `22-course-student-runtime` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/[sessionId]` | `src/app/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/[sessionId]/page.tsx` |
| 70 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/teacher/[sessionId]/page.tsx` |
| 71 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/teacher/[sessionId]/waiting/page.tsx` |
| 72 | `21-course-entry` | `/interactive-learning/courses/unit-3-2-routh-stability-boundary` | `src/app/interactive-learning/courses/unit-3-2-routh-stability-boundary/page.tsx` |
| 73 | `22-course-student-runtime` | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/[sessionId]` | `src/app/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/[sessionId]/page.tsx` |
| 74 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-3-2-routh-stability-boundary/teacher/[sessionId]/page.tsx` |
| 75 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-3-2-routh-stability-boundary/teacher/[sessionId]/waiting/page.tsx` |
| 76 | `21-course-entry` | `/interactive-learning/courses/unit-3-3-root-locus-rules` | `src/app/interactive-learning/courses/unit-3-3-root-locus-rules/page.tsx` |
| 77 | `22-course-student-runtime` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/[sessionId]` | `src/app/interactive-learning/courses/unit-3-3-root-locus-rules/student/[sessionId]/page.tsx` |
| 78 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-3-3-root-locus-rules/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-3-3-root-locus-rules/teacher/[sessionId]/page.tsx` |
| 79 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-3-3-root-locus-rules/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-3-3-root-locus-rules/teacher/[sessionId]/waiting/page.tsx` |
| 80 | `21-course-entry` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation` | `src/app/interactive-learning/courses/unit-3-4-root-locus-reading-validation/page.tsx` |
| 81 | `22-course-student-runtime` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/[sessionId]` | `src/app/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/[sessionId]/page.tsx` |
| 82 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-3-4-root-locus-reading-validation/teacher/[sessionId]/page.tsx` |
| 83 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-3-4-root-locus-reading-validation/teacher/[sessionId]/waiting/page.tsx` |
| 84 | `21-course-entry` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement` | `src/app/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/page.tsx` |
| 85 | `22-course-student-runtime` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/[sessionId]` | `src/app/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/[sessionId]/page.tsx` |
| 86 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/teacher/[sessionId]/page.tsx` |
| 87 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/teacher/[sessionId]/waiting/page.tsx` |
| 88 | `21-course-entry` | `/interactive-learning/courses/unit-3-6-zero-design-workshop` | `src/app/interactive-learning/courses/unit-3-6-zero-design-workshop/page.tsx` |
| 89 | `22-course-student-runtime` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/[sessionId]` | `src/app/interactive-learning/courses/unit-3-6-zero-design-workshop/student/[sessionId]/page.tsx` |
| 90 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-3-6-zero-design-workshop/teacher/[sessionId]/page.tsx` |
| 91 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-3-6-zero-design-workshop/teacher/[sessionId]/waiting/page.tsx` |
| 92 | `21-course-entry` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation` | `src/app/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/page.tsx` |
| 93 | `22-course-student-runtime` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/[sessionId]` | `src/app/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/[sessionId]/page.tsx` |
| 94 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/teacher/[sessionId]/page.tsx` |
| 95 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/teacher/[sessionId]/waiting/page.tsx` |
| 96 | `21-course-entry` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment` | `src/app/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/page.tsx` |
| 97 | `22-course-student-runtime` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/[sessionId]` | `src/app/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/[sessionId]/page.tsx` |
| 98 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/teacher/[sessionId]/page.tsx` |
| 99 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/teacher/[sessionId]/waiting/page.tsx` |
| 100 | `21-course-entry` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab` | `src/app/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/page.tsx` |
| 101 | `22-course-student-runtime` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/[sessionId]` | `src/app/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/[sessionId]/page.tsx` |
| 102 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/teacher/[sessionId]/page.tsx` |
| 103 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/teacher/[sessionId]/waiting/page.tsx` |
| 104 | `21-course-entry` | `/interactive-learning/courses/unit-4-1-design-task-expression` | `src/app/interactive-learning/courses/unit-4-1-design-task-expression/page.tsx` |
| 105 | `22-course-student-runtime` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/[sessionId]` | `src/app/interactive-learning/courses/unit-4-1-design-task-expression/student/[sessionId]/page.tsx` |
| 106 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]/page.tsx` |
| 107 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]/waiting/page.tsx` |
| 108 | `21-course-entry` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start` | `src/app/interactive-learning/courses/unit-4-2-controller-selection-first-start/page.tsx` |
| 109 | `22-course-student-runtime` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/[sessionId]` | `src/app/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/[sessionId]/page.tsx` |
| 110 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-4-2-controller-selection-first-start/teacher/[sessionId]/page.tsx` |
| 111 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-4-2-controller-selection-first-start/teacher/[sessionId]/waiting/page.tsx` |
| 112 | `21-course-entry` | `/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation` | `src/app/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/page.tsx` |
| 113 | `22-course-student-runtime` | `/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/[sessionId]` | `src/app/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/[sessionId]/page.tsx` |
| 114 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/teacher/[sessionId]/page.tsx` |
| 115 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/teacher/[sessionId]/waiting/page.tsx` |
| 116 | `21-course-entry` | `/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling` | `src/app/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/page.tsx` |
| 117 | `22-course-student-runtime` | `/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/[sessionId]` | `src/app/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/[sessionId]/page.tsx` |
| 118 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/teacher/[sessionId]/page.tsx` |
| 119 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/teacher/[sessionId]/waiting/page.tsx` |
| 120 | `21-course-entry` | `/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization` | `src/app/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/page.tsx` |
| 121 | `22-course-student-runtime` | `/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/[sessionId]` | `src/app/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/[sessionId]/page.tsx` |
| 122 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/teacher/[sessionId]/page.tsx` |
| 123 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/teacher/[sessionId]/waiting/page.tsx` |
| 124 | `21-course-entry` | `/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding` | `src/app/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/page.tsx` |
| 125 | `22-course-student-runtime` | `/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/[sessionId]` | `src/app/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/[sessionId]/page.tsx` |
| 126 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/teacher/[sessionId]/page.tsx` |
| 127 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/teacher/[sessionId]/waiting/page.tsx` |
| 128 | `21-course-entry` | `/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure` | `src/app/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/page.tsx` |
| 129 | `22-course-student-runtime` | `/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/student/[sessionId]` | `src/app/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/student/[sessionId]/page.tsx` |
| 130 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/teacher/[sessionId]/page.tsx` |
| 131 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/teacher/[sessionId]/waiting/page.tsx` |
| 132 | `21-course-entry` | `/interactive-learning/courses/unit-5-1-linear-backbone-boundaries` | `src/app/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/page.tsx` |
| 133 | `22-course-student-runtime` | `/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/student/[sessionId]` | `src/app/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/student/[sessionId]/page.tsx` |
| 134 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/teacher/[sessionId]/page.tsx` |
| 135 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/teacher/[sessionId]/waiting/page.tsx` |
| 136 | `21-course-entry` | `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry` | `src/app/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/page.tsx` |
| 137 | `22-course-student-runtime` | `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/[sessionId]` | `src/app/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/[sessionId]/page.tsx` |
| 138 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/teacher/[sessionId]/page.tsx` |
| 139 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/teacher/[sessionId]/waiting/page.tsx` |
| 140 | `21-course-entry` | `/interactive-learning/courses/unit-5-3-mass-coordination-chain` | `src/app/interactive-learning/courses/unit-5-3-mass-coordination-chain/page.tsx` |
| 141 | `22-course-student-runtime` | `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/[sessionId]` | `src/app/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/[sessionId]/page.tsx` |
| 142 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-5-3-mass-coordination-chain/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-5-3-mass-coordination-chain/teacher/[sessionId]/page.tsx` |
| 143 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-5-3-mass-coordination-chain/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-5-3-mass-coordination-chain/teacher/[sessionId]/waiting/page.tsx` |
| 144 | `21-course-entry` | `/interactive-learning/courses/unit-5-4-data-driven-mpc-transition` | `src/app/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/page.tsx` |
| 145 | `22-course-student-runtime` | `/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/student/[sessionId]` | `src/app/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/student/[sessionId]/page.tsx` |
| 146 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/teacher/[sessionId]/page.tsx` |
| 147 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/teacher/[sessionId]/waiting/page.tsx` |
| 148 | `21-course-entry` | `/interactive-learning/courses/unit-5-5-policy-learning-entry-risk` | `src/app/interactive-learning/courses/unit-5-5-policy-learning-entry-risk/page.tsx` |
| 149 | `22-course-student-runtime` | `/interactive-learning/courses/unit-5-5-policy-learning-entry-risk/student/[sessionId]` | `src/app/interactive-learning/courses/unit-5-5-policy-learning-entry-risk/student/[sessionId]/page.tsx` |
| 150 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-5-5-policy-learning-entry-risk/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-5-5-policy-learning-entry-risk/teacher/[sessionId]/page.tsx` |
| 151 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-5-5-policy-learning-entry-risk/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-5-5-policy-learning-entry-risk/teacher/[sessionId]/waiting/page.tsx` |
| 152 | `21-course-entry` | `/interactive-learning/courses/unit-5-6-method-comparison-cold-chain` | `src/app/interactive-learning/courses/unit-5-6-method-comparison-cold-chain/page.tsx` |
| 153 | `22-course-student-runtime` | `/interactive-learning/courses/unit-5-6-method-comparison-cold-chain/student/[sessionId]` | `src/app/interactive-learning/courses/unit-5-6-method-comparison-cold-chain/student/[sessionId]/page.tsx` |
| 154 | `24-course-teacher-runtime` | `/interactive-learning/courses/unit-5-6-method-comparison-cold-chain/teacher/[sessionId]` | `src/app/interactive-learning/courses/unit-5-6-method-comparison-cold-chain/teacher/[sessionId]/page.tsx` |
| 155 | `23-course-teacher-waiting` | `/interactive-learning/courses/unit-5-6-method-comparison-cold-chain/teacher/[sessionId]/waiting` | `src/app/interactive-learning/courses/unit-5-6-method-comparison-cold-chain/teacher/[sessionId]/waiting/page.tsx` |
| 156 | `20-interactive-learning` | `/interactive-learning/cross-domain-exploration` | `src/app/interactive-learning/cross-domain-exploration/page.tsx` |
| 157 | `20-interactive-learning` | `/interactive-learning/lessons/[lessonId]/handout-print` | `src/app/interactive-learning/lessons/[lessonId]/handout-print/page.tsx` |
| 158 | `20-interactive-learning` | `/interactive-learning/multi-representation-linkage` | `src/app/interactive-learning/multi-representation-linkage/page.tsx` |
| 159 | `20-interactive-learning` | `/interactive-learning` | `src/app/interactive-learning/page.tsx` |
| 160 | `20-interactive-learning` | `/interactive-learning/physics-modeling` | `src/app/interactive-learning/physics-modeling/page.tsx` |
| 161 | `20-interactive-learning` | `/interactive-learning/pid-simulator` | `src/app/interactive-learning/pid-simulator/page.tsx` |
| 162 | `20-interactive-learning` | `/interactive-learning/resources/[id]` | `src/app/interactive-learning/resources/[id]/page.tsx` |
| 163 | `20-interactive-learning` | `/interactive-learning/resources/control-odyssey-v1/ship` | `src/app/interactive-learning/resources/control-odyssey-v1/ship/page.tsx` |
| 164 | `20-interactive-learning` | `/interactive-learning/ten-drops` | `src/app/interactive-learning/ten-drops/page.tsx` |
| 165 | `60-knowledge` | `/knowledge` | `src/app/knowledge/page.tsx` |
| 166 | `00-public-auth` | `/` | `src/app/page.tsx` |
| 167 | `20-interactive-learning` | `/playlists/[id]/play` | `src/app/playlists/[id]/play/page.tsx` |
| 168 | `20-interactive-learning` | `/playlists/new` | `src/app/playlists/new/page.tsx` |
| 169 | `20-interactive-learning` | `/playlists` | `src/app/playlists/page.tsx` |
| 170 | `90-review-internal` | `/review/adaptive-assessment-figures` | `src/app/review/adaptive-assessment-figures/page.tsx` |
| 171 | `90-review-internal` | `/review/annotated-media-activity-564` | `src/app/review/annotated-media-activity-564/page.tsx` |
| 172 | `90-review-internal` | `/review/control-workbench-reuse-560` | `src/app/review/control-workbench-reuse-560/page.tsx` |
| 173 | `90-review-internal` | `/review/derivation-stage-runtime-562` | `src/app/review/derivation-stage-runtime-562/page.tsx` |
| 174 | `90-review-internal` | `/review/extracurricular-showcase` | `src/app/review/extracurricular-showcase/page.tsx` |
| 175 | `90-review-internal` | `/review` | `src/app/review/page.tsx` |
| 176 | `90-review-internal` | `/review/structure-diagram-runtime-563` | `src/app/review/structure-diagram-runtime-563/page.tsx` |
| 177 | `90-review-internal` | `/review/unit-5-2-arrow-markers` | `src/app/review/unit-5-2-arrow-markers/page.tsx` |
| 178 | `90-review-internal` | `/review/visual-stage-runtime-561` | `src/app/review/visual-stage-runtime-561/page.tsx` |
| 179 | `30-simulations` | `/simulations/container` | `src/app/simulations/container/page.tsx` |
| 180 | `30-simulations` | `/simulations/cruise` | `src/app/simulations/cruise/page.tsx` |
| 181 | `30-simulations` | `/simulations/destroyer` | `src/app/simulations/destroyer/page.tsx` |
| 182 | `30-simulations` | `/simulations/dredger` | `src/app/simulations/dredger/page.tsx` |
| 183 | `30-simulations` | `/simulations/drilling` | `src/app/simulations/drilling/page.tsx` |
| 184 | `30-simulations` | `/simulations/icebreaker` | `src/app/simulations/icebreaker/page.tsx` |
| 185 | `30-simulations` | `/simulations/lng` | `src/app/simulations/lng/page.tsx` |
| 186 | `30-simulations` | `/simulations` | `src/app/simulations/page.tsx` |
| 187 | `40-arena` | `/teacher/arena` | `src/app/teacher/arena/page.tsx` |
| 188 | `40-arena` | `/teacher/arena/publications/[publicationId]` | `src/app/teacher/arena/publications/[publicationId]/page.tsx` |
| 189 | `70-teacher-data` | `/teacher/classes/[classId]/analytics` | `src/app/teacher/classes/[classId]/analytics/page.tsx` |
| 190 | `70-teacher-data` | `/teacher/classes/[classId]/analytics-v2` | `src/app/teacher/classes/[classId]/analytics-v2/page.tsx` |
| 191 | `70-teacher-data` | `/teacher/classes/[classId]` | `src/app/teacher/classes/[classId]/page.tsx` |
| 192 | `70-teacher-data` | `/teacher/classes/[classId]/students/[studentId]/evidence` | `src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx` |
| 193 | `70-teacher-data` | `/teacher/classes/[classId]/students/[studentId]` | `src/app/teacher/classes/[classId]/students/[studentId]/page.tsx` |
| 194 | `70-teacher-data` | `/teacher/classes/new` | `src/app/teacher/classes/new/page.tsx` |
| 195 | `70-teacher-data` | `/teacher/classes` | `src/app/teacher/classes/page.tsx` |
| 196 | `70-teacher-data` | `/teacher/history` | `src/app/teacher/history/page.tsx` |
| 197 | `70-teacher-data` | `/teacher/lesson-plans/[id]/edit` | `src/app/teacher/lesson-plans/[id]/edit/page.tsx` |
| 198 | `70-teacher-data` | `/teacher/lesson-plans/new` | `src/app/teacher/lesson-plans/new/page.tsx` |
| 199 | `70-teacher-data` | `/teacher/lesson-plans` | `src/app/teacher/lesson-plans/page.tsx` |
| 200 | `70-teacher-data` | `/teacher` | `src/app/teacher/page.tsx` |
| 201 | `70-teacher-data` | `/teacher/prep-packs` | `src/app/teacher/prep-packs/page.tsx` |
| 202 | `70-teacher-data` | `/teacher/preset-lessons` | `src/app/teacher/preset-lessons/page.tsx` |
| 203 | `70-teacher-data` | `/teacher/resources` | `src/app/teacher/resources/page.tsx` |
| 204 | `70-teacher-data` | `/teacher/resources/resource-nodes` | `src/app/teacher/resources/resource-nodes/page.tsx` |
| 205 | `30-simulations` | `/virtual-lab` | `src/app/virtual-lab/page.tsx` |
