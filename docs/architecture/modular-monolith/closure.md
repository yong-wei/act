# Modular monolith global closure

Command:

```bash
npm run verify:architecture-closure -- --manifest <explicit-manifest.json> --out <receipt-dir>
```

This command is a validation-only aggregator. It reads one explicit input manifest, checks source identity, terminal coverage, denominator closure, metric pairing, privacy, and competing aggregators, then writes one normalized receipt and digest. It does not scan a directory for the "latest" receipt.

Upstream census, charter, fitness, quality, toolchain, QA, and domain commands remain the only authorities for their facts. This command does not recompute graphs, owner catalogs, budgets, test inventories, or business results, and it does not claim, archive, deploy, switch selectors, or write the database.

`qualified` means the declared evidence is current and internally consistent. Receipt production is not production activation and does not complete work outside the declared closure scope.

Dirty or mixed worktrees, source/tree drift, missing/duplicate/stale terminals, incomplete denominators, privacy violations, and competing aggregators fail closed as `unresolved`. A blocked terminal or in-scope compatibility record without deletion proof yields `blocked`. Observational terminals yield `observed`.
