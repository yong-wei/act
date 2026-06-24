## Overview

Citation resolution should be deterministic and server-owned. Generated answers may refer to verified chunk ids or citation refs, but the server resolves them to display hrefs and limitations.

## Address Kinds

- Markdown block or heading anchor.
- Document page and block id.
- Image asset and optional region.
- Video or audio timestamp or time range.
- Interactive lesson step or module.
- Simulation or Arena summary.
- External URL governed by safe-link policy.

## Verification

The resolver must check source existence, content hash or freshness where available, role visibility, scope, and address kind compatibility. If resolution fails, the citation is rejected, redacted, or downgraded.

## Risks

- Letting models emit raw URLs would make citations brittle and unsafe.
- Adding address kinds without viewers would create unopenable citation chips.
