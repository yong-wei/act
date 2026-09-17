"""Verify teaching-professional-03a authoring cards without runtime writes."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
checks: list[dict[str, object]] = []


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_sha(revision: str, path: str) -> str:
    return hashlib.sha256(
        subprocess.check_output(["git", "show", f"{revision}:{path}"], cwd=ROOT)
    ).hexdigest()


def true(label: str, value: bool) -> None:
    if not value:
        raise AssertionError(label)
    checks.append({"check": label, "actual": True})


def clean_learning_text(value: str) -> str:
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = re.sub(r"\x60[^\x60]*\x60", "", value)
    value = re.sub(r"\[(.*?)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"^#{1,6}\s+", "", value, flags=re.M)
    value = re.sub(r"[\t ]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def write_json_batched(path: Path, value: object) -> None:
    lines = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").splitlines(keepends=True)
    with path.open("w", encoding="utf-8") as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start : start + 300])


def declared_source_docs(card_text: str) -> list[str]:
    block = card_text.split("source_docs:\n", 1)[1].split("asset_refs:", 1)[0]
    return re.findall(r'^  - "([^"\n]+)"$', block, re.M)


def relation_checks(card_text: str, row: dict[str, object], neighborhood: dict[str, object],
                    relation_input: dict[str, object]) -> None:
    declared = next(
        item["relations"]
        for item in relation_input["cards"]
        if item["canonicalId"] == row["canonicalId"]
    )
    body = card_text.split("---", 2)[2]
    actual_lines = [
        line for line in body.split("### 关联节点", 1)[1].splitlines()
        if line.startswith("- ")
    ]
    true(f"relation rendering exact: {row['cardId']}", actual_lines == [r["renderedLine"] for r in declared])
    objects = {item["id"]: item["label"] for item in neighborhood["objects"]}
    predicates = {
        "association": "相关",
        "applies_to": "适用于",
        "used_to_analyze": "用于分析",
        "has_representation": "有表示",
        "has_component": "包含组件",
        "is_a": "属于",
        "part_of": "组成部分属于",
        "derived_from": "推导自",
        "has_formula": "具有公式",
        "prerequisite": "前置于",
    }
    for entry in declared:
        relation = next(item for item in neighborhood["relations"] if item["id"] == entry["relationId"])
        true(f"relation endpoints: {entry['relationId']}", set([relation["sourceId"], relation["targetId"]]) == set([row["canonicalId"], entry["otherId"]]))
        true(f"relation label: {entry['relationId']}", objects[entry["otherId"]] == entry["label"])
        true(f"relation predicate: {entry['relationId']}", relation["predicate"] == entry["predicate"])
        true(f"relation direction: {entry['relationId']}", relation["direction"] == entry["direction"])
        relative = "无向" if relation["direction"] == "unordered" else ("出边" if relation["sourceId"] == row["canonicalId"] else "入边")
        label = objects[entry["otherId"]]
        display = "$"+label+"$" if label.startswith("\\") else "**"+label+"**"
        rendered = f"- {display}（{relative}，关系：{predicates[relation['predicate']]}）"
        true(f"relation semantics: {entry['relationId']}", entry["renderedLine"] == rendered)


def model_claim_checks(cards, models):
    true("model report has expected sections", all(key in models for key in
        ["matrix_exponential", "state_transition", "canonical_realization", "rank_matrices", "pbh", "hidden_mode", "reachability", "duality"]))
    review = json.loads((BATCH / "body-review.json").read_text())
    true("independent body review passed", review["status"] == "passed")
    true("review source inventory unchanged", sha(BATCH / "source-inventory.json") == review["sourceInventorySha256"])
    for row in cards:
        text = (ROOT / row["authoringPath"]).read_text()
        body = text.split("---", 2)[2].strip().split("### 关联节点", 1)[0].rstrip() + "\n"
        true("reviewed body equality: " + row["cardId"], hashlib.sha256(body.encode()).hexdigest() == review["bodyHashes"][f"{row['order']:02}.md"])


TS_VERIFY = r"""
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import { readPublishedLearnerCardByToken } from './src/lib/authority-domain-shards/learning-content';
const repoRoot = process.env.CARD_REPO_ROOT;
const parseRoot = process.env.CARD_PARSE_ROOT;
const inventoryPath = process.env.CARD_INVENTORY;
if (!repoRoot || !parseRoot || !inventoryPath) throw new Error('missing parser verification environment');
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const target = join(parseRoot, 'course-content/runtime/knowledge/cards/authority/nodes');
mkdirSync(target, { recursive: true });
for (const row of inventory.cards) {
  writeFileSync(join(target, row.cardId + '.md'), readFileSync(join(repoRoot, row.authoringPath)));
}
process.chdir(parseRoot);
let formulaCount = 0;
const parsed = [];
for (const row of inventory.cards) {
  const body = readFileSync(join(target, row.cardId + '.md'), 'utf8');
  for (const match of body.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/gu)) {
    katex.renderToString(match[1] ?? match[2], { displayMode: match[1] !== undefined, throwOnError: true, trust: false });
    formulaCount += 1;
  }
  const card = readPublishedLearnerCardByToken(row.cardId, 'content:' + row.cardSha256);
  if (!card || card.explanation.length < 900 || !card.explanation.includes('自检') || !card.explanation.includes('核对要点')) {
    throw new Error('parser rejected card: ' + row.name);
  }
  if (readPublishedLearnerCardByToken(row.cardId, 'content:' + '0'.repeat(64)) !== null) {
    throw new Error('wrong content hash accepted: ' + row.name);
  }
  if (/(?:ctkg:|ctc:|course-content\/)/u.test(card.explanation)) {
    throw new Error('authority path leaked: ' + row.name);
  }
  parsed.push({ cardId: row.cardId, explanationChars: card.explanation.length });
}
console.log(JSON.stringify({ cardCount: parsed.length, formulaCount, parsed }));
"""


def verify_parser_and_katex(cards: list[dict[str, object]]) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix=f"{BATCH.name}-parser-") as temp:
        env = os.environ.copy()
        env.update({
            "CARD_REPO_ROOT": str(ROOT),
            "CARD_PARSE_ROOT": temp,
            "CARD_INVENTORY": str(BATCH / "inventory.json"),
        })
        result = subprocess.run(
            ["npx", "tsx", "--eval", TS_VERIFY],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )
    parsed = json.loads(result.stdout.strip().splitlines()[-1])
    true("parser card count", parsed["cardCount"] == len(cards))
    true("KaTeX formula count", parsed["formulaCount"] >= len(cards))
    return parsed


def main() -> None:
    scope = json.loads((BATCH / "scope.json").read_text(encoding="utf-8"))
    source_inventory = json.loads((BATCH / "source-inventory.json").read_text(encoding="utf-8"))
    accepted = json.loads((BATCH / "accepted-scope.json").read_text(encoding="utf-8"))
    relation_input = json.loads((BATCH / "relation-verification-input.json").read_text(encoding="utf-8"))
    batch_id = source_inventory["batchId"]
    captured_revision = source_inventory["capturedRevision"]
    authority = source_inventory["authority"]
    snapshot_id = authority["snapshotId"]
    snapshot_hash = authority["snapshotHash"]
    release_id = authority["releaseId"]
    scope_keys = [(row["order"], row["name"], row["canonicalId"]) for row in scope["cards"]]
    source_keys = [(row["order"], row["name"], row["canonicalId"]) for row in source_inventory["cards"]]
    true("scope batch identity", scope["batchId"] == batch_id)
    true("scope/source cards exact", scope_keys == source_keys)
    true("source card order contiguous", [row["order"] for row in source_inventory["cards"]] == list(range(1, len(source_inventory["cards"]) + 1)))
    true("scope lifecycle is authoring", scope["status"] == "authoring")
    true("accepted scope remains pending", accepted["status"] == "pending-independent-review" and accepted["accepted"] is False)
    true("captured revision present", bool(captured_revision) and bool(re.fullmatch(r"[0-9a-f]{40}", captured_revision)))
    true("authority snapshot identity", snapshot_hash == snapshot_id.removeprefix("snap-"))
    true("authority release present", bool(release_id))
    true("source backup count", len(list(BATCH.glob("*-source.json"))) == len(source_inventory["cards"]))
    expected_previous = sum(row["previousCardSha256"] is not None for row in source_inventory["cards"])
    true("previous copy count", len(list((BATCH / "previous").glob("*.md"))) == expected_previous)

    cards: list[dict[str, object]] = []
    for row in source_inventory["cards"]:
        card_id = row["cardId"]
        card_path = ROOT / row["authoringPath"]
        card_text = card_path.read_text(encoding="utf-8")
        true(f"card exists: {card_id}", card_path.is_file())
        true(f"card identity: {card_id}", card_id == row["canonicalId"].replace(":", "_"))
        node_id = re.search(r'^node_id:\s*(.+)$', card_text, re.M)
        true(f"frontmatter node_id exact: {card_id}", bool(node_id) and node_id.group(1).strip().strip('"\'') == card_id)
        true(f"card canonical frontmatter: {card_id}", f'authority_entity_id: "{row["canonicalId"]}"' in card_text)
        true(f"card name frontmatter: {card_id}", f'name: "{row["name"]}"' in card_text)
        true(f"card snapshot: {card_id}", f'authority_snapshot_hash: "{snapshot_hash}"' in card_text)
        true(f"card status: {card_id}", "card_version: 3" in card_text and "status: ready" in card_text)
        declared = declared_source_docs(card_text)
        true(f"source_docs exact: {card_id}", declared == [source["path"] for source in row["sources"]])
        true(f"source_docs exist: {card_id}", all((ROOT / path).is_file() for path in declared))
        for index, source in enumerate(row["sources"]):
            source_path = ROOT / source["path"]
            true(f"source hash: {source['path']}", sha(source_path) == source["sha256"])
            if source.get("kind") == "previous-authoring-snapshot":
                true(f"previous source has captured bytes: {source['path']}", source["sha256"] == row["previousCardSha256"])
            elif source.get("kind") == "supporting-research-record":
                record = json.loads(source_path.read_text())
                true("research record kind", record["kind"] == "supporting-research-record")
                true("research record primary URLs", bool(record["sources"]) and all(item["url"].startswith("https://") for item in record["sources"]))
                true("research record example", bool(record["workedExample"]))
            else:
                true(f"source revision: {source['path']}", source["revision"] == captured_revision)
                true(f"source git hash: {source['path']}", git_sha(source["revision"], source["path"]) == source["sha256"])
            if index < 2:
                shard = json.loads(source_path.read_text(encoding="utf-8"))
                true(f"source snapshot: {source['path']}", shard["envelope"]["authority"]["snapshotId"] == snapshot_id)
                true(f"source snapshot hash: {source['path']}", shard["envelope"]["authority"]["snapshotHash"] == snapshot_hash)
                true(f"source release: {source['path']}", shard["envelope"]["authority"]["releaseId"] == release_id)
                if index == 0:
                    true(f"detail identity: {card_id}", shard["node"]["id"] == row["canonicalId"])
        backup_path = ROOT / row["sourceBackupPath"]
        true(f"source backup hash: {card_id}", sha(backup_path) == row["sourceBackupSha256"])
        previous_sources = [source for source in row["sources"] if source.get("kind") == "previous-authoring-snapshot"]
        if row["previousCardSha256"] is not None:
            true(f"one previous source: {card_id}", len(previous_sources) == 1)
            if previous_sources:
                true(f"previous hash: {card_id}", sha(ROOT / previous_sources[0]["path"]) == row["previousCardSha256"])
        else:
            true(f"no fabricated previous source: {card_id}", not previous_sources)
        body = card_text.split("---", 2)[2]
        for marker in ("## 首页", "## 详情", "### 完整解释", "### 教学计算/推理例",
                       "### 适用条件与边界", "### 常见误区", "### 自检", "核对要点", "### 关联节点"):
            true(f"{marker}: {card_id}", marker in card_text)
        detail = body.split("### 完整解释", 1)[1].split("### 关联节点", 1)[0]
        parsed_chars = len(clean_learning_text(detail))
        true(f"explanation length: {card_id}", parsed_chars >= 900)
        misconceptions = body.split("### 常见误区", 1)[1].split("### 自检", 1)[0]
        self_check = body.split("### 自检", 1)[1].split("### 关联节点", 1)[0]
        true(f"two misconceptions: {card_id}", misconceptions.count("\n1. ") == 1 and misconceptions.count("\n2. ") == 1)
        true(f"two self-checks: {card_id}", self_check.count("\n1. ") == 1 and self_check.count("\n2. ") == 1)
        true(f"no authority paths in body: {card_id}", not re.search(r"(?:ctkg:|ctc:|course-content/)", body))
        neighborhood = json.loads((ROOT / row["sources"][1]["path"]).read_text(encoding="utf-8"))
        true(f"neighborhood identity: {card_id}", neighborhood["nodeId"] == row["canonicalId"])
        relation_checks(card_text, row, neighborhood, relation_input)
        body_path = BATCH / "bodies" / f"{row['order']:02d}.md"
        body_path.write_text(body.strip()+"\n", encoding="utf-8")
        true(f"body materialized: {card_id}", body_path.read_text(encoding="utf-8").strip() == body.strip())
        item = dict(row)
        item["cardSha256"] = sha(card_path)
        item["parsedExplanationChars"] = parsed_chars
        cards.append(item)

    model_result = subprocess.run(
        [sys.executable, str(BATCH / "verify-models.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    model_verification = json.loads((BATCH / "model-verification.json").read_text(encoding="utf-8"))
    true("original model verification passed", model_verification["status"] == "passed")
    model_claim_checks(cards, model_verification["models"])

    inventory = {
        "batchId": source_inventory["batchId"],
        "capturedRevision": source_inventory["capturedRevision"],
        "authority": source_inventory["authority"],
        "cards": cards,
        "cardCount": len(cards),
        "publicationStatus": "authoring",
        "reviewStatus": "pending-independent-review",
        "remaining": [],
        "remainingCount": 0,
        "method": "authoring cards bound to exact detail/neighborhood/previous source paths; no runtime writes",
    }
    write_json_batched(BATCH / "inventory.json", inventory)
    parser = verify_parser_and_katex(cards)
    report = {
        "status": "passed",
        "batchId": inventory["batchId"],
        "capturedRevision": inventory["capturedRevision"],
        "cardCount": len(cards),
        "cardIds": [row["cardId"] for row in cards],
        "cardHashes": {row["cardId"]: row["cardSha256"] for row in cards},
        "modelVerification": "verify-models.py passed",
        "modelClaimsChecked": True,
        "parserCardCount": parser["cardCount"],
        "katexFormulaCount": parser["formulaCount"],
        "parserReadback": parser["parsed"],
        "checkCount": len(checks),
        "method": "source and SHA-256 identity, immutable-neighborhood relation verification, original model verification, actual learner-card parser and KaTeX",
        "runtimeWritten": False,
        "reviewStatus": accepted["status"],
    }
    write_json_batched(
        BATCH / "numerical-verification.json",
        {"report": report, "checks": checks},
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
