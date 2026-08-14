## Context

The five current production knowledge pointers are bound to v0.9: Authority,
Teaching Projection, prerequisite publication, Authority domain-shard set, and
shared consumer activation.
The v0.18 engineering release is authoritative, but ACT owns course-resource
bindings, textbook locators, prerequisites, learning paths, and other teaching
semantics. Those records must be rebased without name-based inference.

## Goals / Non-Goals

**Goals:**

- Freeze the complete active ACT teaching-reference denominator at one revision.
- Resolve every existing reference to v0.18 by stable identity or reviewed mapping.
- Build complete inactive Projection and prerequisite publications for v0.18.

**Non-Goals:**

- Requiring teaching relations for every new v0.18 node.
- Re-reviewing ActKG engineering semantics or historical CourseCoverage DEFER rows.
- Activating any candidate pointer.

## Decisions

### 1. Capture the denominator before mapping

The input manifest enumerates every active course/package/resource binding,
card and infographic association, textbook locator, prerequisite, path, Konling,
RAG, and other teaching reference with source hashes. Later working-tree or
database drift invalidates the run.

### 2. Resolve only by identity evidence

Unchanged IDs carry forward directly. Changed IDs require an explicit mapping
record bound to the v0.9 predecessor, v0.18 successor set, mapping disposition,
review evidence, and capture revision. Labels, aliases, lexical similarity,
embeddings, and graph proximity may be reviewer context but cannot decide a mapping.

### 3. Distinguish existing-reference closure from new-node coverage

All captured existing references must resolve or become `REVIEW_REQUIRED`.
New v0.18 entities without ACT teaching semantics do not block the rebase.
Later reviewed teaching relations can be added incrementally and loaded through
the same versioned Projection contract.

### 4. Rebuild complete releases from approved records

The output is a full Teaching Projection and full prerequisite publication,
not a patch overlay. Their identities bind the v0.18 snapshot, captured input
manifest, mapping set, policy version, and deterministic whole-set digest. The
later shard candidate must compose these exact identities rather than reading
an independently advanced teaching pointer.

### 5. Preserve authority and historical audit boundaries

Published engineering entities and relations receive identity and closure
checks only. The historical 34-batch / 4,880-DEFER audit remains immutable
context outside the current denominator.

## Risks / Trade-offs

- Split, merge, and deleted predecessor cases require human decisions and can
  delay cutover; guessing would be worse.
- A complete rebuild costs more than a patch but prevents mixed projection state.

## Migration Plan

1. Capture and seal the current denominator.
2. Compute unchanged, mapped, ambiguous, and missing dispositions.
3. Resolve the review worklist and rebuild both complete releases twice.
4. Publish inactive candidates and verify current pointers remain v0.9.

## Open Questions

- Exact REVIEW_REQUIRED volume is evidence produced by implementation, not a proposal assumption.
