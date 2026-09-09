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

用户明确要求课程补充时，可依据已有讲义和教材补全已绑定卡片。卡片保留原 Canonical 和资源身份，声明 `content_origin: act-course-enrichment`，并在 wave 记录中保存来源摘要与数值核验。确定性生成器保留这些正文，只有显式 `--force` 才会改写。补充正文属于 ACT 教学内容，不改写 Authority 事实。

当前聚合包可保留较早组件的 `domain-projection.json`，不能修改其 release 字段冒充聚合身份。课程补充卡片使用当前导出器的定向参数：`python3 scripts/knowledge/export-authority-learning-content-v2.py --copy-authoring-card <safe_id>`。它核对当前 Authority、卡片实体及来源，再复制指定作者文件，并重新生成包含教学层身份的学习内容清单。

定向导出要求正文包含 `**一句话定义**` 和 `### 完整解释`；数学表达与示例写入这些内容区，不能仅改变小标题而遗漏导出契约要求的完整解释区。

The combined runtime learning manifest is v2 and seals the Authority release,
release-set and snapshot identity from the supplied immutable shard-set manifest.
Its projection and release evidence must name that same Authority release. A
partial `--cards-only` or `--infographs-only` export preserves the other asset
state only when the existing v2 manifest has the same sealed identity.
