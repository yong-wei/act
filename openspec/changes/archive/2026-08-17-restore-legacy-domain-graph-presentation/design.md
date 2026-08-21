# Design: Restore Legacy Domain Graph Presentation

## Context

The knowledge page (`src/app/knowledge/page.tsx`) mounts `KnowledgeGraphWorkspace` (`src/features/knowledge/knowledge-graph-workspace.tsx`), which switches between `'active' | 'legacy' | 'candidate'` modes. The `legacy` mode renders `KnowledgeGraphSystem` (`src/features/knowledge/knowledge-graph-system.tsx`), whose circular root presentation is what users remember; the `active` mode renders `ActiveAuthorityGraph`.

Verified codebase facts this design builds on:

- **Active view**: `src/features/knowledge/active-authority-graph.tsx`. Its root screen (the `data-authority-shard-root` branch) is currently a card grid (`grid gap-3 sm:grid-cols-2 xl:grid-cols-3`) of domain buttons plus an aggregate `article`. The per-domain level already has an SVG canvas (nodes are `SVGGElement`s tagged `data-active-authority-node`) and a detail sidebar (`grid-cols-[minmax(0,1fr)_minmax(19rem,27rem)]`) with search, type filter, relation-family controls, knowledge card and infograph sections.
- **Legacy circular root layout survives**: `src/features/knowledge/graph/root-layout.ts` exports `KNOWLEDGE_ROOT_PACKING` (deterministic radial bubble packing: `minimumGap: 20`, viewport aspect clamped to `[0.4, 2.5]`) and `KNOWLEDGE_ROOT_BUBBLE_STYLE` (platform-token surface/depth/rim/glow/label treatment). It is consumed by `knowledge-graph-system.tsx` behind the `legacy` workspace mode.
- **Legacy root never drew inter-domain edges**: `selectCanonicalDomainRelationEdges` in `src/features/knowledge/graph/relation-family-controls.ts` filters links to those whose source **and** target are both in `activeDomainNodeIds`, so cross-domain links were structurally suppressed. The root view drew no lines between domains.
- The card/infograph inspector and its fail-closed manifest/identity rules already exist in the active view and its specs.

Term truth source: `docs/grill/20260817-pm/CONTEXT.md`. Governing edge-truth decision: `docs/grill/20260812-am/adr/20260812-render-current-authority-as-a-semantic-node-link-graph.md` (edges may only represent real published Authority relations; decorative and layout lines are prohibited).

## Goals / Non-Goals

**Goals**

- Port the Legacy root bubble presentation into the active workspace root screen, replacing the card grid.
- Data-driven entry count from the ACTIVE composite release's domain catalog, plus one comprehensive aggregate entry.
- Progressive loading: domain root shard + default teaching relations on domain entry; adjacent relations and detail on node selection.
- Legacy-style node detail sidebar reading active composite release ACT display projections.

**Non-Goals**

- No rebuild of the bubble layout from scratch; `root-layout.ts` is reused.
- No inter-domain lines at the root, ever, under this change. If published inter-domain relations appear in a future release, rendering them requires a NEW proposal.
- No change to release import, candidate validation, composite cutover activation, or the v0.9 read-only history entry.
- No dependency on v0.22 landing: the UI binds to whatever composite release is active.

## Decisions

### D1: Port, don't rebuild, the circular root

The active root screen adopts `KNOWLEDGE_ROOT_PACKING` and `KNOWLEDGE_ROOT_BUBBLE_STYLE` from `src/features/knowledge/graph/root-layout.ts`. The packing is already deterministic (stable seed per graph version + viewport), collision-safe, and viewport-aspect aware; reusing it preserves the Legacy look and the invariants its existing tests already cover. The card grid branch in `active-authority-graph.tsx` is replaced by a bubble canvas fed by the active root shard's domain catalog.

Alternative rejected: reimplementing packing inside the active component — duplicates a tested layout engine and invites drift from the Legacy presentation users are asking for.

### D2: Circular entries are navigation projections, not graph nodes

Each circular entry displays the domain's human-facing name and short summary from the active composite release's domain catalog. Entries are product navigation projections — they do not impersonate ActKG knowledge objects, carry no object identity, and are not selectable as Authority nodes. Entry count is read from the catalog at render time (the "eight domains" in scenario docs is illustrative only). The aggregate entry renders as one additional circular entry, visually distinguished, and never expands the global relation set.

### D3: Zero lines at the root

The root view performs pure spatial arrangement. No edge, ray, connector, or decorative line is drawn between any two entries (including entry-to-aggregate). This follows the 20260812 ADR rule that edges may only represent real published Authority relations, and matches the Legacy behavior in which `selectCanonicalDomainRelationEdges` kept only intra-domain links. A future appearance of published inter-domain relations does not change this default; putting them on the root requires a separate proposal.

### D4: Progressive loading boundaries

- Root: only the root shard (domain catalog + aggregate summary). No member objects, no relations.
- Domain activation: that domain's root shard and default published teaching relations only, via the existing server-bounded shard endpoints.
- Node selection: bounded one-hop adjacent relations and detail content (explanation, relation summaries, eligible cards/infographs) on demand.
- Engineering relation families load their missing shard only when the user enables the corresponding filter, per the existing `layered-authority-domain-workspace` filter contract.

Missing teaching projection coverage is disclosed honestly and never blocks display or selection of Authority objects.

### D5: Legacy-style inspector on active data

The existing active sidebar keeps its structure (name, type label, explanation, relation summary, knowledge card, infograph) and is aligned to the Legacy interaction contract: stable panel placement, in-place update when reselecting nodes, explicit close with focus return. All content resolves from the active composite release and its ACT display projections. Fail-closed identity hiding is preserved: a missing human-facing label yields a controlled unavailable state, never an internal identifier, and normal UI never shows object/relation IDs, Release/ReleaseSet/Snapshot/Activation/Projection identity, version hashes, internal enums, or paths.

### D6: v0.9 isolation

The circular root, domain shards, and inspector read only the active composite release selection. v0.9 stays behind the separate read-only history entry and serves no normal graph reads.

## Risks / Trade-offs

- **Bubble layout coupling**: `root-layout.ts` types reference `knowledge-graph-system.tsx` node data. Porting may need a thin adapter from the active root shard's domain catalog into the packing input type; keep the adapter presentation-only so no Authority identity leaks into layout metadata. Mitigation: adapter unit tests plus the existing deterministic-packing tests.
- **Catalog-size variance**: the active catalog's domain count is only known at read time (v0.22's actual count is verified at candidate import). The packing already handles variable entry counts; tests must cover counts other than eight.
- **Parallel v0.22 work**: this change and the v0.22 candidate changes touch adjacent territory. Binding strictly to "whatever composite release is active" keeps them independent; production rendering of v0.22 content simply waits for the composite cutover activation.

## Open Questions

None blocking. The exact visual differentiation of the aggregate entry reuses existing platform tokens and is settled during implementation review.
