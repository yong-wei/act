"""Verify teaching-core-05a authoring cards without runtime writes.
The captured model report is intentionally read-only: verify-models.py writes its
report, so this verifier checks and reuses the already-passed report instead of
executing it again.
"""
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
CAPTURED_REVISION = "f655dee490f714247dea867602a4d42bf699f2fd"
SNAPSHOT_ID = "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
SNAPSHOT_HASH = SNAPSHOT_ID.removeprefix("snap-")
RELEASE_ID = "ctr:release:control-theory-engineering-v0.48"
REVIEW_STATUS = "pending-independent-review"
EXPECTED_IDS = [
    "ctc:modeling-1a01abb71d037ed52c2bc394",
    "ctc:modeling-2088bbde171b2e9ef66070d5",
    "ctc:modeling-239e401e0fcc8485f3a0533d",
    "ctc:modeling-7aef273143199795496abedb",
    "ctc:modeling-bddaef2510e39cbb62d60df2",
    "ctc:modeling-c499b71d908bd8fe4124c533",
    "ctc:modeling-e442dacbfef4a0d7ea3c4c15",
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
def relation_checks(
    card_text: str,
    row: dict[str, object],
    neighborhood: dict[str, object],
) -> None:
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
            raise AssertionError(
                f"relation endpoint does not contain {current}: {relation['id']}"
            )
        label = objects[other]
        display = "$" + label + "$" if label.startswith("\\") else "**" + label + "**"
        expected_lines.append(
            f"- {display}（{relative}，关系：{PREDICATE_LABELS[relation['predicate']]}）"
        )
    body = card_text.split("---", 2)[2]
    relation_section = body.split("### 关联节点", 1)[1]
    actual_lines = [
        line for line in relation_section.splitlines() if line.startswith("- ")
    ]
    true(f"relation rendering exact: {row['cardId']}", actual_lines == expected_lines)
def model_claim_checks(
    cards: list[dict[str, object]],
    report: dict[str, object],
) -> None:
    true("fixed model report passed", report["status"] == "passed")
    true("fixed model stage", report["stage"] == "models-before-authoring")
    models = report["models"]
    structural = models["structural_model"]
    true("structural plant exact", structural["plant"] == "G=2/(s+1)")
    true("structural sensor exact", structural["sensor"] == "H=0.5")
    true(
        "structural equations exact",
        structural["equations"] == ["e=r-0.5y", "y_dot=2e-y"],
    )
    true("structural transfer exact", structural["closedTransfer"] == "2/(s+2)")
    true("structural step exact", structural["unitStep"] == "1-exp(-2t)")
    true("structural zero initial", structural["zeroInitialState"] is True)
    reduction = models["reduction_with_disturbance"]
    true(
        "reduction blocks exact",
        reduction["blocks"] == ["G1=1/(s+1)", "G2=2/(s+2)"],
    )
    true(
        "reduction signal equations exact",
        reduction["signalEquations"]
        == ["e=r-y", "v=G1 e", "w=v+d", "y=G2 w"],
    )
    true(
        "reduction state equations exact",
        reduction["stateEquations"]
        == ["v_dot=r-y-v", "y_dot=2(v+d)-2y"],
    )
    true("reduction Y/R exact", reduction["Y_over_R"] == "2/(s^2+3s+4)")
    true(
        "reduction Y/D exact",
        reduction["Y_over_D"] == "2(s+1)/(s^2+3s+4)",
    )
    true("reference initial slope exact", reduction["initialOutputSlopeForUnitR"] == 0)
    true("disturbance initial slope exact", reduction["initialOutputSlopeForUnitD"] == 2)
    true("both final outputs exact", reduction["bothUnitStepFinalOutputs"] == 0.5)
    movement = models["algebraic_movement"]
    true("movement G exact", movement["G"] == 2)
    true("movement a exact", movement["a"] == 1)
    true("movement b exact", movement["b"] == 3)
    true("sum before exact", movement["sumBefore"] == "y=2(a+b)=8")
    true("sum moved after exact", movement["equivalentAfter"] == "y=2a+2b=8")
    true("sum after exact", movement["sumAfter"] == "y=2a+b=5")
    true(
        "sum moved before exact",
        movement["equivalentBefore"] == "y=2(a+b/2)=5",
    )
    true(
        "takeoff movement exact",
        movement["takeoffBeforeMovedAfter"]
        == "if z=2a and branch must remain a, branch=z/2",
    )
    block = models["block"]
    true("block transfer exact", block["transfer"] == "2/(s+1)")
    true("block equation exact", block["equation"] == "y_dot+y=2u")
    true(
        "block zero-state step exact",
        block["unitStepZeroState"] == "2(1-exp(-t))",
    )
    true(
        "block nonzero-state step exact",
        block["unitStepFromY0_1"] == "2-exp(-t)",
    )
    drawing = models["drawing_loaded_rc"]
    true(
        "drawing components exact",
        drawing["components"] == "R1=R2=1 ohm, C1=C2=1 F",
    )
    true(
        "drawing state equations exact",
        drawing["stateEquations"] == ["v1_dot=u-2v1+v2", "v2_dot=v1-v2"],
    )
    true(
        "drawing integrator inputs exact",
        drawing["integratorInputs"] == ["u-2v1+v2", "v1-v2"],
    )
    true("drawing transfer exact", drawing["transfer"] == "1/(s^2+3s+1)")
    true("drawing isolated product exact", drawing["isolatedProduct"] == "1/(s+1)^2")
    feedback = models["feedback"]
    true("feedback G exact", feedback["G"] == "2/(s+1)")
    true("feedback H exact", feedback["H"] == 0.5)
    true(
        "feedback negative transfer exact",
        feedback["negativeFeedback"] == "2/(s+2)",
    )
    true(
        "feedback positive transfer exact",
        feedback["positiveFeedback"] == "2/s",
    )
    true(
        "feedback positive step exact",
        feedback["positiveFeedbackUnitStep"] == "2t; no finite steady state",
    )
    loop = models["algebraic_loop"]
    true("loop static gain exact", loop["staticG"] == 2)
    true("loop positive feedback H exact", loop["positiveFeedbackH"] == 0.5)
    true(
        "loop equations exact",
        loop["equations"] == ["e=r+0.5y", "y=2e"],
    )
    true("loop eliminated equation exact", loop["eliminatedEquation"] == "0=2r")
    true("loop nonzero input exact", loop["nonzeroR"] == "no solution")
    true("loop zero input exact", loop["zeroR"] == "nonunique solutions")
    by_id = {
        row["cardId"]: (ROOT / row["authoringPath"]).read_text(encoding="utf-8")
        for row in cards
    }
    snippets = {
        cards[0]["cardId"]: [
            r"G(s)=\frac{2}{s+1}",
            r"\dot y+y=2e",
            r"\frac{Y}{R}=\frac{2}{s+2}",
            r"y(t)=1-e^{-2t}",
        ],
        cards[1]["cardId"]: [
            r"\left(s^2+3s+4\right)Y=2R+2(s+1)D",
            r"\frac{Y}{R}=\frac{2}{s^2+3s+4}",
            r"\frac{Y}{D}=\frac{2(s+1)}{s^2+3s+4}",
            r"初始输出斜率为 $0$",
            r"初始输出斜率为 $2$",
        ],
        cards[2]["cardId"]: [
            r"\left(s^2+3s+4\right)Y=2R+2(s+1)D",
            r"R,D,Y",
            r"内部变量",
            r"外部传递函数相同",
        ],
        cards[3]["cardId"]: [
            r"2(a+b)=2a+2b=8",
            r"2a+b=2(a+b/2)=5",
            r"y=2a+2b=2\cdot1+2\cdot3=8",
            r"y=2\left(a+\frac{b}{2}\right)=2\left(1+\frac{3}{2}\right)=5",
            r"\frac{z}{2}=\frac{2a}{2}=a",
        ],
        cards[4]["cardId"]: [
            r"\dot y+y=2u",
            r"2\left(1-e^{-t}\right)",
            r"2-e^{-t}",
            r"Y(s)=G(s)U(s)",
        ],
        cards[5]["cardId"]: [
            r"\dot v_1=u-2v_1+v_2",
            r"\dot v_2=v_1-v_2",
            r"\frac{V_2}{U}",
            r"\frac{1}{s^2+3s+1}",
            r"1/(s+1)^2",
            r"负载效应",
        ],
        cards[6]["cardId"]: [
            r"\frac{Y}{R}=\frac{2}{s+2}",
            r"\frac{Y}{R}=\frac{2}{s}",
            r"y(t)=2t",
            r"0=2r",
            r"r\ne0",
            r"1-GH=0",
        ],
    }
    for card_id, required in snippets.items():
        for snippet in required:
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
    with tempfile.TemporaryDirectory(prefix="teaching-core-05a-parser-") as temp:
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
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr)
    parsed = json.loads(result.stdout.strip().splitlines()[-1])
    true("parser card count", parsed["cardCount"] == len(cards))
    true("KaTeX formula count", parsed["formulaCount"] >= 30)
    return parsed
def main() -> None:
    scope = json.loads((BATCH / "scope.json").read_text(encoding="utf-8"))
    source_inventory = json.loads(
        (BATCH / "source-inventory.json").read_text(encoding="utf-8")
    )
    accepted = json.loads((BATCH / "accepted-scope.json").read_text(encoding="utf-8"))
    true("exact seven scope cards", len(scope["cards"]) == 7)
    true(
        "scope IDs exact",
        [row["canonicalId"] for row in scope["cards"]] == EXPECTED_IDS,
    )
    true(
        "source inventory IDs exact",
        [row["canonicalId"] for row in source_inventory["cards"]] == EXPECTED_IDS,
    )
    true("scope lifecycle is authoring", scope["status"] == "authoring")
    true(
        "accepted scope remains pending",
        accepted["status"] == REVIEW_STATUS and accepted["accepted"] is False,
    )
    true("captured revision exact", source_inventory["capturedRevision"] == CAPTURED_REVISION)
    true(
        "authority snapshot exact",
        source_inventory["authority"]["snapshotId"] == SNAPSHOT_ID,
    )
    true("authority release exact", source_inventory["authority"]["releaseId"] == RELEASE_ID)
    true("source backup count", len(list(BATCH.glob("*-source.json"))) == 7)
    true("previous copy count", len(list((BATCH / "previous").glob("*.md"))) == 7)
    cards: list[dict[str, object]] = []
    for row in source_inventory["cards"]:
        card_id = row["cardId"]
        card_path = ROOT / row["authoringPath"]
        card_text = card_path.read_text(encoding="utf-8")
        true(f"card exists: {card_id}", card_path.is_file())
        true(f"card identity: {card_id}", card_id == row["canonicalId"].replace(":", "_"))
        true(
            f"card canonical frontmatter: {card_id}",
            f'authority_entity_id: "{row["canonicalId"]}"' in card_text,
        )
        true(f"card name frontmatter: {card_id}", f'name: "{row["name"]}"' in card_text)
        true(f"card release: {card_id}", f'authority_release_id: "{RELEASE_ID}"' in card_text)
        true(
            f"card snapshot id: {card_id}",
            f'authority_snapshot_id: "{SNAPSHOT_ID}"' in card_text,
        )
        true(
            f"card snapshot: {card_id}",
            f'authority_snapshot_hash: "{SNAPSHOT_HASH}"' in card_text,
        )
        true(
            f"card status: {card_id}",
            "card_version: 3" in card_text and "status: ready" in card_text,
        )
        declared = declared_source_docs(card_text)
        true(
            f"source_docs exact: {card_id}",
            declared == [source["path"] for source in row["sources"]],
        )
        true(
            f"source_docs exist: {card_id}",
            all((ROOT / path).is_file() for path in declared),
        )
        for source in row["sources"][:2]:
            source_path = ROOT / source["path"]
            true(f"source hash: {source['path']}", sha(source_path) == source["sha256"])
            true(
                f"source revision: {source['path']}",
                source["revision"] == CAPTURED_REVISION,
            )
            true(
                f"source git hash: {source['path']}",
                git_sha(source["revision"], source["path"]) == source["sha256"],
            )
            shard = json.loads(source_path.read_text(encoding="utf-8"))
            true(
                f"source snapshot: {source['path']}",
                shard["envelope"]["authority"]["snapshotId"] == SNAPSHOT_ID,
            )
            true(
                f"source release: {source['path']}",
                shard["envelope"]["authority"]["releaseId"] == RELEASE_ID,
            )
        backup_path = ROOT / row["sourceBackupPath"]
        true(f"source backup hash: {card_id}", sha(backup_path) == row["sourceBackupSha256"])
        previous_path = ROOT / row["sources"][2]["path"]
        true(f"previous hash: {card_id}", sha(previous_path) == row["previousCardSha256"])
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
        true(
            f"two misconceptions: {card_id}",
            misconceptions.count("\n1. ") == 1 and misconceptions.count("\n2. ") == 1,
        )
        true(
            f"two self-checks: {card_id}",
            self_check.count("\n1. ") == 1 and self_check.count("\n2. ") == 1,
        )
        true(
            f"no authority paths in body: {card_id}",
            not re.search(r"(?:ctkg:|ctc:|course-content/)", body),
        )
        neighborhood = json.loads(
            (ROOT / row["sources"][1]["path"]).read_text(encoding="utf-8")
        )
        true(f"neighborhood identity: {card_id}", neighborhood["nodeId"] == row["canonicalId"])
        relation_checks(card_text, row, neighborhood)
        body_path = BATCH / "bodies" / f"{row['order']:02d}.md"
        body_path.write_text(body.strip() + "\n", encoding="utf-8")
        true(
            f"body materialized: {card_id}",
            body_path.read_text(encoding="utf-8").strip() == body.strip(),
        )
        item = dict(row)
        item["cardSha256"] = sha(card_path)
        item["parsedExplanationChars"] = parsed_chars
        cards.append(item)
    model_report = json.loads((BATCH / "model-verification.json").read_text(encoding="utf-8"))
    model_claim_checks(cards, model_report)
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
        "checkCount": len(CHECKS),
        "method": "source and SHA-256 identity, immutable-neighborhood relation verification, fixed model report, actual learner-card parser and KaTeX",
        "runtimeWritten": False,
        "reviewStatus": REVIEW_STATUS,
    }
    write_json_batched(
        BATCH / "numerical-verification.json",
        {"report": report, "checks": CHECKS},
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
if __name__ == "__main__":
    main()
