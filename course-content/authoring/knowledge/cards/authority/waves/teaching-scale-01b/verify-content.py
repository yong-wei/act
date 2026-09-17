"""Verify the eight-card teaching-scale-01b authoring candidate.

This check is intentionally authoring-only. It validates source/card identity,
independent worked examples, KaTeX, and the existing learner-card parser in a
temporary runtime-shaped directory; it never writes the repository runtime.
"""
from __future__ import annotations

import hashlib
import json
import math
import numpy as np
import os
import re
import subprocess
import tempfile
from pathlib import Path


BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
EXPECTED_ORDERS = [4, 8, 11, 12, 13, 15, 19, 20]
EXPECTED_IDS = [
    "ctc_modeling-7734a0845c335f160395bac0",
    "ctc_modeling-c26fddc50074ec84707d5950",
    "ctkg_domainconcept_27b69e7f2e837fd62dc31379",
    "ctkg_domainconcept_42146fa04dc1459716346cc7",
    "ctkg_domainconcept_4eaa0995db3f87d3b7e0f117",
    "ctkg_domainconcept_fef4835248def04a043183ee",
    "ctkg_v3e-canonical-01549ef9b34888b89b55f224",
    "ctkg_v3e-canonical-04fd7f69994f8821467462e5",
]
checks: list[dict[str, object]] = []


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check(label: str, actual: float | str | bool, expected: float | str | bool, tolerance: float = 1e-6) -> None:
    if isinstance(actual, float) and isinstance(expected, float):
        if not math.isclose(actual, expected, rel_tol=tolerance, abs_tol=tolerance):
            raise AssertionError(f"{label}: {actual} != {expected}")
    elif actual != expected:
        raise AssertionError(f"{label}: {actual!r} != {expected!r}")
    checks.append({"check": label, "actual": actual, "expected": expected, "tolerance": tolerance})


def true(label: str, value: bool) -> None:
    if not value:
        raise AssertionError(label)
    checks.append({"check": label, "actual": True})


def git_sha(revision: str, path: str) -> str:
    return hashlib.sha256(
        subprocess.check_output(["git", "show", f"{revision}:{path}"], cwd=ROOT)
    ).hexdigest()


def clean_learning_text(value: str) -> str:
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = re.sub(r"\x60[^\x60]*\x60", "", value)
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
    assert isinstance(scope["cards"], list)
    check("exact card count", len(cards), 8)
    check("scope and inventory cards are identical", scope["cards"], cards)
    check("remaining is empty", inventory["remaining"], [])
    check("expected order sequence", [row["order"] for row in cards], EXPECTED_ORDERS)
    check("expected card IDs", [row["cardId"] for row in cards], EXPECTED_IDS)
    check("batch id", inventory["batchId"], "teaching-scale-01b")
    check("captured revision", inventory["capturedRevision"], "f655dee490f714247dea867602a4d42bf699f2fd")
    source_dir = BATCH
    previous_dir = BATCH / "previous"
    check("source backup count", len(list(source_dir.glob("*-source.json"))), 8)
    check("previous copy count", len(list(previous_dir.glob("*.md"))), 4)

    for index, row in enumerate(cards, start=1):
        card_id = row["cardId"]
        canonical_id = row["canonicalId"]
        card_path = ROOT / row["authoringPath"]
        true(f"card exists: {card_id}", card_path.is_file())
        check(f"card hash: {card_id}", sha(card_path), row["cardSha256"])
        expected_node_hash = hashlib.sha256(canonical_id.encode()).hexdigest()
        detail, neighborhood = row["sources"][:2]
        true(
            f"detail derived from canonicalId: {card_id}",
            detail["path"].endswith(f"details/node-{expected_node_hash}.json"),
        )
        true(
            f"neighborhood derived from canonicalId: {card_id}",
            neighborhood["path"].endswith(f"neighborhoods/node-{expected_node_hash}.json"),
        )
        for source in row["sources"][:2]:
            source_path = ROOT / source["path"]
            true(f"source exists: {source['path']}", source_path.is_file())
            check(f"source hash: {source['path']}", sha(source_path), source["sha256"])
            check(f"source revision: {source['path']}", source["revision"], inventory["capturedRevision"])

        backup_path = ROOT / row["sourceBackupPath"]
        true(f"source backup exists: {row['sourceBackupPath']}", backup_path.is_file())
        check(f"source backup hash: {card_id}", sha(backup_path), row["sourceBackupSha256"])
        backup = json.loads(backup_path.read_text(encoding="utf-8"))
        check(f"backup node identity: {card_id}", backup["node"]["id"], canonical_id)
        check(f"backup neighborhood identity: {card_id}", backup["neighborhood"]["nodeId"], canonical_id)
        check(f"backup source list: {card_id}", backup["sources"], row["sources"])

        extra = row["sources"][2]
        if row["previousCardSha256"]:
            previous_path = ROOT / extra["path"]
            true(f"previous copy exists: {card_id}", previous_path.is_file())
            check(f"previous copy hash: {card_id}", sha(previous_path), row["previousCardSha256"])
            check(f"previous source kind: {card_id}", extra["kind"], "previous-authoring-snapshot")
        else:
            true(f"fixed Git source has revision: {card_id}", bool(extra.get("revision")))
            check(f"fixed Git source hash: {card_id}", git_sha(extra["revision"], extra["path"]), extra["sha256"])
            check(f"fixed Git source path is outside batch: {card_id}", extra["path"].startswith("course-content/authoring/knowledge/cards/nodes/"), True)

        check(f"backup numbering: {card_id}", row["sourceBackupPath"], f"course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01b/{index:02d}-source.json")

    return cards


def verify_markdown(cards: list[dict[str, object]]) -> None:
    for row in cards:
        text = (ROOT / row["authoringPath"]).read_text(encoding="utf-8")
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
            "### 自检",
            "核对要点",
            "### 关联节点",
        ):
            true(f"{marker}: {row['cardId']}", marker in text)
        true(f"exactly two self-checks: {row['cardId']}", body.count("\n1. ") == 1 and body.count("\n2. ") == 1)
        detail = body.split("### 完整解释", 1)[1].split("### 关联节点", 1)[0]
        cleaned = clean_learning_text(detail)
        check(f"parsed explanation chars: {row['cardId']}", len(cleaned), row["parsedExplanationChars"])
        true(f"substantive explanation: {row['cardId']}", len(cleaned) >= 900)
        true(
            f"body has no authority or repository paths: {row['cardId']}",
            "course-content/" not in body and "ctkg:" not in body and "ctc:" not in body,
        )


def verify_examples() -> None:
    close = lambda label, actual, expected, tolerance=1e-9: check(label, float(actual), float(expected), tolerance)
    close("数学模型液位 at t=2 from h0=0", 1 - math.exp(-1), 0.6321205588)
    close("数学模型液位 at t=2 from h0=0.4", 1 - 0.6 * math.exp(-1), 0.7792723352971346)
    for t in [0, 0.5, 2]:
        natural = math.exp(-t)
        true(f"nonzero fixed initial state is not input-only superposition at {t}", not math.isclose(natural, 2 * natural))
        # Joint superposition combines both initial state and input amplitude.
        response = lambda x0, u: x0 * math.exp(-t) + 2 * u * (1 - math.exp(-t))
        close(f"joint state/input superposition at {t}", response(2 * 1 - 3 * 4, 2 * 5 - 3 * 2), 2 * response(1, 5) - 3 * response(4, 2))
    close("常系数线性定常系统 output at t=1", 2 * (1 - math.exp(-1)), 1.2642411177)
    close("反馈 reference DC gain", 2 / 3, 0.6666666667)
    close("反馈 output-disturbance DC gain", 1 / 3, 0.3333333333)
    close("反馈 measurement-noise DC gain", -2 / 3, -0.6666666667)
    close("反馈 closed-loop pole", -3, -3, 0.0)
    close("扰动抑制 sensitivity at zero", 1 / (1 + 9), 0.1, 0.0)
    close("扰动抑制 output-disturbance residual", 1 / 10, 0.1, 0.0)
    close("扰动抑制 plant-input residual", 3 / 10, 0.3, 0.0)
    close("扰动抑制 measurement-noise magnitude", -9 / 10, -0.9, 0.0)
    for omega in [0, 1, 10]:
        plant, controller, sensor = 3 / (1 + 1j * omega), 3, 2
        # Solve original signal equations y=P(Ce+d), e=-Hy, with d=1.
        y, error = np.linalg.solve(np.array([[1, -plant * controller], [sensor, 1]], dtype=complex), np.array([plant, 0]))
        sensitivity = 1 / (1 + controller * plant * sensor)
        close(f"nonunit-H plant-input output at {omega}", abs(y - plant * sensitivity), 0)
        close(f"nonunit-H plant-input error at {omega}", abs(error + sensor * plant * sensitivity), 0)
    close("nonunit-H DC error", -6 / 19, -0.3157894736842105)
    nominal = 9 / 10
    changed = 9.9 / 10.9
    close("参数不确定性 nominal DC output", nominal, 0.9, 0.0)
    close("参数不确定性 exact relative change", (changed - nominal) / nominal, 0.0091743119)
    close("参数不确定性 local sensitivity estimate", (1 / 10) * 0.1, 0.01)
    close("闭环系统 DC output", 4 / 6, 0.6666666667)
    close("闭环系统 closed pole", -6, -6, 0.0)
    close("闭环系统 feedback-stabilized pole", -1, -1, 0.0)
    close("终值定理 step error", 1 / 6, 0.1666666667)
    ramp_denominator = np.polymul([1, 0], [1, 6])
    ramp_poles = np.roots(ramp_denominator)
    true("ramp sE has genuine uncancelled origin pole", any(abs(p) < 1e-12 for p in ramp_poles) and np.polyval([1, 1], 0) != 0)
    true("ramp sE other pole is stable", any(abs(p + 6) < 1e-12 for p in ramp_poles))
    for sample in [0.5, 1, 2, 1j]:
        from_loop = sample * (1 / sample**2) / (1 + 5 / (sample + 1))
        from_rational = np.polyval([1, 1], sample) / np.polyval(ramp_denominator, sample)
        close(f"ramp sE derived from loop at {sample}", abs(from_loop - from_rational), 0)
    close("单边拉普拉斯 nonzero-initial response at t=1", 0.5 + 0.5 * math.exp(-2), 0.5676676416)
    close("单边拉普拉斯 zero-initial response at t=1", 0.5 * (1 - math.exp(-2)), 0.4323323584)


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
    with tempfile.TemporaryDirectory(prefix="teaching-scale-01b-parser-") as temp:
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
    true("KaTeX rendered formulas", output["formulaCount"] >= 20)
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
        "method": "independent Python numerical examples, source/card SHA-256, temporary runtime-shaped existing learner-card parser and KaTeX",
        "runtimeWritten": False,
    }
    write_json_batched(BATCH / "numerical-verification.json", {"report": report, "checks": checks})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
