# Authority DomainConcept cards & infographs

Scripts for ActKG `control-theory-engineering-v0.12` DomainConcept knowledge cards and Grok-generated infographs.

## Paths

| Artifact | Path |
|----------|------|
| Authoring cards | `course-content/authoring/knowledge/cards/authority/nodes/<safe_id>.md` |
| Runtime cards | `course-content/runtime/knowledge/cards/authority/nodes/<safe_id>.md` |
| Authoring infographs | `course-content/authoring/knowledge/infographs/authority/nodes/<safe_id>/` |
| Runtime infographs | `course-content/runtime/knowledge/infographs/authority/nodes/<safe_id>.png` |
| Inventory / status | `course-content/authoring/knowledge/cards/authority/inventory.json`, `status.json` |

`safe_id` = `entity_id` with `:` → `_` (and other FS-unsafe chars cleaned).

JSON metadata stores repository paths relative to the checkout using POSIX
separators.  Generated input images keep only their basename; workstation and
temporary directories are never persisted.

## Workflow

```bash
# 0. Inventory
python3 course-content/scripts/authority-cards/export_domainconcept_inventory.py

# 1. Text cards (Batch A+B by default; add --include-blocked for C)
python3 course-content/scripts/authority-cards/materialize_authority_knowledge_cards.py --batch all
python3 course-content/scripts/authority-cards/materialize_authority_knowledge_cards.py --batch C --include-blocked

# 2. Prepare infograph packages
python3 course-content/scripts/authority-cards/prepare_authority_infograph.py --batch A
python3 course-content/scripts/authority-cards/prepare_authority_infograph.py --batch B

# 3. Queue for Grok image_gen (agent reads prompt.md and calls image_gen)
python3 course-content/scripts/authority-cards/batch_generate_runner.py --batch A --limit 20

# 4. After image_gen saves a file:
python3 course-content/scripts/authority-cards/register_authority_infograph.py \
  --safe-id <safe_id> --image /path/to/image.png --accept

# 5. Export runtime from the exact sealed Authority shard-set (draft-blocked cards are skipped)
python3 course-content/scripts/authority-cards/export_authority_cards_and_infographs.py \
  --authority-shard-manifest course-content/runtime/knowledge/authority-domain-shards/sets/<shard-set-id>/manifest.json

# 6. Status
python3 course-content/scripts/authority-cards/status_report.py

# Repair metadata paths after importing an existing image pack (idempotent)
python3 course-content/scripts/authority-cards/normalize_authority_infograph_metadata.py
```

## Batches

- **A**: teaching coverage roles (`formal_objective` / `necessary_prerequisite` / `explicit_extension`)
- **B**: remaining cardable (description length ≥ 20, published, non-candidate)
- **C**: short description — write only with `--include-blocked` (`status: draft-blocked`)

## Content policy

Fail-closed: definitions and relations only from domain-projection description + DomainConcept links. No invented engineering examples or misconceptions. Cards with `status: draft-blocked` are not exported to runtime; accepted infographs remain independently exportable.

The combined runtime learning manifest is v2 and seals the Authority release,
release-set and snapshot identity from the supplied immutable shard-set manifest.
Its projection and release evidence must name that same Authority release. A
partial `--cards-only` or `--infographs-only` export preserves the other asset
state only when the existing v2 manifest has the same sealed identity.
