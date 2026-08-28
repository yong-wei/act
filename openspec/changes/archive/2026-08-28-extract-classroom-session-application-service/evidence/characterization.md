# Characterization fingerprints

Captured against the live change branch after extraction. Behavioral authority remains the existing Classroom/session specs.

## Access

| Actor | Class-bound session | Classless session |
| --- | --- | --- |
| Owning teacher / admin | manage, read, stream, end allowed | same |
| Other teacher | manage denied | manage denied |
| Same-class student | read/join/stream allowed; manage/end denied | read/join/stream allowed |
| Other-class student | denied | classless compatibility still allows access |
| Unauthenticated | 401 at HTTP adapter | 401 at HTTP adapter |

## HTTP compatibility

| Operation | Success | Characteristic errors |
| --- | --- | --- |
| POST `/api/session` | session + `classroomIdentity` | 403 non-teacher; 409 duplicate with `reuse`/`new-session`; 200 reuse payload |
| GET `/api/session/join` | session + joinState + hrefs | 400 invalid code; 404 missing; 410 finished + `/profile/evidence`; 403 wrong class |
| GET `/api/session/[id]` | session + planTitle + identity | 403/404; 409 generated-courseware recovery |
| PATCH `/api/session/[id]` | updated session | 403; 400 invalid stage/status; FINISHED triggers finalization |
| PATCH join-code | `{ joinCode }` | 409 when not ACTIVE |
| GET stream | SSE `text/event-stream` | 401/403/404/429 text bodies |
| GET/POST state | previous JSON shapes | teacher-view student 403; student-view strips teacher identity |

## Stream

- Redis path when ready; otherwise 2s poll fallback.
- Heartbeat comment frame every 15s.
- Abort/cancel clears heartbeat and subscriber or poll timer.

## Finalization

FINISHED still enqueues event ingestion, evidence-feature cache refresh, and summary-report refresh, then best-effort report generation. Direct `enqueueSessionFinalizationSnapshots` remains absent.
