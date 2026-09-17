"""Verify teaching-core-03a authoring cards without runtime writes.

The captured model report is intentionally read-only: verify-models.py writes its
report, so this verifier checks and reuses the already-passed report instead of
executing it again.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import subprocess
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
    "ctc:modeling-34de45f2470f6c09c7d96698",
    "ctc:modeling-4fe8840f2c796861bf5d2dae",
    "ctc:modeling-70629af71e754aac8b740638",
    "ctc:modeling-70b08efcf6bb085e05de94cd",
    "ctc:modeling-f6875bd8fd4ad1250d8980d8",
    "ctkg:v3e-object-a24b53236c203ab7f9d5f504",
]
PREDICATE_LABELS = {
    "association": "相关",
    "applies_to": "适用于",
    "used_to_analyze": "用于分析",
    "is_a": "属于",
}
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


def relation_checks(card_text: str, row: dict[str, object], neighborhood: dict[str, object]) -> None:
    current = row["canonicalId"]
    objects = {item["id"]: item["label"] for item in neighborhood["objects"]}
    expected_lines = []
    for relation in neighborhood["relations"]:
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
    body = card_text.split("---", 2)[2]
    relation_section = body.split("### 关联节点", 1)[1]
    actual_lines = [line for line in relation_section.splitlines() if line.startswith("- ")]
    true(f"relation rendering exact: {row['cardId']}", actual_lines == expected_lines)


def model_claim_checks(cards: list[dict[str, object]], report: dict[str, object]) -> None:
    true("fixed model report passed", report["status"] == "passed")
    true("fixed model stage", report["stage"] == "models-before-authoring")
    models = report["models"]
    equilibria = models["equilibria"]
    true("equilibria exact", equilibria["equilibria"] == [-2, 2])
    true("equilibrium poles exact", equilibria["linearPolesAtMinus2AndPlus2"] == [4, -4])
    tangent = models["static_tangent"]
    true("tangent slope exact", tangent["slope"] == 4)
    true("tangent samples exact", math.isclose(tangent["samples"][0]["actual"], 4.41, abs_tol=1e-12))
    true("tangent larger remainder exact", math.isclose(tangent["samples"][1]["absoluteRemainder"], 0.25, abs_tol=1e-12))
    small = models["small_signal"]
    true("small-signal linear final exact", math.isclose(small["linearFinalIncrement"], 0.1, abs_tol=1e-12))
    true("small-signal nonlinear final exact", math.isclose(small["nonlinearFinalIncrement"], 0.09761769634030326, abs_tol=1e-12))
    true("small-signal term ratio exact", math.isclose(small["quadraticToLinearStateTermRatioAtDeltaX0_1"], 0.025, abs_tol=1e-12))
    true("small-signal grid difference exact", math.isclose(small["maxAbsoluteDifferenceOn0To2Grid"], 0.0023714464278831726, abs_tol=1e-12))
    non_equilibrium = models["non_equilibrium"]
    true("non-equilibrium drift exact", non_equilibrium["constantDrift"] == 3)
    counterexample = models["zero_jacobian_counterexample"]
    true("zero-jacobian linearization exact", counterexample["bothLinearizations"] == "delta_x_dot=0")
    true("zero-jacobian minus trace exact", math.isclose(counterexample["xAt10ForMinusAndPlus"][0], 0.09128709291752769, abs_tol=1e-12))
    true("zero-jacobian plus trace exact", math.isclose(counterexample["xAt10ForMinusAndPlus"][1], 0.1118033988749895, abs_tol=1e-12))
    by_id = {row["cardId"]: (ROOT / row["authoringPath"]).read_text(encoding="utf-8") for row in cards}
    expected = {
        cards[0]["cardId"]: ["\\delta u-4\\delta x-\\delta x^2", "\\delta\\dot{x}\\approx -4\\delta x+\\delta u", "0.1\\left(1-e^{-4t}\\right)"],
        cards[1]["cardId"]: ["4.41", "4.4", "0.01", "6.25", "6.0", "0.25"],
        cards[2]["cardId"]: ["A=-4", "B=1", "\\frac1{s+4}", "0.1\\left(1-e^{-4t}\\right)"],
        cards[3]["cardId"]: ["f_0=3", "3+\\delta u-2\\delta x-\\delta x^2", "3-2\\delta x+\\delta u", "1.5\\left(1-e^{-2t}\\right)"],
        cards[4]["cardId"]: ["0.0976177", "0.025", "0.00237145"],
        cards[5]["cardId"]: ["x_0=2", "x_0=-2", "0.0912871", "0.111803", "\\dot{x}=-x^3", "\\dot{x}=x^3"],
    }
    for card_id, snippets in expected.items():
        for snippet in snippets:
            true(f"model-backed claim {card_id}: {snippet}", snippet in by_id[card_id])


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
    with tempfile.TemporaryDirectory(prefix="teaching-core-03a-parser-") as temp:
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
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr)
    parsed = json.loads(result.stdout.strip().splitlines()[-1])
    true("parser card count", parsed["cardCount"] == len(cards))
    true("KaTeX formula count", parsed["formulaCount"] >= 30)
    return parsed


def main() -> None:
    scope = json.loads((BATCH / "scope.json").read_text(encoding="utf-8"))
    source_inventory = json.loads((BATCH / "source-inventory.json").read_text(encoding="utf-8"))
    accepted = json.loads((BATCH / "accepted-scope.json").read_text(encoding="utf-8"))
    true("exact six scope cards", len(scope["cards"]) == 6)
    true("scope IDs exact", [row["canonicalId"] for row in scope["cards"]] == EXPECTED_IDS)
    true("source inventory IDs exact", [row["canonicalId"] for row in source_inventory["cards"]] == EXPECTED_IDS)
    true("scope lifecycle is authoring", scope["status"] == "authoring")
    true("accepted scope remains pending", accepted["status"] == REVIEW_STATUS and accepted["accepted"] is False)
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
        body_path = BATCH / "bodies" / f"{row['order']:02d}.md"
        body_path.parent.mkdir(parents=True, exist_ok=True)
        body_path.write_text(body.strip() + "\n", encoding="utf-8")
        true(f"body materialized: {card_id}", body_path.read_text(encoding="utf-8").strip() == body.strip())
        item = dict(row)
        item["cardSha256"] = sha(card_path)
        item["parsedExplanationChars"] = parsed_chars
        cards.append(item)

    model_report = json.loads((BATCH / "model-verification.json").read_text(encoding="utf-8"))
    model_claim_checks(cards, model_report)
    tangent_text = (ROOT / cards[1]['authoringPath']).read_text()
    affine = re.search(r'g\(x\)\\approx([+-]?\d+)x([+-]\d+)?\$', tangent_text)
    true('simplified tangent is explicitly affine', affine is not None)
    slope, offset = int(affine[1]), int(affine[2] or 0)
    true('simplified tangent passes through operating point', slope*2+offset == 4)
    true('simplified tangent has original derivative', slope == 4)
    for row in cards:
        text = (ROOT/row['authoringPath']).read_text()
        for formula in re.findall(r'\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$', text):
            true('no bare spacing command: '+row['cardId'], not re.search(r'(?<!\\)\bqquad\b', ''.join(formula)))

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
        "modelVerification": "reused fixed model-verification.json (verify-models.py not executed)",
        "modelClaimsChecked": True,
        "parserCardCount": parser["cardCount"],
        "katexFormulaCount": parser["formulaCount"],
        "parserReadback": parser["parsed"],
        "checkCount": len(checks),
        "method": "source and SHA-256 identity, immutable-neighborhood relation verification, fixed model report, actual learner-card parser and KaTeX",
        "runtimeWritten": False,
        "reviewStatus": REVIEW_STATUS,
    }
    write_json_batched(BATCH / "numerical-verification.json", {"report": report, "checks": checks})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
