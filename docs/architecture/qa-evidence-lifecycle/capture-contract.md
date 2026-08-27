# Preserved commercial capture contract

This change consumes `stabilize-commercial-ui-qa-capture-contract` and does not
change its explicit service URL, development revision probe, Dock readiness,
temporary staging, transactional publication, or route/theme/viewport/role
gate matrix.

Capture still publishes a portable manifest. Run-specific screenshots are
externalized; missing, stale, or hash-mismatched output fail-closes. Product
selectors and UI state semantics are unchanged.
