# Modular monolith global closure

Command:

```bash
npm run verify:architecture-closure -- --manifest <explicit-manifest.json> --out <receipt-dir>
```

This command is a validation-only aggregator. It reads one explicit input manifest, checks source identity, terminal coverage, denominator closure, metric pairing, privacy, and competing aggregators, then writes one normalized receipt and digest. It does not scan a directory for the "latest" receipt.

Upstream census, charter, fitness, quality, toolchain, QA, and domain commands remain the only authorities for their facts. This command does not recompute graphs, owner catalogs, budgets, test inventories, or business results, and it does not claim, archive, deploy, switch selectors, or write the database.

`qualified` means the declared evidence is current and internally consistent. Receipt production is not production activation and does not complete work outside the declared closure scope.

Dirty or mixed worktrees, source/tree drift, missing/duplicate/stale terminals, incomplete denominators, nested schema-invalid receipts, privacy violations, and competing aggregators fail closed as `unresolved`. A blocked terminal or in-scope compatibility record without deletion proof yields `blocked`. Observational terminals yield `observed`.

The normalized receipt reconstructs every public field from a typed template. It includes a sorted safe `observations` projection so included, excluded, duplicate, and unresolved records remain visible and count in the denominator. Public observation identities must match `{stageId}:{token}` or `{worktreeRole}:{relativePath}:{digest}`; any other value is replaced by an `obs:` digest and prevents qualification. A remaining `duplicate` observation also prevents `qualified`. Totals are numeric and closed (`discovered = included + excluded + duplicate + unresolved`). Invalid nested elements such as `observations: [null]` do not throw; they produce an unresolved receipt. Privacy fallback never copies upstream totals or identities; the published `serialized` bytes are scanned again before return.
