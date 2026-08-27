# Teaching projection publishing CLI

Independent publish / qualify / rebase authority for ACT Teaching Projection.
Product code reads published artifacts through `src/lib/teaching-projection`
stores and contracts; it does not import these modules.

```bash
npm run teaching-projection:check
npm run teaching-projection:qualify -- v022
npm run teaching-projection:rebase -- v018
npm run teaching-projection:publish -- v022
npm run teaching-projection:verify
```

Existing `scripts/knowledge-cutover/*` callers import this package. This CLI
never writes production selectors or activates a candidate.
