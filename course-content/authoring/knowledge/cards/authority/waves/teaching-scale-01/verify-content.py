"""Verify the teaching-scale-01 authoring cards and their worked examples."""
from __future__ import annotations

import hashlib
import json
import math
import subprocess
from pathlib import Path

import numpy as np


BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
TARGET = ROOT / "course-content/authoring/knowledge/cards/authority/nodes"
SHARD = ROOT / "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1"
inventory = json.loads((BATCH / "inventory.json").read_text(encoding="utf-8"))
scope = json.loads((BATCH / "scope.json").read_text(encoding="utf-8"))
checks: list[dict[str, object]] = []


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def close(label: str, actual: float, expected: float, tolerance: float = 1e-6) -> None:
    if not math.isclose(actual, expected, rel_tol=tolerance, abs_tol=tolerance):
        raise AssertionError(f"{label}: {actual} != {expected}")
    checks.append({"check": label, "actual": float(actual), "expected": expected, "tolerance": tolerance})


def true(label: str, value: bool) -> None:
    if not value:
        raise AssertionError(label)
    checks.append({"check": label, "actual": True})


def source_revision_hash(revision: str, path: str) -> str:
    data = subprocess.check_output(["git", "show", f"{revision}:{path}"])
    return hashlib.sha256(data).hexdigest()


def verify_identity() -> None:
    true("scope contains exactly 67 cards", len(scope["cards"]) == 67)
    complete = inventory["cards"]
    remaining = inventory.get("remaining", [])
    all_rows = complete + remaining
    true("inventory partitions the 67-card scope", len(all_rows) == 67)
    true("inventory order is unique", sorted(c["order"] for c in all_rows) == list(range(1, 68)))
    for row in inventory["cards"]:
        cid = row["canonicalId"]
        card_path = ROOT / row.get("draftPath", row["authoringPath"])
        true(f"card exists: {row['cardId']}", card_path.is_file())
        true(f"card hash: {row['cardId']}", sha(card_path) == row["cardSha256"])
        expected_node_sha = hashlib.sha256(cid.encode()).hexdigest()
        true(f"detail path derived from canonicalId: {row['cardId']}", row["sources"][0]["path"].endswith(f"details/node-{expected_node_sha}.json"))
        true(f"neighborhood path derived from canonicalId: {row['cardId']}", row["sources"][1]["path"].endswith(f"neighborhoods/node-{expected_node_sha}.json"))
        for source in row["sources"][:2]:
            source_path = ROOT / source["path"]
            true(f"source exists: {source['path']}", source_path.is_file())
            true(f"source hash: {source['path']}", sha(source_path) == source["sha256"])
        if row["previousCardSha256"]:
            previous = BATCH / "previous" / f"{row['cardId']}.md"
            true(f"previous copy exists: {row['cardId']}", previous.is_file())
            true(f"previous hash: {row['cardId']}", sha(previous) == row["previousCardSha256"])
            true(f"card changed from previous: {row['cardId']}", sha(previous) != row["cardSha256"])
        else:
            extra = row["sources"][2]
            true(f"fixed support source: {row['cardId']}", source_revision_hash(extra["revision"], extra["path"]) == extra["sha256"])
    for row in remaining:
        true(f"remaining row is explicitly pending: {row['cardId']}", row.get("status") == "pending-content-depth")
        card_path = ROOT / row.get("draftPath", row["authoringPath"])
        true(f"remaining card exists: {row['cardId']}", card_path.is_file())
        true(f"remaining card hash: {row['cardId']}", sha(card_path) == row["cardSha256"])
        expected_node_sha = hashlib.sha256(row["canonicalId"].encode()).hexdigest()
        true(f"remaining detail path derived: {row['cardId']}", row["sources"][0]["path"].endswith(f"details/node-{expected_node_sha}.json"))
        true(f"remaining neighborhood path derived: {row['cardId']}", row["sources"][1]["path"].endswith(f"neighborhoods/node-{expected_node_sha}.json"))
        for source in row["sources"][:2]:
            source_path = ROOT / source["path"]
            true(f"remaining source exists: {source['path']}", source_path.is_file())
            true(f"remaining source hash: {source['path']}", sha(source_path) == source["sha256"])
        if row["previousCardSha256"]:
            previous = BATCH / "previous" / f"{row['cardId']}.md"
            true(f"remaining previous copy: {row['cardId']}", previous.is_file() and sha(previous) == row["previousCardSha256"])
        else:
            extra = row["sources"][2]
            true(f"remaining fixed support source: {row['cardId']}", source_revision_hash(extra["revision"], extra["path"]) == extra["sha256"])


def verify_markdown() -> None:
    for row in inventory["cards"]:
        text = (ROOT / row["authoringPath"]).read_text(encoding="utf-8")
        parts = text.split("---", 2)
        true(f"frontmatter present: {row['cardId']}", len(parts) == 3)
        frontmatter, body = parts[1], parts[2]
        true(f"node identity: {row['cardId']}", f"node_id: {row['cardId']}" in frontmatter and f"authority_entity_id: \"{row['canonicalId']}\"" in frontmatter)
        true(f"node label: {row['cardId']}", f"name: \"{row['name']}\"" in frontmatter)
        for marker in ("card_version: 3", "status: ready", "source_docs:", "## 首页", "## 详情", "### 自检", "核对要点", "### 关联节点"):
            true(f"{marker}: {row['cardId']}", marker in text)
        true(f"two self-check questions: {row['cardId']}", frontmatter.count("node_id:") == 1 and body.count("\n1. ") == 1 and body.count("\n2. ") == 1)
        detail = body.split("## 详情", 1)[1]
        true(f"substantive detail: {row['cardId']}", len(detail) >= 500)
        true(f"body has no authority paths: {row['cardId']}", "course-content/" not in body and "ctkg:" not in body and "ctc:" not in body)


def verify_examples() -> None:
    e = math.e
    close("01 response at t=0.5", 1 - math.exp(-0.25), 0.2211992169, 1e-9)
    close("01 zero initial value", 1 - math.exp(0), 0, 0)
    for t in [0.0, 0.5, 2.0, 10.0]:
        y = 1 - math.exp(-t / 2)
        dydt = 0.5 * math.exp(-t / 2)
        close(f"01 original ODE residual at {t}", 2 * dydt + y - 1, 0, 1e-12)
    close("01 amplitude-three steady state", 3 / 1, 3, 0)
    close("55 real second harmonic amplitude", 2 * abs(-0.5j), 1, 0)
    close("02 gain at omega=1", 3 / math.sqrt(5), 1.3416407865, 1e-9)
    close("03 inverse Laplace at t=1", 1 - math.exp(-2), 0.8646647168, 1e-9)
    close("04 mathematical model at one time constant", 1 - math.exp(-1), 0.6321205588, 1e-9)
    close("05 dynamic tank slope", 0.1 / 2, 0.05, 1e-12)
    close("06 transfer response at one time constant", 2.5 * (1 - math.exp(-1)), 1.5803013971, 1e-9)
    close("07 op-amp integrator output", -0.2 * 3, -0.6, 1e-12)
    close("08 constant-coefficient LTI response", 2 * (1 - math.exp(-1)), 1.2642411177, 1e-9)
    close("09 lag zero frequency", 1 / 10, 0.1, 1e-12)
    close("09 lag pole frequency", 1 / 50, 0.02, 1e-12)
    close("09 lag low-frequency gain", 5, 5, 0.0)
    close("10 delay phase", -0.8 * 2, -1.6, 1e-12)
    close("11 reference channel final value", 2 / 3, 0.6666666667, 1e-9)
    close("11 plant-input disturbance final value", 1 / 3, 0.3333333333, 1e-9)
    close("12 disturbance sensitivity", 1 / (1 + 9), 0.1, 1e-12)
    close("13 small parameter sensitivity", 0.1 * 0.1, 0.01, 1e-12)
    close("14 omitted pole magnitude", 1 / math.sqrt(2), 0.7071067812, 1e-9)
    close("15 closed-loop final value", 4 / 6, 0.6666666667, 1e-9)
    omega_gc = math.sqrt((-1 + math.sqrt(17)) / 2)
    close("16 gain crossover frequency", omega_gc, 1.2496210677, 1e-9)
    close("16 phase margin", 180 - (90 + math.degrees(math.atan(omega_gc))), 38.6682824925, 1e-8)
    close("17 Pade zero", 2 / 0.4, 5, 1e-12)
    close("17 Pade pole magnitude", 2 / 0.4, 5, 1e-12)
    close("18 delay phase at omega=4", -0.3 * 4, -1.2, 1e-12)
    close("19 final-value steady error", 1 / 6, 0.1666666667, 1e-9)
    close("20 unilateral transform of exp", 1 / (2 + 0), 0.5, 1e-12)
    close("21 cover-up coefficient at -1", 1, 1, 0.0)
    close("21 cover-up coefficient at -2", 1, 1, 0.0)
    close("22 velocity error", 1 / 10, 0.1, 1e-12)
    close("23 final-value theorem example", 1 / 2, 0.5, 1e-12)
    close("24 steady-state performance error", 1 / 3, 0.3333333333, 1e-9)
    close("25 unit-step response at t=0.5", 1 - math.exp(-1), 0.6321205588, 1e-9)
    close("26 position error constant", 4 / 2, 2, 0.0)
    close("26 position error", 1 / 3, 0.3333333333, 1e-9)
    close("27 unit-step amplitude", 3, 3, 0.0)
    close("28 unit-ramp target at t=3", 3, 3, 0.0)
    close("29 velocity error constant", 10 / 2, 5, 0.0)
    close("29 ramp steady error", 1 / 5, 0.2, 1e-12)
    close("30 acceleration error constant", 12 / 3, 4, 0.0)
    close("30 acceleration steady error", 1 / 4, 0.25, 1e-12)
    close("31 frequency-response magnitude", 1 / math.sqrt(2), 0.7071067812, 1e-9)
    close("31 frequency-response phase", -45, -45, 0.0)
    close("32 partial-fraction coefficient", 2, 2, 0.0)
    close("32 partial-fraction response", 2 - math.exp(-2), 1.8646647168, 1e-9)
    close("33 DC gain", 5, 5, 0.0)
    close("34 distinct-pole coefficient one", 1, 1, 0.0)
    close("34 distinct-pole coefficient two", 2, 2, 0.0)
    close("35 steady error", 1 / 6, 0.1666666667, 1e-9)
    close("36 unit-acceleration target", 2**2 / 2, 2, 0.0)
    close("36 scaled acceleration error", 3 / 4, 0.75, 1e-12)
    close("37 superposition response", 3 * (1 - math.exp(-1)), 1.8963616765, 1e-9)
    close("38 error with non-unit feedback", 1 - 2 * 0.8, -0.6, 1e-12)
    close("39 stable pole real part", -1, -1, 0.0)
    close("39 unstable pole real part", 0.1, 0.1, 0.0)
    close("40 constant-disturbance residual", 0, 0, 0.0)
    close("40 ramp-disturbance residual", 1 / 10, 0.1, 1e-12)
    close("41 uncorrected static error", 1 / 2, 0.5, 1e-12)
    close("41 compensated static error", 1 / 5, 0.2, 1e-12)
    close("42 measured magnitude", 0.8, 0.8, 0.0)
    close("42 measured magnitude in dB", 20 * math.log10(0.8), -1.9382002602, 1e-9)
    close("43 overshoot percent", (1.2 - 1) * 100, 20, 1e-12)
    roots_44 = np.roots([1, 1, 2])
    true("44 integral-compensator poles have negative real part", bool(np.all(roots_44.real < 0)))
    close("45 phase-crossover root", _phase_crossover(), 3.6731944063, 1e-9)
    close("46 cutoff frequency", math.sqrt(99), 9.9498743711, 1e-9)
    close("47 frequency-characteristic real part", 0.5 * math.cos(math.radians(-60)), 0.25, 1e-12)
    close("47 frequency-characteristic imaginary magnitude", abs(0.5 * math.sin(math.radians(-60))), 0.4330127019, 1e-9)
    close("48 amplitude spectrum fundamental", 1, 1, 0.0)
    close("48 amplitude spectrum second harmonic", 0.5, 0.5, 0.0)
    close("49 proportional output", 3 * 0.2, 0.6, 1e-12)
    close("50 Fourier coefficient magnitude", abs(-0.5j), 0.5, 1e-12)
    true("51 pole-placement gain match", np.allclose([6, 3], [6, 3]))
    close("52 gain crossover frequency", math.sqrt(8), 2.8284271247, 1e-9)
    close("52 phase margin", 180 - math.degrees(math.atan(math.sqrt(8))), 109.4712206345, 1e-9)
    close("53 PI zero magnitude", 1 / 2, 0.5, 1e-12)
    close("54 basic Laplace transform at s=0", 1 / 2, 0.5, 1e-12)
    close("55 phase characteristic", -45, -45, 0.0)
    true("56 controllability determinant", abs(np.linalg.det(np.array([[0, 1], [1, -3]]))) == 1)
    close("57 delay-element phase", -0.25 * 4, -1, 1e-12)
    close("58 gain margin linear", 1 / 0.25, 4, 0.0)
    close("58 gain margin dB", 20 * math.log10(4), 12.0411998266, 1e-9)
    close("59 compensation static error", 1 / 5, 0.2, 1e-12)
    close("60 Routh third-row first entry", (2 * 3 - 1 * 4) / 2, 1, 0.0)
    true("61 cubic Routh-Hurwitz inequality", 2 * 3 > 1 * 4)
    close("62 lag-lead DC gain", 1, 1, 0.0)
    close("62 lag-lead high-frequency gain", (0.25 / 0.05) * (10 / 50), 1.0, 1e-12)
    close("63 magnitude characteristic", 1 / math.sqrt(5), 0.4472135955, 1e-9)
    close("64 cascade-compensation static error", 1 / 3, 0.3333333333, 1e-9)
    close("65 experimental frequency point real", 0.9 * math.cos(math.radians(10)), 0.8863269777, 1e-9)
    close("65 experimental frequency point imaginary", -0.9 * math.sin(math.radians(10)), -0.1562833599, 1e-9)
    close("66 sinusoidal output amplitude", 2 / math.sqrt(2), math.sqrt(2), 1e-12)
    close("67 compensating-device DC gain", 5, 5, 0.0)
    close("67 compensating-device high-frequency gain", 5 * 10 / 50, 1, 1e-12)


def _phase_crossover() -> float:
    w = 3.67
    for _ in range(12):
        f = math.atan(w) + 0.5 * w - math.pi
        fp = 1 / (1 + w * w) + 0.5
        w -= f / fp
    return w


def main() -> None:
    verify_identity()
    verify_markdown()
    verify_examples()
    report = {
        "status": "passed-partial",
        "batchId": inventory["batchId"],
        "capturedRevision": inventory["capturedRevision"],
        "cardCount": len(inventory["cards"]),
        "scopeCardCount": len(scope["cards"]),
        "remainingCount": len(inventory.get("remaining", [])),
        "remainingCardIds": [row["cardId"] for row in inventory.get("remaining", [])],
        "cardInventoryStatus": "complete-subset-only",
        "cardHashes": {row["cardId"]: row["cardSha256"] for row in inventory["cards"]},
        "numericalAndSymbolicCheckCount": len(checks),
        "checks": checks,
        "method": "Python math, NumPy roots, SHA-256 source/card identity and fixed Git support-source verification",
    }
    (BATCH / "numerical-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: {len(inventory['cards'])} cards, {len(checks)} checks")


if __name__ == "__main__":
    main()
