"""Verify teaching-core-08a authoring cards without runtime writes."""
from __future__ import annotations

import hashlib
import json
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
    "ctc:modeling-71f0e8d834291c2c7d5e25b9",
    "ctc:modeling-8010502b57930c3dcb915af9",
    "ctc:modeling-v2r-split-8f6ccd6e0cf66fa155c20aeb",
    "ctc:v11g-95859dcad651c20058bf8726",
    "ctkg:m3-v1l:canonical-object:c5f7d0ab3bb3d165d6bbe99e",
    "ctkg:v3e-canonical-47995819305793bf4c946953",
    "ctkg:v3e-canonical-47a2e3c44742b45c55ac902d",
    "ctkg:v3e-canonical-7d2ba18dbf550046f8683e0d",
    "ctkg:v3e-canonical-ff87028e0a7bcda2c586a550",
]
PREDICATE_LABELS = {
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
CHECKS: list[dict[str, object]] = []


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_sha(revision: str, path: str) -> str:
    return hashlib.sha256(
        subprocess.check_output(["git", "show", f"{revision}:{path}"], cwd=ROOT)
    ).hexdigest()


def true(label: str, value: bool) -> None:
    if not value:
        raise AssertionError(label)
    CHECKS.append({"check": label, "actual": True})


def clean_learning_text(value: str) -> str:
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = re.sub(r"\x60[^\x60]*\x60", "", value)
    value = re.sub(r"\[(.*?)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"^#{1,6}\s+", "", value, flags=re.M)
    value = re.sub(r"[\t ]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def write_json_batched(path: Path, value: object) -> None:
    lines = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").splitlines(
        keepends=True
    )
    with path.open("w", encoding="utf-8") as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start : start + 300])


def declared_source_docs(card_text: str) -> list[str]:
    block = card_text.split("source_docs:\n", 1)[1].split("asset_refs:", 1)[0]
    return re.findall(r'^  - "([^"\n]+)"$', block, re.M)


def rendered_label(label: str) -> str:
    # Formula labels in captured neighborhoods may contain line breaks. Keep
    # their exact LaTeX tokens while rendering the relation as one Markdown line.
    label = re.sub(r"\s+", " ", label).strip()
    if label.startswith("\\"):
        return "$" + label + "$"
    return "**" + label + "**"


def relation_checks(card_text: str, row: dict[str, object], neighborhood: dict[str, object]) -> None:
    current = row["canonicalId"]
    objects = {item["id"]: item["label"] for item in neighborhood["objects"]}
    expected_lines: list[str] = []
    relations = neighborhood["relations"]
    for relation in relations:
        if relation["sourceId"] == current:
            other = relation["targetId"]
            relative = "无向" if relation["direction"] == "unordered" else "出边"
        elif relation["targetId"] == current:
            other = relation["sourceId"]
            relative = "无向" if relation["direction"] == "unordered" else "入边"
        else:
            raise AssertionError(f"relation endpoint does not contain {current}: {relation['id']}")
        true(f"relation predicate known: {relation['id']}", relation["predicate"] in PREDICATE_LABELS)
        expected_lines.append(
            f"- {rendered_label(objects[other])}（{relative}，关系：{PREDICATE_LABELS[relation['predicate']]}）"
        )
    body = card_text.split("---", 2)[2]
    relation_section = body.split("### 关联节点", 1)[1]
    actual_lines = [line for line in relation_section.splitlines() if line.startswith("- ")]
    true(f"relation rendering exact: {row['cardId']}", actual_lines == expected_lines)
    for relation in relations:
        true(f"relation endpoints: {relation['id']}", current in (relation["sourceId"], relation["targetId"]))
        true(f"relation direction present: {relation['id']}", relation["direction"] in {"unordered", "source_to_target", "earlier_to_later"})


def model_claim_checks(cards: list[dict[str, object]], report: dict[str, object]) -> None:
    true("fixed model report passed", report["status"] == "passed")
    true("fixed model stage", report["stage"] == "models-before-authoring")
    models = report["models"]
    strict = models["strictly_proper"]
    true("strict model exact", strict["G"] == "2/(s+1)" and strict["D"] == 0 and strict["unitStep"] == "2(1-exp(-t))")
    zero = models["zero"]
    true("zero model exact", zero["finiteZero"] == -2 and zero["poles"] == [-1, -3] and zero["initialStepSlope"] == 1)
    complex_poles = models["complex_frequency_poles"]
    true("complex pole model exact", complex_poles["poles"] == [[-1, 1], [-1, -1]] and complex_poles["impulse"] == "2exp(-t)sin(t)")
    open_zeros = models["open_loop_zeros"]
    true("open zero model exact", open_zeros["KCondition"] == "K>0" and open_zeros["openZero"] == -2 and open_zeros["openPoles"] == [0, -1])
    open_transfer = models["open_loop_transfer"]
    true("open transfer model exact", open_transfer["forwardTransfer"] == "2/((s+2)(s+1))" and [case["H"] for case in open_transfer["cases"]] == [1.0, 0.5])
    hidden = models["poles_and_hidden_modes"]
    true("hidden mode model exact", hidden["reducedTransfer"] == "1/(s+1)" and hidden["hiddenStateEigenvalue"] == 1 and hidden["zeroInputFrom1_0"] == ["exp(t)", "0"])
    closed_poles = models["closed_loop_poles"]
    true("closed pole model exact", closed_poles["loop"] == "K(s+2)/(s(s+1))" and [case["K"] for case in closed_poles["cases"]] == [1.0, 3.0])
    transmission = models["transmission_zero"]
    true("transmission zero model exact", transmission["normalRank"] == 2 and transmission["rankAtZero"] == 1 and transmission["systemMatrixRankAtZero"] == 3)
    closed_zeros = models["closed_loop_zeros"]
    true("closed zero model exact", closed_zeros["baselineZero"] == -2 and closed_zeros["filteredZeros"] == [-3, -2] and closed_zeros["addedReferenceChannelPole"] == -5)
    expected = {
        cards[0]["cardId"]: ["D=0", r"G(s)=\frac{2}{s+1}", "y(t)=2(1-e^{-t})", "D=1"],
        cards[1]["cardId"]: [r"G(s)=\frac{s+2}{(s+1)(s+3)}", "零点是 $-2$", "初始斜率为 $1$", "2/3"],
        cards[2]["cardId"]: [r"G(s)=\frac{2}{s^2+2s+2}", r"s=-1\pm j", r"h(t)=2e^{-t}\sin(t)", r"\cos(t)+\sin(t)"],
        cards[3]["cardId"]: [r"L(s)=\frac{K(s+2)}{s(s+1)}", "K>0", "开环零点 $s=-2$", "开环极点 $s=0$ 和 $s=-1$"],
        cards[4]["cardId"]: [r"F(s)=\frac{2}{(s+2)(s+1)}", "L(s)=F(s)H(s)", "H(s)=0.5", "s^2+3s+3"],
        cards[5]["cardId"]: [r"A=\operatorname{diag}(1,-1)", r"G(s)=\frac{1}{s+1}", r"\frac{s-1}{(s-1)(s+1)}", "x(t)=[e^t,0]"],
        cards[6]["cardId"]: ["K=1", "K=3", "s^2+2s+2", r"s=-2\pm j\sqrt{2}"],
        cards[7]["cardId"]: [r"G_m(s)=\operatorname{diag}", "正常秩为 $2$", "秩为 $3$", r"G_2(s)"],
        cards[8]["cardId"]: [r"T(s)=\frac{s+2}{s^2+2s+2}", r"F(s)=\frac{s+3}{s+5}", r"T_r(s)=\frac{(s+3)(s+2)}{(s+5)(s^2+2s+2)}", "直流增益仍为 $1$"],
    }
    true("nine model-backed topics", len(models) == 9)
    for row, snippets in zip(cards, expected.values()):
        text = (ROOT / row["authoringPath"]).read_text(encoding="utf-8")
        for snippet in snippets:
            true(f"model-backed claim {row['cardId']}: {snippet}", snippet in text)
        for formula in re.findall(r"\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$", text):
            true(
                "no bare spacing command: " + row["cardId"],
                not re.search(r"(?<!\\)\bqquad\b", "".join(formula)),
            )


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
    with tempfile.TemporaryDirectory(prefix="teaching-core-08a-parser-") as temp:
        env = os.environ.copy()
        env.update(
            {
                "CARD_REPO_ROOT": str(ROOT),
                "CARD_PARSE_ROOT": temp,
                "CARD_INVENTORY": str(BATCH / "inventory.json"),
            }
        )
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
    true("KaTeX formula count", parsed["formulaCount"] >= 35)
    return parsed


def main() -> None:
    scope = json.loads((BATCH / "scope.json").read_text(encoding="utf-8"))
    source_inventory = json.loads((BATCH / "source-inventory.json").read_text(encoding="utf-8"))
    accepted = json.loads((BATCH / "accepted-scope.json").read_text(encoding="utf-8"))
    true("exact nine scope cards", len(scope["cards"]) == 9)
    true("scope IDs exact", [row["canonicalId"] for row in scope["cards"]] == EXPECTED_IDS)
    true("source inventory IDs exact", [row["canonicalId"] for row in source_inventory["cards"]] == EXPECTED_IDS)
    true("scope lifecycle is authoring", scope["status"] == "authoring")
    true("accepted scope is an exact copy", accepted["cards"] == scope["cards"])
    true("accepted scope remains pending", accepted["status"] == REVIEW_STATUS and accepted["accepted"] is False)
    true("captured revision exact", source_inventory["capturedRevision"] == CAPTURED_REVISION)
    true("authority snapshot exact", source_inventory["authority"]["snapshotId"] == SNAPSHOT_ID)
    true("authority release exact", source_inventory["authority"]["releaseId"] == RELEASE_ID)
    true("source backup count", len(list(BATCH.glob("*-source.json"))) == 9)
    true("previous copy count", len(list((BATCH / "previous").glob("*.md"))) == 8)

    cards: list[dict[str, object]] = []
    for row in source_inventory["cards"]:
        card_id = row["cardId"]
        card_path = ROOT / row["authoringPath"]
        card_text = card_path.read_text(encoding="utf-8")
        true(f"card exists: {card_id}", card_path.is_file())
        true(f"card identity: {card_id}", card_id == row["canonicalId"].replace(":", "_"))
        true(
            f"authoring path exact: {card_id}",
            row["authoringPath"] == f"course-content/authoring/knowledge/cards/authority/nodes/{card_id}.md",
        )
        node_id = re.search(r'^node_id:\s*(.+)$', card_text, re.M)
        true(f"frontmatter node_id exact: {card_id}", bool(node_id) and node_id.group(1).strip().strip('"\'') == card_id)
        true(f"card canonical frontmatter: {card_id}", f'authority_entity_id: "{row["canonicalId"]}"' in card_text)
        true(f"card name frontmatter: {card_id}", f'name: "{row["name"]}"' in card_text)
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
        if row["previousCardSha256"] is not None:
            previous_path = ROOT / row["sources"][2]["path"]
            true(f"previous hash: {card_id}", sha(previous_path) == row["previousCardSha256"])
        else:
            true(f"no fabricated previous source: {card_id}", len(row["sources"]) == 2)
        body = card_text.split("---", 2)[2]
        for marker in (
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

    model_verification = json.loads((BATCH / "model-verification.json").read_text(encoding="utf-8"))
    model_claim_checks(cards, model_verification)

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
        "modelVerification": "captured model-verification.json passed",
        "modelClaimsChecked": True,
        "parserCardCount": parser["cardCount"],
        "katexFormulaCount": parser["formulaCount"],
        "parserReadback": parser["parsed"],
        "checkCount": len(CHECKS),
        "method": "source and SHA-256 identity, immutable-neighborhood relation verification, captured model verification, actual learner-card parser and KaTeX",
        "runtimeWritten": False,
        "reviewStatus": accepted["status"],
    }
    write_json_batched(BATCH / "numerical-verification.json", {"report": report, "checks": CHECKS})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
