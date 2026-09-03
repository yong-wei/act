# Separate Interactive Raw Events from Teacher Projections

Interactive courses must retain raw events for persistence, audit, and governance, but teacher review must use a server-authorized class scope and a role-minimized projection. A teacher role or request parameters such as `userId`, `sessionId`, and `resourceKey` must not become read authorization. Ordinary interactive-event queries must not return students' original AI questions or raw event payloads. Historical drilldown, when needed, must be a distinct operation with an explicit purpose, actor scope, source revision, and durable receipt.

This preserves structured evidence needed for teaching diagnosis while preventing private student conversations and cross-class raw payloads from being exposed through a normal page or API.
