# Pending isolated review decision files

A **separate Grok semantic-review session** must author these files by reading the
matching worklist. Production generator scripts must never write final decisions here.

| Decision file | Read worklist | Assembler command | Active output |
|---|---|---|---|
| `course-coverage-review-decisions.json` | `../../candidates/course-coverage-worklist.json` | `npx tsx scripts/course-coverage/review-aggregate-coverage-baseline.ts --assemble --review-file <this> --authoring-revision <40-hex>` | `../../active/automatic-control.json` |
| `act-crosswalk-review-decisions.json` | `../../candidates/act-crosswalk-semantic-worklist.json` | `npx tsx scripts/course-coverage/review-act-crosswalk-and-bindings.ts --assemble-crosswalk-reviews --review-file <this> --authoring-revision <40-hex>` | `../../active/act-crosswalk-semantic-reviews.json` |
| `resource-binding-review-decisions.json` | `../../candidates/resource-binding-worklist.json` | `npx tsx scripts/course-coverage/review-act-crosswalk-and-bindings.ts --assemble-binding-reviews --review-file <this> --authoring-revision <40-hex>` | `../../active/resource-binding-reviews.json` |

## Required review file fields

- `schemaVersion` matching the assembler contract
- `worklistInputDigest` equal to the worklist `inputDigest`
- same `deltaReceiptId` / `authoringRevision` as the worklist
- truthful `reviewProvider` + `reviewerIdentity` (never generator markers)
- exactly one decision per worklist item/group/pair
- digests over the exact reviewer input + decision payload

Binding worklist generation is blocked until Crosswalk reviews are assembled.
