## Why

`tsc --noEmit` reports 13 errors across ResourceNode, media manifest, source-pack, and RAG citation tests plus one ResourceNode source file. These errors share a root cause: recent resource/media/citation contracts became stricter, while tests still use old segment, source kind, and citation shapes.

## What Changes

- Align media manifest fixtures with current segment mutability, graph-node refs, scene availability, and required ids.
- Align Source Pack and RAG citation fixtures with required citation/source fields.
- Fix the production ResourceNode type mismatch if the current projection metadata no longer satisfies the projection input contract.

## Impact

- Targets 13 current TypeScript errors in 5 files.
- Preserves ResourceNode, section/chunk, and citation authority boundaries.
