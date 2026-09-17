"""Verify teaching-core-01a authoring cards without runtime writes."""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
CAPTURED_REVISION = "f655dee490f714247dea867602a4d42bf699f2fd"
SNAPSHOT_ID = "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
SNAPSHOT_HASH = SNAPSHOT_ID.removeprefix("snap-")
RELEASE_ID = "ctr:release:control-theory-engineering-v0.48"
REVIEW_STATUS = "pending-independent-review"
EXPECTED_IDS = [
    "ctc:modeling-1897336a3fe60360d9fea3aa",
    "ctc:modeling-227e674315b4da2f1a20ee31",
    "ctc:modeling-30d05b970a0d4a71c9d243c3",
    "ctc:modeling-5727d74e4587f60fe7b011ae",
    "ctc:modeling-c343400ab0cc996416d5a18a",
    "ctc:modeling-e4d5dedd058631068d41b452",
]
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


PREDICATE_LABELS = {
    "association": "相关",
    "applies_to": "适用于",
    "used_to_analyze": "用于分析",
    "has_representation": "有表示",
    "has_component": "包含组件",
    "is_a": "属于",
    "has_formula": "具有公式",
    "prerequisite": "前置于",
}


def relation_checks(card_text: str, row: dict[str, object], neighborhood: dict[str, object]) -> None:
    current = row["canonicalId"]
    objects = {item["id"]: item["label"] for item in neighborhood["objects"]}
    relations = neighborhood["relations"]
    expected_lines = []
    body = card_text.split("---", 2)[2]
    relation_section = body.split("### 关联节点", 1)[1]
    actual_lines = [line for line in relation_section.splitlines() if line.startswith("- ")]
    for relation in relations:
        if relation["sourceId"] == current:
            other = relation["targetId"]
            relative = "无向" if relation["direction"] == "unordered" else "出边"
        elif relation["targetId"] == current:
            other = relation["sourceId"]
            relative = "无向" if relation["direction"] == "unordered" else "入边"
        else:
            raise AssertionError(f"relation endpoint does not contain {current}: {relation['id']}")
        expected_lines.append(
            f"- **{objects[other]}**（{relative}，关系：{PREDICATE_LABELS[relation['predicate']]}）"
        )
    true(f"relation rendering exact: {row['cardId']}", actual_lines == expected_lines)
    for relation in relations:
        other = relation["targetId"] if relation["sourceId"] == current else relation["sourceId"]
        true(
            f"relation endpoints: {relation['id']}",
            {relation["sourceId"], relation["targetId"]} == {current, other},
        )
        true(f"relation label: {relation['id']}", objects[other] in "\n".join(actual_lines))
        true(f"relation predicate: {relation['id']}", relation["predicate"] in PREDICATE_LABELS)
        relative = "无向" if relation["direction"] == "unordered" else (
            "出边" if relation["sourceId"] == current else "入边"
        )
        rendered = f"- **{objects[other]}**（{relative}，关系：{PREDICATE_LABELS[relation['predicate']]}）"
        true(f"relation semantics: {relation['id']}", rendered in actual_lines)


def model_claim_checks(cards: list[dict[str, object]], models: dict[str, object]) -> None:
    by_id = {row["cardId"]: (ROOT / row["authoringPath"]).read_text(encoding="utf-8") for row in cards}
    yaw = models["yaw_rate"]
    fidelity = models["fidelity"]
    physical = models["physical_similarity"]
    expected = {
        cards[0]["cardId"]: ["1.26424", "3.67879", "$2$ 度/秒", "5\\dot r+r=0.2\\delta"],
        cards[1]["cardId"]: ["1.26424", "1.63212", "0.2", "1/s"],
        cards[2]["cardId"]: ["0.999950", "-0.572939", "0.707107", "-45^\\circ", "1-e^{-t}"],
        cards[3]["cardId"]: ["z''+2z'+4z=1", "0.25\\ \\mathrm{m}", "0.25\\ \\mathrm{C}", "1.73205"],
        cards[4]["cardId"]: ["1.26424", "$2$ 度/秒", "T=5", "0.2\\ \\mathrm{s^{-1}}"],
        cards[5]["cardId"]: ["0.2}{5s+1", "-0.2", "1/s", "T=J/D=5"],
    }
    true("yaw-rate report r(5)", math.isclose(yaw["rAt5Seconds"], 1.2642411176571153, abs_tol=1e-12))
    true("yaw-rate report heading(5)", math.isclose(yaw["headingAt5Seconds"], 3.6787944117144233, abs_tol=1e-12))
    true("yaw-rate report alternate initial state", math.isclose(yaw["rAt5SecondsWithInitialRateOne"], 1.6321205588267786, abs_tol=1e-12))
    true("fidelity low-frequency magnitude", math.isclose(fidelity["frequencyComparison"][0]["magnitudeRatioDetailedToReduced"], 0.9999500037496878, abs_tol=1e-12))
    true("fidelity high-frequency phase", math.isclose(fidelity["frequencyComparison"][1]["extraPhaseDegrees"], -45.0, abs_tol=1e-12))
    true("physical common equation", physical["commonDimensionlessEquation"] == "z_second + 2 z_first + 4 z = 1")
    for card_id, snippets in expected.items():
        text = by_id[card_id]
        for snippet in snippets:
            true(f"model-backed claim {card_id}: {snippet}", snippet in text)


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
    with tempfile.TemporaryDirectory(prefix="teaching-core-01a-parser-") as temp:
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
    true("KaTeX formula count", parsed["formulaCount"] >= 20)
    return parsed


def main() -> None:
    scope = json.loads((BATCH / "scope.json").read_text(encoding="utf-8"))
    source_inventory = json.loads((BATCH / "source-inventory.json").read_text(encoding="utf-8"))
    true("exact six scope cards", len(scope["cards"]) == 6)
    true("scope IDs exact", [row["canonicalId"] for row in scope["cards"]] == EXPECTED_IDS)
    true("source inventory IDs exact", [row["canonicalId"] for row in source_inventory["cards"]] == EXPECTED_IDS)
    true("scope lifecycle is authoring", scope["status"] == "authoring")
    true("captured revision exact", source_inventory["capturedRevision"] == CAPTURED_REVISION)
    true("authority snapshot exact", source_inventory["authority"]["snapshotId"] == SNAPSHOT_ID)
    true("authority release exact", source_inventory["authority"]["releaseId"] == RELEASE_ID)
    true("source backup count", len(list(BATCH.glob("*-source.json"))) == 6)
    true("previous copy count", len(list((BATCH / "previous").glob("*.md"))) == 6)

    cards: list[dict[str, object]] = []
    for row in source_inventory["cards"]:
        card_id = row["cardId"]
        card_path = ROOT / row["authoringPath"]
        card_text = card_path.read_text(encoding="utf-8")
        true(f"card exists: {card_id}", card_path.is_file())
        true(f"card identity: {card_id}", card_id == row["canonicalId"].replace(":", "_"))
        true(f"card canonical frontmatter: {card_id}", f'authority_entity_id: "{row["canonicalId"]}"' in card_text)
        true(f"card name frontmatter: {card_id}", f'name: "{row["name"]}"' in card_text)
        true(f"card release: {card_id}", f'authority_release_id: "{RELEASE_ID}"' in card_text)
        true(f"card snapshot id: {card_id}", f'authority_snapshot_id: "{SNAPSHOT_ID}"' in card_text)
        true(f"card snapshot: {card_id}", f'authority_snapshot_hash: "{SNAPSHOT_HASH}"' in card_text)
        true(f"card status: {card_id}", "card_version: 3" in card_text and "status: ready" in card_text)
        declared = declared_source_docs(card_text)
        true(f"source_docs exact: {card_id}", declared == [source["path"] for source in row["sources"]])
        true(f"source_docs exist: {card_id}", all((ROOT / path).is_file() for path in declared))
        for source in row["sources"][:2]:
            source_path = ROOT / source["path"]
            true(f"source hash: {source['path']}", sha(source_path) == source["sha256"])
            true(f"source revision: {source['path']}", source["revision"] == CAPTURED_REVISION)
            true(f"source git hash: {source['path']}", git_sha(source["revision"], source["path"]) == source["sha256"])
            shard = json.loads(source_path.read_text(encoding="utf-8"))
            true(f"source snapshot: {source['path']}", shard["envelope"]["authority"]["snapshotId"] == SNAPSHOT_ID)
            true(f"source release: {source['path']}", shard["envelope"]["authority"]["releaseId"] == RELEASE_ID)
        backup_path = ROOT / row["sourceBackupPath"]
        true(f"source backup hash: {card_id}", sha(backup_path) == row["sourceBackupSha256"])
        previous_path = ROOT / row["sources"][2]["path"]
        true(f"previous hash: {card_id}", sha(previous_path) == row["previousCardSha256"])
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
        relation_checks(card_text, row, neighborhood)
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
        "reviewStatus": REVIEW_STATUS,
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
        "reviewStatus": REVIEW_STATUS,
    }
    write_json_batched(BATCH / "numerical-verification.json", {"report": report, "checks": checks})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
