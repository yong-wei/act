## Why

SAR affects trust, privacy, and explanation quality. It needs diagnostics and evaluation evidence for administrators, developers, and competition demonstration. A traceable report also helps compare SAR-assisted retrieval with ordinary Source Pack retrieval without turning internal trace into student-facing noise.

## What Changes

- Add SAR diagnostics metrics and trace serialization.
- Add an administrator-facing data governance report or API for SAR index/query health.
- Add demo fixtures for multi-hop control-correction explanation.
- Add evaluation metrics such as event/entity counts, verified citation rate, privacy rejection count, hop count, and SAR candidate adoption count.

## Impact

- Extends `structured-associative-retrieval`.
- Extends `admin-data-governance-dashboard`.
- Depends on SAR expansion and at least one consumer integration.
