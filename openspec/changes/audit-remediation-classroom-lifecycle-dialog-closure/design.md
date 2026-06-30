## Context

归档整改已经证明课堂身份和基础状态可用，但剩余问题集中在生命周期分叉处：已有进行中课堂、临时课堂复用、真实课堂加入、结束课堂、删除已结束课堂、投影直达恢复和 demo runtime 行为。native confirm 还会让状态和证据不可测。

## Approach

课堂生命周期应显式表达：

- launch context: class-bound, temporary, demo, or imported lesson plan.
- active conflict: reuse existing, create new, or cancel.
- join result: valid, malformed, expired, full/closed, unauthorized, or not found.
- finalization: ending, ended, already ended, failed, and student-visible closed state.
- destructive action: impact preview, confirmation, ledger/evidence, recovery.

复用已有 status/dialog primitives；不把所有互动课教师页逐个发明不同确认文案。

## Boundaries

- 不重写所有互动课 runtime，只统一生命周期入口和共享确认/状态合同。
- 不改变课程内容运行态本身。
- 不关闭教师报告、Arena 写回、管理员治理或作者态问题。

## Validation Strategy

- Run `openspec validate audit-remediation-classroom-lifecycle-dialog-closure --strict`.
- Add tests for active-session conflict, join error taxonomy, end/delete confirmation, ended direct access, projection recovery, and keyboard/focus behavior.
- Capture representative UI/DOM evidence for class-bound and temporary sessions.
