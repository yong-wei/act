## Context

The audit confirms that class analytics and control-correction report API data exist. The problem is productization: export does not download, send can jump to `/`, grading methods expose 405/404 semantics, and long mobile reports have no fixed teacher action area.

## Goals / Non-Goals

**Goals:**
- Turn report data into a teacher delivery object.
- Make grading approval and writeback a real workflow.
- Preserve teacher context across report, student evidence, and grading pages.

**Non-Goals:**
- Do not redesign every analytics chart.
- Do not solve administrator governance in this change.

## Decisions

- Report delivery should have a versioned artifact identity so export/send/lock actions operate on one report.
- Grading method boundaries must be shown as teacher-readable states when APIs are not callable from the current context.
- Mobile report pages need fixed actions because audited pages reach 14,000-30,000px height.

## Risks / Trade-offs

- Report versioning may surface stale reports. Mitigation: show freshness and regenerate options.
- Writeback can affect student-visible records. Mitigation: require explicit approve/writeback and audit trail.
