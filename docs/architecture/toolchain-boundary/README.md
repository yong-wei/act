# Toolchain execution boundary

Source identity is the captured Git revision and tree. The source denominator is
`git ls-files -- <path>` for the declared families; `__pycache__/` and `*.pyc`
are excluded. Generated or untracked inputs are a separate `generated-input`
category and never change the source count.

Public outputs are portable bundle/manifest/database results. Private run
evidence stays off the product compile graph. Product Web/worker code may not
import tool implementations, staging directories, or run-specific evidence.

Independent verification maps to `typecheck:tools` and `typecheck:test`. A tool
failure is a tools/test receipt failure, not a production pass.

New production TypeScript imports of tool implementations fail closed, including
Web `src/` and the worker graph (`scripts/workers/`, assignment scan/gc
entrypoints). Existing path-string callers are frozen in
`tools/boundary/allowed-product-path-reads.json`; any new product path read
fail-closes. A dirty worktree fail-closes before a source receipt is bound.

This change creates no Issue, claim, deployment, data apply, selector mutation,
or production activation.
