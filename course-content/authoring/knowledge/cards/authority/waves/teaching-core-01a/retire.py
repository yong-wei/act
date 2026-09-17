"""Delete only explicitly replaced legacy cards after successful activation."""
import hashlib
import json
from pathlib import Path

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
def read(p): return json.loads(p.read_text())
def write(p, data):
    lines = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").splitlines(keepends=True)
    with p.open("w") as stream:
        for i in range(0, len(lines), 300): stream.writelines(lines[i:i+300])
receipt = read(BATCH / "integration.json")
assert receipt["status"] == "local-runtime-active"
current = read(ROOT / "course-content/runtime/knowledge/resource-bindings/current.json")
assert current["bindingReleaseId"] == receipt["bindingReleaseId"]
ledger_path = ROOT / "course-content/authoring/knowledge/resource-bindings/card-replacements.json"
ledger = read(ledger_path)
ledger_digest = hashlib.sha256(ledger_path.read_bytes()).hexdigest()
assert ledger_digest == receipt["replacementDigest"]
assert hashlib.sha256((BATCH / "inventory.json").read_bytes()).hexdigest() == receipt["inventoryDigest"]
ids = set(receipt["batchCanonicalIds"])
rows = [r for r in ledger["rows"] if r["canonicalId"] in ids]
release = ROOT / "course-content/runtime/knowledge/resource-bindings/releases" / current["bindingReleaseId"]
manifest = read(release / "binding-manifest.json")
assert manifest["sourceHashes"]["cardReplacements"] == ledger_digest
assert manifest["bindingHash"] == current["bindingHash"] == receipt["bindingHash"]
resources = {json.loads(l)["resourceId"] for l in (release / "resources.jsonl").read_text().splitlines() if l}
exclusion_path = ROOT / "course-content/authoring/knowledge/card-exclusions.json"
exclusions = read(exclusion_path)
excluded = {r["node_id"] for r in exclusions["exclusions"]}
previous = None
if (BATCH / "retirement.json").exists():
    previous = read(BATCH / "retirement.json")
    assert previous["bindingReleaseId"] == current["bindingReleaseId"]
    assert previous["replacementDigest"] == ledger_digest
    for entry in previous["entries"]:
        for file in entry["files"]:
            assert hashlib.sha256((ROOT / file["recoveryPath"]).read_bytes()).hexdigest() == file["sha256"]
    if previous.get("status") == "completed":
        assert all(not (ROOT / f["path"]).exists() for e in previous["entries"] for f in e["files"])
        print("Already retired; retained recovery evidence")
        raise SystemExit(0)
entries, replacements = [], {}
for row in rows:
    for resource_id in row["retiredResourceIds"]:
        assert resource_id not in resources
        token = resource_id.removeprefix("act:card:")
        assert "/" not in token and ".." not in token
        files = []
        for kind in ["authoring", "runtime"]:
            relative = f"course-content/{kind}/knowledge/cards/nodes/{token}.md"
            source = ROOT / relative
            if not source.exists(): continue
            data = source.read_bytes()
            backup = BATCH / "retired" / kind / f"{token}.md"
            backup.parent.mkdir(parents=True, exist_ok=True)
            if backup.exists(): assert backup.read_bytes() == data
            else: backup.write_bytes(data)
            files.append({"path": relative, "sha256": hashlib.sha256(data).hexdigest(), "recoveryPath": str(backup.relative_to(ROOT))})
        entries.append({"resourceId": resource_id, "canonicalId": row["canonicalId"], "files": files})
        replacements[f"course-content/runtime/knowledge/cards/nodes/{token}.md"] = f"course-content/runtime/knowledge/cards/authority/nodes/{row['cardId']}.md"
        if token not in excluded:
            exclusions["exclusions"].append({"node_id": token, "reason": f"已由 act:card:{row['cardId']} 替代；保留语义节点，旧独立卡退役。"})
            excluded.add(token)
# Reuse the full original manifest after interruption, including already deleted files.
if previous:
    assert {e["resourceId"] for e in entries} == {e["resourceId"] for e in previous["entries"]}
    entries = previous["entries"]
retirement = {"status": "prepared", "entries": entries, "bindingReleaseId": current["bindingReleaseId"], "replacementDigest": ledger_digest}
write(BATCH / "retirement.json", retirement)
write(exclusion_path, exclusions)
def replace(value):
    if isinstance(value, str): return replacements.get(value, value)
    if isinstance(value, list): return [replace(v) for v in value]
    if isinstance(value, dict): return {k: replace(v) for k, v in value.items()}
    return value
for path in [ROOT / "course-content/runtime/knowledge/graph/nodes.json", *sorted((ROOT / "course-content/runtime/lessons").glob("*/graph-overlay.json"))]:
    data = read(path); updated = replace(data)
    if updated != data: write(path, updated)
for entry in entries:
    for row in entry["files"]:
        path = ROOT / row["path"]
        if path.exists():
            assert hashlib.sha256(path.read_bytes()).hexdigest() == row["sha256"]
            path.unlink()
write(BATCH / "retirement.json", {**retirement, "status": "completed"})
print("Retired", len(entries), "resources; deleted", sum(len(e["files"]) for e in entries), "files")
