## Verification

### Data Completeness Helper

- Before helper run: `/tmp/issue-789-before-data-completeness.json`.
  - citation targets: 2857 total, 2857 resolvable, 0 verified
  - retrieval chunks: 2857 total, 0 mapped
  - corpus chunks: 964 total, 964 with citationAddress, 0 missing citationAddress
  - resource disposition: 3298 resource nodes, 3298 reviewed dispositions, 0 missing disposition, 0 invalid promotion
  - path readiness: 196 resource nodes, 196 planning units, 196 high-confidence path eligible, 0 blocked path nodes
- After helper run: `/tmp/issue-789-after-data-completeness.json`.
  - citation targets: 2857 total, 2857 resolvable, 15 verified
  - retrieval chunks: 2857 total, 15 mapped
  - long-form sections: 15 total, 15 mapped
  - long-form corpus chunks: 964 total, 964 mapped
  - corpus chunks: 964 total, 964 with citationAddress, 0 missing citationAddress
  - remaining `retrieval-chunk-not-indexed` findings: 2842 non-long-form ResourceNode primary chunks

### Scope Treatment

- Long-form section disposition and path metadata already resolve through the reviewed ResourceNode registry:
  15 textbook sections are represented; 5 reviewed exercise/section nodes are path-eligible and 10 chapter overview containers remain blocked from direct path promotion.
- Chunk and figure material remains citation support through evidence corpus chunks with server-owned `citationAddress`.
- The helper now treats a textbook section's retrieval/citation support as mapped only when evidence corpus chunks point to the same `textbook-section:*` ResourceNode and carry `citationAddress`.
- The change does not auto-promote chunks, figures, or blocked chapter overview containers to PlanningUnits.

### Commands

- `rtk npx tsx ./scripts/db/report-data-completeness-audit.ts --format json --compact`
- `rtk npm run test:unit -- src/lib/data-governance/__tests__/data-completeness-audit.test.ts`
- `rtk npm run test:unit -- src/lib/__tests__/adaptive-learning-path-planner.test.ts`
- `rtk openspec validate complete-longform-resource-path-readiness --strict`
- `rtk openspec validate --changes --strict`
- `rtk npm run lint`

### Build Limitation

- `rtk npm run build` currently fails in `src/features/adaptive-assessment/adaptive-assessment-item-catalog.ts` because baseline `versionRefs` can include `null` values. This is outside the #789 diff and is covered by the concurrent #783 branch/PR, which filters K/A/Q metadata version refs before catalog emission.
