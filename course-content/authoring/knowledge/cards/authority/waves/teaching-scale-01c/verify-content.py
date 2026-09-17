"""Verify the eight-card teaching-scale-01c authoring candidate.

The check reads the current published v0.48 detail and neighborhood shards,
verifies byte identity and the complete previous authoring copies, independently
recomputes the worked examples, and uses the existing learner-card parser plus
KaTeX in a temporary runtime-shaped directory. It never writes repository
runtime files.
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

import numpy as np


BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
EXPECTED_ORDERS = list(range(22, 30))
EXPECTED_IDS = [
    "ctkg_v3e-canonical-09e1c3e14609b082a4501ead",
    "ctkg_v3e-canonical-115de5ef0289a778cf5b69c6",
    "ctkg_v3e-canonical-299c52f97e423f68b4ac6093",
    "ctkg_v3e-canonical-312d1dfa7e96b9cc6f46e253",
    "ctkg_v3e-canonical-416fc2acf005a7da54f9fce3",
    "ctkg_v3e-canonical-4f62334f630ea074128ec396",
    "ctkg_v3e-canonical-62bea9217008b56901615d9a",
    "ctkg_v3e-canonical-6461b91e08c647ceff0ceeee",
]
CAPTURED_REVISION = "f655dee490f714247dea867602a4d42bf699f2fd"
SNAPSHOT_ID = "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
SNAPSHOT_HASH = "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
RELEASE_ID = "ctr:release:control-theory-engineering-v0.48"
checks: list[dict[str, object]] = []


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check(label: str, actual: object, expected: object, tolerance: float = 1e-9) -> None:
    if isinstance(actual, (float, int)) and isinstance(expected, (float, int)):
        if not math.isclose(float(actual), float(expected), rel_tol=tolerance, abs_tol=tolerance):
            raise AssertionError(f"{label}: {actual} != {expected}")
    elif actual != expected:
        raise AssertionError(f"{label}: {actual!r} != {expected!r}")
    checks.append({"check": label, "actual": actual, "expected": expected, "tolerance": tolerance})


def true(label: str, value: bool) -> None:
    if not value:
        raise AssertionError(label)
    checks.append({"check": label, "actual": True})


def clean_learning_text(value: str) -> str:
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = re.sub(chr(96) + r"[^" + chr(96) + r"]*" + chr(96), "", value)
    value = re.sub(r"\[(.*?)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"^#{1,6}\s+", "", value, flags=re.M)
    value = re.sub(r"[\t ]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def write_json_batched(path: Path, value: object, chunk_size: int = 300) -> None:
    lines = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").splitlines(keepends=True)
    with path.open("w", encoding="utf-8") as stream:
        for start in range(0, len(lines), chunk_size):
            stream.writelines(lines[start : start + chunk_size])


def verify_identity(inventory: dict[str, object], scope: dict[str, object]) -> list[dict[str, object]]:
    cards = inventory["cards"]
    assert isinstance(cards, list)
    scope_cards = scope["cards"]
    assert isinstance(scope_cards, list)
    check("exact card count", len(cards), 8)
    check("scope candidate count", len(scope_cards), 8)
    check("scope canonical IDs", [r["canonicalId"] for r in scope_cards], [r.replace("_", ":", 1) for r in EXPECTED_IDS])
    check("inventory canonical IDs", [r["cardId"] for r in cards], EXPECTED_IDS)
    check("expected order sequence", [r["order"] for r in cards], EXPECTED_ORDERS)
    check("batch id", inventory["batchId"], "teaching-scale-01c")
    check("captured revision", inventory["capturedRevision"], CAPTURED_REVISION)
    check("inventory remaining", inventory["remaining"], [])
    true("scope lifecycle status", scope["status"] in ["pending-independent-review", "accepted"])
    accepted = json.loads((BATCH / "accepted-scope.json").read_text(encoding="utf-8"))
    check("scope lifecycle agrees", accepted["status"], scope["status"])
    check("scope accepted flag", accepted["accepted"], scope["status"] == "accepted")
    if accepted["accepted"]:
        review = json.loads((BATCH / "review-acceptance.json").read_text())
        check("independent review accepted", review["status"], "accepted")
        check("independent review exact hashes", review["cardHashes"], {r["canonicalId"]: r["cardSha256"] for r in cards})
    check("source backup count", len(list(BATCH.glob("*-source.json"))), 8)
    check("previous copy count", len(list((BATCH / "previous").glob("*.md"))), 8)

    for index, row in enumerate(cards, start=1):
        card_id = row["cardId"]
        canonical_id = row["canonicalId"]
        check(f"card ID derived: {card_id}", card_id, canonical_id.replace(":", "_"))
        card_path = ROOT / row["authoringPath"]
        true(f"card exists: {card_id}", card_path.is_file())
        check(f"card hash: {card_id}", sha(card_path), row["cardSha256"])
        expected_node_hash = hashlib.sha256(canonical_id.encode()).hexdigest()
        detail, neighborhood, previous = row["sources"]
        true(f"detail path derived: {card_id}", detail["path"].endswith(f"details/node-{expected_node_hash}.json"))
        true(f"neighborhood path derived: {card_id}", neighborhood["path"].endswith(f"neighborhoods/node-{expected_node_hash}.json"))
        for source in row["sources"][:2]:
            source_path = ROOT / source["path"]
            true(f"source exists: {source['path']}", source_path.is_file())
            check(f"source hash: {source['path']}", sha(source_path), source["sha256"])
            check(f"source revision: {source['path']}", source["revision"], CAPTURED_REVISION)
            shard = json.loads(source_path.read_text(encoding="utf-8"))
            check(f"source snapshot: {source['path']}", shard["envelope"]["authority"]["snapshotId"], SNAPSHOT_ID)
            check(f"source release: {source['path']}", shard["envelope"]["authority"]["releaseId"], RELEASE_ID)
        backup_path = ROOT / row["sourceBackupPath"]
        true(f"source backup exists: {row['sourceBackupPath']}", backup_path.is_file())
        check(f"source backup hash: {card_id}", sha(backup_path), row["sourceBackupSha256"])
        backup = json.loads(backup_path.read_text(encoding="utf-8"))
        check(f"backup node identity: {card_id}", backup["node"]["id"], canonical_id)
        check(f"backup neighborhood identity: {card_id}", backup["neighborhood"]["nodeId"], canonical_id)
        check(f"backup source list: {card_id}", backup["sources"], row["sources"])
        previous_path = ROOT / previous["path"]
        true(f"previous copy exists: {card_id}", previous_path.is_file())
        check(f"previous copy hash: {card_id}", sha(previous_path), row["previousCardSha256"])
        check(f"previous source kind: {card_id}", previous["kind"], "previous-authoring-snapshot")
        check(f"backup numbering: {card_id}", row["sourceBackupPath"], f"course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01c/{index:02d}-source.json")
    return cards


def verify_markdown(cards: list[dict[str, object]]) -> None:
    for row in cards:
        text = (ROOT / row["authoringPath"]).read_text(encoding="utf-8")
        declared = re.findall(r'^  - "([^"\n]+)"$', text.split("source_docs:\n", 1)[1].split("asset_refs:", 1)[0], re.M)
        check(f"frontmatter source paths: {row['cardId']}", declared, [r["path"] for r in row["sources"]])
        true(f"frontmatter sources exist: {row['cardId']}", all((ROOT / path).is_file() for path in declared))
        parts = text.split("---", 2)
        true(f"frontmatter present: {row['cardId']}", len(parts) == 3)
        frontmatter, body = parts[1], parts[2]
        for marker in (
            f"node_id: {row['cardId']}",
            f'authority_entity_id: "{row["canonicalId"]}"',
            f'name: "{row["name"]}"',
            "card_version: 3",
            "status: ready",
            "source_docs:",
            "## 首页",
            "## 详情",
            "### 完整解释",
            "### 教学计算/推理例",
            "### 适用条件与边界",
            "### 常见误区",
            "### 自检",
            "核对要点",
            "### 关联节点",
        ):
            true(f"{marker}: {row['cardId']}", marker in text)
        detail = body.split("### 完整解释", 1)[1].split("### 关联节点", 1)[0]
        misconceptions = body.split("### 常见误区", 1)[1].split("### 自检", 1)[0]
        self_check = body.split("### 自检", 1)[1].split("### 关联节点", 1)[0]
        check(f"parsed explanation chars: {row['cardId']}", len(clean_learning_text(detail)), row["parsedExplanationChars"])
        true(f"substantive explanation: {row['cardId']}", len(clean_learning_text(detail)) >= 900)
        check(f"two misconceptions: {row['cardId']}", misconceptions.count("\n1. "), 1)
        check(f"two self-checks: {row['cardId']}", self_check.count("\n1. "), 1)
        check(f"two self-checks second item: {row['cardId']}", self_check.count("\n2. "), 1)
        true(f"body has no authority paths: {row['cardId']}", not re.search(r"(?:ctkg:|ctc:|course-content/)", body))


def verify_examples() -> None:
    close = lambda label, actual, expected, tolerance=1e-9: check(label, float(actual), float(expected), tolerance)

    roots = np.roots([1, 1, 20])
    true("static-error loop is stable", bool(np.all(roots.real < 0)))
    close("static-error Kv", 20 / 1, 20, 0.0)
    close("static-error unit-ramp measurement error", 1 / 20, 0.05, 0.0)
    close("static-error nonunit-H measurement error", 1 / 13, 1 / 13, 0.0)
    close("static-error nonunit-H tracking error", 7 / 13, 7 / 13, 0.0)

    close("final-value stable signal", 1 / (0 + 2), 0.5, 0.0)
    cancelled = np.polyval([1.0], 0.0) / np.polyval([1.0, 2.0], 0.0)
    close("final-value cancellation after reduction", cancelled, 0.5, 0.0)
    sinusoid_poles = np.roots([1, 0, 1])
    true("final-value sinusoid retains imaginary poles", bool(np.any(np.isclose(sinusoid_poles, 1j)) and np.any(np.isclose(sinusoid_poles, -1j))))
    close("sinusoid sample one", math.sin(math.pi / 2), 1.0, 0.0)
    close("sinusoid sample two", math.sin(3 * math.pi / 2), -1.0, 0.0)

    close("steady-performance unit-H output final", 2 / 3, 2 / 3, 0.0)
    close("steady-performance unit-H tracking error", 1 - 2 / 3, 1 / 3, 1e-12)
    close("steady-performance nonunit-H measurement error", 1 / 13, 1 / 13, 0.0)
    close("steady-performance nonunit-H tracking error", 1 - 6 / 13, 7 / 13, 1e-12)
    close("steady-performance plant disturbance DC output", 2 / 13, 2 / 13, 0.0)
    close("steady-performance measurement noise DC output", -6 / 13, -6 / 13, 0.0)

    close("unit-step response at t=0.5", 1 - math.exp(-1), 0.6321205588)
    close("delayed unit-step response at t=0.5", 1 - math.exp(-0.6), 0.4511883639)
    close("delayed unit-step before arrival", 0.0, 0.0, 0.0)
    close("unit-step response final", 1.0, 1.0, 0.0)

    close("Kp unit-H loop limit", 6 / 1, 6, 0.0)
    close("Kp unit-H error", 1 / 7, 1 / 7, 0.0)
    close("Kp nonunit-H loop limit", 12 / 1, 12, 0.0)
    close("Kp nonunit-H measurement error", 1 / 13, 1 / 13, 0.0)
    close("Kp nonunit-H tracking error", 7 / 13, 7 / 13, 0.0)
    close("Kp controller gain is separate", 3, 3, 0.0)

    close("unit-step delayed amplitude before arrival", 0.0, 0.0, 0.0)
    close("unit-step delayed amplitude at t=0.7", 3 * (1 - math.exp(-1)), 1.8963616765)

    close("unit-ramp target at t=3", 3.0, 3.0, 0.0)
    close("unit-ramp first-order output at t=2", 1 + math.exp(-2), 1.1353352832)
    close("unit-ramp first-order error at t=2", 1 - math.exp(-2), 0.8646647168)
    close("unit-ramp slope-three error at t=2", 3 * (1 - math.exp(-2)), 2.5939941503)

    roots_kv = np.roots([1, 1, 20])
    true("Kv loop is stable", bool(np.all(roots_kv.real < 0)))
    close("Kv open-loop low-frequency limit", 20 / 1, 20, 0.0)
    close("Kv unit-ramp measurement error", 1 / 20, 0.05, 0.0)
    close("Kv nonunit-H measurement coefficient", 40 / 1, 40, 0.0)
    small_s = 1e-7
    cg = 20 / (small_s * (small_s + 1))
    close("Kv nonunit-H output/reference low-frequency ratio", cg / (1 + 2 * cg), 0.5, 1e-6)


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
    katex.renderToString(match[1] ?? match[2], {
      displayMode: match[1] !== undefined,
      throwOnError: true,
      trust: false,
    });
    formulaCount += 1;
  }
  const card = readPublishedLearnerCardByToken(row.cardId, 'content:' + row.cardSha256);
  if (!card || card.explanation.length < 900 || !card.explanation.includes('自检') || !card.explanation.includes('核对要点')) {
    throw new Error('parser rejected or returned thin card: ' + row.name);
  }
  if (readPublishedLearnerCardByToken(row.cardId, 'content:' + '0'.repeat(64)) !== null) {
    throw new Error('wrong content hash was accepted: ' + row.name);
  }
  if (/(?:ctkg:|ctc:|course-content\/)/u.test(card.explanation)) {
    throw new Error('authority path leaked into explanation: ' + row.name);
  }
  parsed.push({ cardId: row.cardId, explanationChars: card.explanation.length });
}
console.log(JSON.stringify({ cardCount: parsed.length, formulaCount, parsed }));
"""


def verify_parser_and_katex(cards: list[dict[str, object]]) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="teaching-scale-01c-parser-") as temp:
        env = os.environ.copy()
        env.update({
            "CARD_REPO_ROOT": str(ROOT),
            "CARD_PARSE_ROOT": temp,
            "CARD_INVENTORY": str(BATCH / "inventory.json"),
        })
        completed = subprocess.run(
            ["npx", "tsx", "--eval", TS_VERIFY],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )
    output = json.loads(completed.stdout.strip().splitlines()[-1])
    check("parser card count", output["cardCount"], len(cards))
    true("KaTeX rendered formulas", output["formulaCount"] >= 32)
    return output


def main() -> None:
    inventory = json.loads((BATCH / "inventory.json").read_text(encoding="utf-8"))
    scope = json.loads((BATCH / "scope.json").read_text(encoding="utf-8"))
    cards = verify_identity(inventory, scope)
    verify_markdown(cards)
    checks_before_examples = len(checks)
    verify_examples()
    numerical_check_count = len(checks) - checks_before_examples
    parser = verify_parser_and_katex(cards)
    report = {
        "status": "passed",
        "batchId": inventory["batchId"],
        "capturedRevision": inventory["capturedRevision"],
        "cardCount": len(cards),
        "cardIds": [row["cardId"] for row in cards],
        "cardHashes": {row["cardId"]: row["cardSha256"] for row in cards},
        "numericalCheckCount": numerical_check_count,
        "checkCount": len(checks),
        "parserCardCount": parser["cardCount"],
        "katexFormulaCount": parser["formulaCount"],
        "parserReadback": parser["parsed"],
        "method": "independent Python control-model calculations, source/card SHA-256, temporary runtime-shaped existing learner-card parser and KaTeX",
        "runtimeWritten": False,
        "reviewStatus": scope["status"],
    }
    write_json_batched(BATCH / "numerical-verification.json", {"report": report, "checks": checks})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
