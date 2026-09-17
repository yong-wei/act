"""Verify the seven teaching-scale-01e authoring candidates without runtime writes."""
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
from scipy.integrate import quad, solve_ivp

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
CAPTURED_REVISION = "f655dee490f714247dea867602a4d42bf699f2fd"
SNAPSHOT_ID = "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
SNAPSHOT_HASH = SNAPSHOT_ID.removeprefix("snap-")
RELEASE_ID = "ctr:release:control-theory-engineering-v0.48"
EXPECTED_IDS = [
    "ctkg:v3e-canonical-7e46e083227dc119d597d82b",
    "ctkg:v3e-object-38d4679bf3335318b0f4afb7",
    "ctkg:v3e-object-3af39a858b2949296df5387f",
    "ctkg:v3e-object-de873c97a924107857f79242",
    "ctkg:v3e-object-ee4c217b305b05786c0b89a9",
    "ctkg:v3e-object-0ca481aed329f4e6c74c8d30",
    "ctkg:v3e-object-e80f5d56ce06409842363584",
]
checks: list[dict[str, object]] = []


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_sha(revision: str, path: str) -> str:
    return hashlib.sha256(subprocess.check_output(["git", "show", f"{revision}:{path}"], cwd=ROOT)).hexdigest()


def true(label: str, value: bool) -> None:
    if not value:
        raise AssertionError(label)
    checks.append({"check": label, "actual": True})


def close(label: str, actual: object, expected: object, tolerance: float = 1e-7) -> None:
    if not np.allclose(actual, expected, rtol=tolerance, atol=tolerance):
        raise AssertionError(f"{label}: {actual!r} != {expected!r}")
    def serial(value: object) -> object:
        array = np.asarray(value)
        if np.iscomplexobj(array):
            if array.ndim == 0:
                return [float(array.real), float(array.imag)]
            return np.stack([array.real, array.imag], axis=-1).tolist()
        return array.tolist()
    checks.append({"check": label, "actual": serial(actual), "expected": serial(expected), "tolerance": tolerance})


def clean_learning_text(value: str) -> str:
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = re.sub(r"`[^`]*`", "", value)
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


def verify_identity(inventory: dict[str, object], scope: dict[str, object]) -> list[dict[str, object]]:
    cards = inventory["cards"]
    assert isinstance(cards, list)
    scope_cards = scope["cards"]
    assert isinstance(scope_cards, list)
    true("exact seven cards", len(cards) == 7)
    true("scope canonical IDs", [r["canonicalId"] for r in scope_cards] == EXPECTED_IDS)
    true("inventory canonical IDs", [r["canonicalId"] for r in cards] == EXPECTED_IDS)
    true("inventory remaining is empty", inventory["remaining"] == [])
    true("scope lifecycle known", scope["status"] in ["pending-independent-review", "accepted"])
    accepted_scope = json.loads((BATCH / "accepted-scope.json").read_text())
    true("accepted scope lifecycle agrees", accepted_scope["accepted"] == (scope["status"] == "accepted"))
    if accepted_scope["accepted"]:
        review = json.loads((BATCH / "review-acceptance.json").read_text())
        true("accepted independent review", review["status"] == "accepted")
        true("accepted exact card hashes", review["cardHashes"] == {r["canonicalId"]: r["cardSha256"] for r in inventory["cards"]})
    true("captured v0.48 revision", inventory["capturedRevision"] == CAPTURED_REVISION)
    true("source backup count", len(list(BATCH.glob("*-source.json"))) == 7)
    true("previous copy count", len(list((BATCH / "previous").glob("*.md"))) == 7)

    for row in cards:
        card_id = row["cardId"]
        canonical_id = row["canonicalId"]
        true(f"derived card ID: {card_id}", card_id == canonical_id.replace(":", "_"))
        card_path = ROOT / row["authoringPath"]
        true(f"card exists: {card_id}", card_path.is_file())
        true(f"card hash: {card_id}", sha(card_path) == row["cardSha256"])
        expected_hash = hashlib.sha256(canonical_id.encode()).hexdigest()
        sources = row["sources"]
        true(f"three sources: {card_id}", len(sources) == 3)
        true(f"detail path derived: {card_id}", sources[0]["path"].endswith(f"details/node-{expected_hash}.json"))
        true(f"neighborhood path derived: {card_id}", sources[1]["path"].endswith(f"neighborhoods/node-{expected_hash}.json"))
        for source in sources[:2]:
            source_path = ROOT / source["path"]
            true(f"source exists: {source['path']}", source_path.is_file())
            true(f"source hash: {source['path']}", sha(source_path) == source["sha256"])
            true(f"source revision: {source['path']}", source["revision"] == CAPTURED_REVISION)
            true(f"source git hash: {source['path']}", git_sha(source["revision"], source["path"]) == source["sha256"])
            shard = json.loads(source_path.read_text(encoding="utf-8"))
            true(f"source snapshot: {source['path']}", shard["envelope"]["authority"]["snapshotId"] == SNAPSHOT_ID)
            true(f"source release: {source['path']}", shard["envelope"]["authority"]["releaseId"] == RELEASE_ID)
        backup_path = ROOT / row["sourceBackupPath"]
        true(f"source backup exists: {card_id}", backup_path.is_file())
        true(f"source backup hash: {card_id}", sha(backup_path) == row["sourceBackupSha256"])
        backup = json.loads(backup_path.read_text(encoding="utf-8"))
        true(f"backup canonical identity: {card_id}", backup["canonicalId"] == canonical_id)
        true(f"backup node identity: {card_id}", backup["detail"]["node"]["id"] == canonical_id)
        true(f"backup neighborhood identity: {card_id}", backup["neighborhood"]["nodeId"] == canonical_id)
        true(f"backup source list: {card_id}", backup["sources"] == sources)
        previous_path = ROOT / sources[2]["path"]
        true(f"previous hash: {card_id}", previous_path.is_file() and sha(previous_path) == row["previousCardSha256"])
        text = card_path.read_text(encoding="utf-8")
        source_docs = re.findall(r'^  - "([^"\n]+)"$', text.split("source_docs:\n", 1)[1].split("asset_refs:", 1)[0], re.M)
        true(f"frontmatter source_docs exact: {card_id}", source_docs == [s["path"] for s in sources])
        true(f"frontmatter sources exist: {card_id}", all((ROOT / path).is_file() for path in source_docs))
        true(f"frontmatter snapshot exact: {card_id}", f'authority_snapshot_hash: "{SNAPSHOT_HASH}"' in text)
        for marker in ("card_version: 3", "status: ready", "## 首页", "## 详情", "### 完整解释", "### 教学计算/推理例", "### 适用条件与边界", "### 常见误区", "### 自检", "核对要点", "### 关联节点"):
            true(f"{marker}: {card_id}", marker in text)
        body = text.split("---", 2)[2]
        detail = body.split("### 完整解释", 1)[1].split("### 关联节点", 1)[0]
        cleaned = clean_learning_text(detail)
        close(f"parsed explanation chars: {card_id}", len(cleaned), row["parsedExplanationChars"], 0)
        true(f"explanation display completeness: {card_id}", len(cleaned) >= 900)
        misconceptions = body.split("### 常见误区", 1)[1].split("### 自检", 1)[0]
        self_check = body.split("### 自检", 1)[1].split("### 关联节点", 1)[0]
        true(f"two misconceptions: {card_id}", misconceptions.count("\n1. ") == 1 and misconceptions.count("\n2. ") == 1)
        true(f"two self-checks: {card_id}", self_check.count("\n1. ") == 1 and self_check.count("\n2. ") == 1)
        true(f"no authority paths in body: {card_id}", not re.search(r"(?:ctkg:|ctc:|course-content/)", body))
        relation_input = json.loads((BATCH / "relation-verification-input.json").read_text())
        declared = next(c["relations"] for c in relation_input["cards"] if c["canonicalId"] == canonical_id)
        neighborhood = json.loads((ROOT / sources[1]["path"]).read_text())
        objects = {o["id"]: o["label"] for o in neighborhood["objects"]}
        actual_lines = [line for line in body.split("### 关联节点", 1)[1].splitlines() if line.startswith("- ")]
        true(f"all displayed relations covered: {card_id}", actual_lines == [r["renderedLine"] for r in declared])
        for entry in declared:
            relation = next(r for r in neighborhood["relations"] if r["id"] == entry["relationId"])
            true("relation endpoints " + entry["relationId"], set([relation["sourceId"], relation["targetId"]]) == set([canonical_id, entry["otherId"]]))
            true("relation label " + entry["relationId"], objects[entry["otherId"]] == entry["label"])
            true("relation predicate " + entry["relationId"], relation["predicate"] == entry["predicate"])
            true("relation direction " + entry["relationId"], relation["direction"] == entry["direction"])
            relative = "无向" if relation["direction"] == "unordered" else ("出边" if relation["sourceId"] == canonical_id else "入边")
            predicate = {"association":"相关", "used_to_analyze":"用于分析", "applies_to":"适用于", "has_representation":"有表示"}[relation["predicate"]]
            true("rendered relation semantics " + entry["relationId"], entry["renderedLine"] == f'- **{objects[entry["otherId"]]}**（{relative}，关系：{predicate}）')
    return cards


def verify_examples() -> None:
    # ODE integration is independent of the card's closed-form display.
    t = np.linspace(0, 20, 4001)
    ode = solve_ivp(lambda time, state: [2 * np.sin(time) - state[0]], [0, 20], [0.0], t_eval=t, rtol=1e-10, atol=1e-12)
    late = t > 15
    design = np.column_stack([np.sin(t[late]), np.cos(t[late]), np.ones(late.sum())])
    coefficients, *_ = np.linalg.lstsq(design, ode.y[0, late], rcond=None)
    close("frequency-response ODE steady amplitude", np.hypot(coefficients[0], coefficients[1]), np.sqrt(2), 1e-5)
    close("frequency-response ODE phase", math.atan2(coefficients[1], coefficients[0]), -math.pi / 4, 1e-5)
    close("frequency-response complex ratio", 1 / (1 + 1j), 0.5 - 0.5j, 1e-12)

    # Fourier coefficients come from quadrature, not the displayed coefficient list.
    period = 2 * math.pi
    signal = lambda time: 1 + 2 * np.cos(time) + np.sin(2 * time)
    coeff = lambda k: quad(lambda time: float(signal(time) * np.exp(-1j * k * time).real), 0, period, epsabs=1e-11)[0] / period + 1j * quad(lambda time: float(signal(time) * np.exp(-1j * k * time).imag), 0, period, epsabs=1e-11)[0] / period
    c0, c1, c2, cm1, cm2 = [coeff(k) for k in [0, 1, 2, -1, -2]]
    close("Fourier DC coefficient", c0, 1, 1e-10)
    close("Fourier conjugate fundamental", [c1.real, cm1.real], [1, 1], 1e-10)
    close("Fourier second-harmonic magnitude", [abs(c2), abs(cm2)], [0.5, 0.5], 1e-10)
    close("single-sided DC stays un-doubled", abs(c0), 1, 1e-12)
    close("single-sided positive harmonic", 2 * abs(c1), 2, 1e-12)

    close("magnitude linear ratio", abs(1 / (1 + 2j)), 1 / math.sqrt(5), 1e-12)
    close("magnitude dB", 20 * math.log10(abs(1 / (1 + 2j))), -6.9897000434, 1e-9)
    close("steady-state output amplitude", 2 * abs(1 / (1 + 1j)), math.sqrt(2), 1e-12)

    # Derive the displayed experimental point from its declared ODE and input.
    sample_rate = 100.0
    omega = 2.0
    samples = np.arange(0, 20 + 10 * 2 * math.pi / omega, 1 / sample_rate)
    trace = solve_ivp(lambda time, state: [math.sin(omega * time) - state[0]],
                      [0, samples[-1]], [0.0], t_eval=samples, rtol=1e-10, atol=1e-12).y[0]
    keep = samples >= 20
    basis = np.column_stack([np.sin(omega * samples[keep]), np.cos(omega * samples[keep]), np.ones(keep.sum())])
    sine, cosine, offset = np.linalg.lstsq(basis, trace[keep], rcond=None)[0]
    ratio = sine + 1j * cosine
    close("declared ODE experimental complex ratio", ratio, 1 / (1 + 2j), 1e-8)
    close("declared ODE sampled magnitude", abs(ratio), 1 / math.sqrt(5), 1e-8)
    close("declared ODE sampled phase radians", np.angle(ratio), -math.atan(2), 1e-8)
    close("declared ODE sampled dB", 20 * math.log10(abs(ratio)), -6.9897000434, 1e-8)
    true("Nyquist bound uses Hz not angular frequency", omega / (2 * math.pi) < sample_rate / 2)
    alias_samples = np.arange(0, 10, 1 / sample_rate)
    aliased = np.sin(2 * math.pi * 58 * alias_samples)
    close("sampled alias frequency", abs(np.mean(aliased * np.exp(-1j * 2 * math.pi * 42 * alias_samples))), 0.5, 1e-3)

    # Multi-frequency method uses independently integrated ODE traces to form points.
    recovered = []
    for omega in [0.5, 1.0, 2.0]:
        end = 16 * 2 * math.pi / omega
        grid = np.linspace(0, end, 5000)
        response = solve_ivp(lambda time, state: [np.sin(omega * time) - state[0]], [0, end], [0.0], t_eval=grid, rtol=1e-9, atol=1e-11).y[0]
        keep = grid > end * 0.75
        basis = np.column_stack([np.sin(omega * grid[keep]), np.cos(omega * grid[keep])])
        a, b = np.linalg.lstsq(basis, response[keep], rcond=None)[0]
        recovered.append((math.hypot(a, b), math.atan2(b, a)))
    close("multi-frequency recovered magnitudes", [p[0] for p in recovered], [1 / math.sqrt(1.25), 1 / math.sqrt(2), 1 / math.sqrt(5)], 2e-4)
    close("multi-frequency recovered phases", [p[1] for p in recovered], [-math.atan(0.5), -math.atan(1), -math.atan(2)], 2e-4)


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
for (const row of inventory.cards) writeFileSync(join(target, row.cardId + '.md'), readFileSync(join(repoRoot, row.authoringPath)));
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
  if (!card || card.explanation.length < 900 || !card.explanation.includes('自检') || !card.explanation.includes('核对要点')) throw new Error('parser rejected card: ' + row.name);
  if (readPublishedLearnerCardByToken(row.cardId, 'content:' + '0'.repeat(64)) !== null) throw new Error('wrong content hash accepted: ' + row.name);
  if (/(?:ctkg:|ctc:|course-content\/)/u.test(card.explanation)) throw new Error('authority path leaked: ' + row.name);
  parsed.push({ cardId: row.cardId, explanationChars: card.explanation.length });
}
console.log(JSON.stringify({ cardCount: parsed.length, formulaCount, parsed }));
"""


def verify_parser_and_katex(cards: list[dict[str, object]]) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="teaching-scale-01e-parser-") as temp:
        env = os.environ.copy()
        env.update({"CARD_REPO_ROOT": str(ROOT), "CARD_PARSE_ROOT": temp, "CARD_INVENTORY": str(BATCH / "inventory.json")})
        result = subprocess.run(["npx", "tsx", "--eval", TS_VERIFY], cwd=ROOT, env=env, capture_output=True, text=True, check=True)
    parsed = json.loads(result.stdout.strip().splitlines()[-1])
    close("parser card count", parsed["cardCount"], len(cards), 0)
    true("KaTeX formula count", parsed["formulaCount"] >= 21)
    return parsed


def main() -> None:
    inventory = json.loads((BATCH / "inventory.json").read_text(encoding="utf-8"))
    scope = json.loads((BATCH / "scope.json").read_text(encoding="utf-8"))
    cards = verify_identity(inventory, scope)
    before = len(checks)
    verify_examples()
    numerical_count = len(checks) - before
    parser = verify_parser_and_katex(cards)
    report = {
        "status": "passed",
        "batchId": inventory["batchId"],
        "capturedRevision": inventory["capturedRevision"],
        "cardCount": len(cards),
        "cardIds": [row["cardId"] for row in cards],
        "cardHashes": {row["cardId"]: row["cardSha256"] for row in cards},
        "numericalCheckCount": numerical_count,
        "checkCount": len(checks),
        "parserCardCount": parser["cardCount"],
        "katexFormulaCount": parser["formulaCount"],
        "parserReadback": parser["parsed"],
        "method": "independent SciPy ODE integration, quadrature Fourier coefficients, complex evaluation, sampled phasor estimation and source/card SHA-256; parser runs in a temporary runtime-shaped directory",
        "runtimeWritten": False,
        "reviewStatus": scope["status"],
    }
    write_json_batched(BATCH / "numerical-verification.json", {"report": report, "checks": checks})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
