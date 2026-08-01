# Aggregate CourseCoverage active path

Production governance loads **only** reviewed artifacts under this directory:

| File | Role |
|------|------|
| `automatic-control.json` | Exhaustive CourseCoverage ledger (required for production import) |
| `act-crosswalk-semantic-reviews.json` | Controlled ACT Crosswalk semantic reviews |
| `resource-binding-reviews.json` | Controlled #1124 resource-binding reviews |

Do **not** place generator output, threshold heuristics, or script-manufactured “agent-review” JSON here. Final outcomes come only from independent review + assembler.

## Current state (Issue #1126)

### `automatic-control.json`

- Assembled from independent Grok CourseCoverage review decisions.
- Exhaustive dispositions for **744** Projection Canonical members.
- Production import still requires a Git-tracked, clean capture and an accepted Delta binding; database baseline migration is **not** claimed complete by this file alone.

### `act-crosswalk-semantic-reviews.json`

- Assembled from the **v3** Crosswalk worklist and independent Grok review decisions.
- **1121** object-triple reviews (relation-type upstream remains opaque / unlisted).
- Outcomes: **ACCEPT 39** / **UNSUPPORTED 1067** / **HIGH_IMPACT 7** / **AMBIGUOUS 8**.
- Candidate identity contract: `aggregate-semantic-align/v3` — binds exact upstream triple, Canonical ID, structural unit ID, and **content hash** (not Git capture revision). Capture / structuralUnitVersion / inventory identity remain enforced at publication gates.

### `resource-binding-reviews.json`

- Assembled from a binding worklist with **itemCount = 0** and independent review (no pairs to decide).
- **reviewCount = 0**.
- All **39** Crosswalk ACCEPT triples map to inventory disposition **UNRESOLVED**, so binding worklist generation fail-closed with empty items (`inventory-disposition:UNRESOLVED`). This is **not** “resource binding complete” and must not be read as a synthetic zero-binding success.

## Workflow

1. Generator writes worklists under `../candidates/` (no final roles/outcomes).
2. Separate Grok session reads the worklist and writes decision files under `../reviews/pending/`.
3. Assembler validates complete membership, digests, candidate identity, and truthful reviewer identity, then writes controlled active files here.

Pending review / worklist paths are audit and regeneration inputs only; production loaders read **active** files.

## Loader rules

- Active files must be Git-tracked and clean at production load time.
- `automatic-control.json` must bind an accepted Delta Receipt and a production review identity (never `candidate-generator:*` / unreviewed markers).
- Optional Crosswalk / binding review files may be empty of ACCEPTs when evidence is insufficient; unresolved Crosswalks and empty binding reviews fail closed rather than inventing mappings.
- Production migration / database baseline remains a separate verification step and is not asserted by this README.
