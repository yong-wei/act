## Context

The active shard identity is `control-theory-engineering-v0.37`, but the ACT composite registry stops at v0.22 and `PUBLISHED_LATEST_COMPOSITE_NAME` remains pinned to v0.22. No ACT locale-manifest artifact exists for the active envelope, so `resolveActiveLocaleQualification()` returns historical Chinese-only capability and the English button is intentionally disabled. The admitted upstream v0.37 bundle declares bilingual readiness and contains localized content, rich text, formula and locale-manifest artifacts, but ACT has not adapted or independently qualified them. The active presentation inventory also iterates all fifteen catalog domains while only eight defaults exist, so qualification would currently fail even after adding a registry row.

## Goals / Non-Goals

**Goals:**

- Admit and independently qualify the exact active v0.37 bilingual evidence.
- Bind every locale record and receipt to the same active Authority, catalog, shard set and language component.
- Compute the complete denominator offline and expose only immutable verified receipts at request time.
- Switch every active graph surface atomically while preserving graph state.
- Fail closed on incomplete domains, partial locale refresh or mixed-language output.

**Non-Goals:**

- Enabling English by changing a boolean, bypassing qualification or following `latest`.
- Authoring Authority translations or using ACT overlay values.
- Changing production Authority, Teaching or resource selectors.
- Translating optional ACT learning content that lacks English.

## Decisions

### 1. Upstream v0.37 locale evidence is adapted, not trusted directly

An offline adapter reads the exact admitted bundle's locale manifest and localized indexes, verifies their declared hashes and identity, then produces ACT's normalized manifest and qualification receipts. ACT independently reconstructs its presentation denominator from the complete sealed fifteen-domain graph closure and compares every category.

Alternative rejected: treat upstream `bilingual_ready: true` as sufficient. The canonical spec requires independent denominator, uniqueness, safety and digest verification.

### 2. Runtime reads a sealed qualification package

Build/qualification writes an immutable package containing normalized manifest, per-locale receipts, denominator digest, content digest, interface-catalog digest and active identity. Requests verify the small current pointer/package seal and project bounded shard records. They do not traverse all neighborhoods/details or parse the complete localized corpus per process.

Alternative rejected: keep `loadActivePresentationInventory()` on the first live request. It performs thousands of file reads and currently fails on seven missing domains.

### 3. Locale switch uses a transactional client refresh

The client begins a new locale generation, keeps the current frame visible, fetches root and every currently loaded logical shard in parallel within a bounded concurrency limit, verifies one locale profile, then commits all display records together. Failure retains the old locale and state; no mixed frame is shown. Stale generations cannot commit.

Alternative rejected: update `selectedLocale` before sequentially replacing root, family, neighborhood and detail records. It exposes partial state and makes loaded-node count control switch latency.

### 4. All surfaces participate in one acceptance denominator

Root domains, overview concepts, search, filters, relation terms, formulas, hover, inspector, optional blocks and accessibility are covered. Optional ACT blocks declare availability independently and may be omitted with selected-language copy; they never inject Chinese into English.

## Risks / Trade-offs

- [Upstream and ACT locale schemas differ] → Keep an explicit versioned adapter with fixture and full-corpus round-trip tests; never silently copy fields.
- [Offline qualification is expensive] → Run it at immutable publication time, persist receipts and make runtime verification proportional to the bounded response.
- [Parallel refresh overloads APIs] → Use bounded concurrency and deduplicate logical shard keys while preserving one atomic commit.
- [Some optional content is Chinese-only] → Omit or show the English unavailable state without changing stable launch identity.
- [Active identity changes during refresh] → Abort the generation, clear pending locale data and require a fresh root in the original locale.

## Migration Plan

1. Add failing tests for current historical capability, missing v0.37 registry/manifest and seven-domain denominator failure.
2. Complete the fifteen-domain shard prerequisite and build the v0.37 offline adapter/qualification package.
3. Replace v0.22-specific published constants with an exact identity registry lookup that never follows mutable latest.
4. Implement bounded runtime receipt verification and transactional client refresh.
5. Run full-corpus bilingual qualification and real browser switching evidence before publishing the proposal implementation.

## Open Questions

None. The exact active identity and upstream artifact hashes are implementation inputs, not configurable runtime choices.
