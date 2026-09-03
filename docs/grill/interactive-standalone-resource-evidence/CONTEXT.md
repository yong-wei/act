# Interactive Standalone Resource Evidence

This context defines the learning and evidence language for interactive resources opened outside a classroom session.

## Resource Launches

**Standalone interactive resource**:
An interactive learning resource opened directly from the interactive-learning resource surface without an active classroom session. It remains a learner activity and must retain its own learning context.
_Avoid_: demo resource, classroom resource

**Classroom interactive resource**:
An interactive resource rendered inside an active classroom session, where the classroom session and lesson step provide the authoritative learning context.
_Avoid_: embedded resource when the term is meant to describe the learning context

## Evidence

**Standalone learning event**:
A server-persisted event produced by a standalone interactive resource, with no classroom session identity and with provenance identifying the resource surface. It is evidence of participation or completion according to the event's governance policy, not automatic proof of mastery.
_Avoid_: anonymous event, classroom event

**Learning-context provenance**:
The explicit classification that identifies whether an event belongs to a classroom, classroom review, pre/post-class resource, or standalone resource activity.
_Avoid_: UI embedding state, page mode
