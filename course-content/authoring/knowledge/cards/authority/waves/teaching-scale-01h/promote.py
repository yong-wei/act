"""Export independently accepted cards and extend the existing replacement ledger."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent

def read(path):
    return json.loads(path.read_text())

def digest(data):
    return hashlib.sha256(data).hexdigest()

def write(path, data):
    lines = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").splitlines(keepends=True)
    with path.open("w") as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start + 300])

inventory = read(BATCH / "inventory.json")
review = read(BATCH / "review-acceptance.json")
assert review["status"] == "accepted"
assert sorted(c["canonicalId"] for c in inventory["cards"]) == sorted(c["canonicalId"] for c in read(BATCH / "accepted-scope.json")["cards"])
assert sorted(review["cardHashes"]) == sorted(c["canonicalId"] for c in inventory["cards"])
active = read(ROOT / "course-content/authoring/knowledge/authority/current.json")
for key in ["releaseId", "snapshotId", "snapshotHash"]:
    assert inventory["authority"][key] == active[key], key
ledger_path = ROOT / "course-content/authoring/knowledge/resource-bindings/card-replacements.json"
ledger = read(ledger_path)
current = read(ROOT / "course-content/runtime/knowledge/resource-bindings/current.json")
release = ROOT / "course-content/runtime/knowledge/resource-bindings/releases" / current["bindingReleaseId"]
bindings = [json.loads(line) for line in (release / "bindings.jsonl").read_text().splitlines() if line]
rows = []
for card in inventory["cards"]:
    source = ROOT / card["authoringPath"]
    data = source.read_bytes()
    assert digest(data) == card["cardSha256"] == review["cardHashes"][card["canonicalId"]]
    old = sorted({b["resourceId"] for b in bindings if b["canonicalId"] == card["canonicalId"]
                  and b["resourceId"].startswith("act:card:") and b["resourceId"] != card["resourceId"]})
    assert not any(b["resourceId"] in old and b["canonicalId"] != card["canonicalId"] for b in bindings), card["name"]
    rows.append({"canonicalId": card["canonicalId"], "cardId": card["cardId"], "title": card["name"],
                 "sha256": card["cardSha256"], "retiredResourceIds": old})
# All identities and review hashes are checked before exporting any card.
for card in inventory["cards"]:
    source = ROOT / card["authoringPath"]
    target = ROOT / card["authoringPath"].replace("/authoring/", "/runtime/")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(source.read_bytes())
existing = {r["canonicalId"]: r for r in ledger["rows"]}
for row in rows:
    if row["canonicalId"] in existing:
        assert existing[row["canonicalId"]]["sha256"] == row["sha256"]
        row["retiredResourceIds"] = sorted(set(row["retiredResourceIds"]) | set(existing[row["canonicalId"]]["retiredResourceIds"]))
    existing[row["canonicalId"]] = row
ledger["rows"] = list(existing.values())
ledger["batchId"] = "teaching-batches-01-02-scale-01-01b-01d-01c-01f-01e-01h"
write(ledger_path, ledger)
write(BATCH / "promotion.json", {"status": "exported-awaiting-binding-activation", "cards": len(rows),
      "previousBindingReleaseId": current["bindingReleaseId"], "retiredResources": [r for row in rows for r in row["retiredResourceIds"]]})
print("Exported", len(rows), "reviewed cards; binding activation still required")
