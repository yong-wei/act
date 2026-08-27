# Handoff

This change isolates content, knowledge, and runtime publication behind
`tools/content-knowledge-runtime-release`. Inventory and sample receipts bind
the captured Git revision/tree. Apply-gated package scripts route through the
CLI and never execute writers.

`coordinate-latest-authority-and-active-oss-cutover` remains the owner of
coordinated candidate transactions and selectors. Commercial UI capture remains
owned by `stabilize-commercial-ui-qa-capture-contract`.

No production selector, database mutation, or deployment was performed.
