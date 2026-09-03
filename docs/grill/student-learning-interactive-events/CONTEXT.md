# Interactive Learning Events and Teacher Review

This context defines the boundary between interactive-course events, teacher-visible learning evidence, and students' private conversations. It supports authorized review of learning progress without turning raw telemetry into a general-purpose teacher export.

## Events and Evidence

**Interactive learning event**: A durable record of a student's operation, answer, progress change, or AI question in an interactive lesson or classroom resource. It is a process record, not a competence conclusion.

**Governed learning evidence**: A learning fact or projection that has passed identity, source, quality, scope, and purpose checks and may be used by learning-record or companion features.

**Teacher review projection**: A role-minimized summary for classes the current teacher actually owns, used for teaching diagnosis and follow-up guidance.

## Scope and Privacy

**Teacher class scope**: The set of students and class sessions derived by the server from the teacher's class ownership. A role alone does not grant cross-class access.

**Private AI question**: The student's question text and complete event payload submitted to interactive-course AI. It belongs to the student's private learning process, not to an ordinary teacher diagnostic response.

**Explicit historical operation**: An audit, debug, migration, or drilldown read with a declared purpose, actor scope, source revision, and traceable receipt.
