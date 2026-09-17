import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).with_name("retire.py")
def check(corrupt=False, scope_drift=False):
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        batch = root / "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01"
        batch.mkdir(parents=True)
        shutil.copy2(SOURCE, batch / "retire.py")
        def put(p, data):
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(data))
        ledger_path = root / "course-content/authoring/knowledge/resource-bindings/card-replacements.json"
        ledger = {"rows":[{"canonicalId":"new", "cardId":"new", "retiredResourceIds":["act:card:old"]}]}
        put(ledger_path, ledger)
        digest = hashlib.sha256(ledger_path.read_bytes()).hexdigest()
        put(batch / "inventory.json", {"cards":[{"canonicalId":"new"}]})
        put(batch / "integration.json", {"status":"local-runtime-active","inventoryDigest":hashlib.sha256((batch/"inventory.json").read_bytes()).hexdigest(),"batchCanonicalIds":["new"],"bindingReleaseId":"b","replacementDigest":digest,"bindingHash":"bh"})
        graph = root / "course-content/runtime/knowledge"
        put(graph / "resource-bindings/current.json", {"bindingReleaseId":"b","bindingHash":"bh"})
        release = graph / "resource-bindings/releases/b"
        put(release / "binding-manifest.json", {"sourceHashes":{"cardReplacements":digest},"bindingHash":"bh"})
        (release / "resources.jsonl").write_text('{"resourceId":"act:card:new"}\n')
        put(root / "course-content/authoring/knowledge/card-exclusions.json", {"exclusions":[]})
        put(graph / "graph/nodes.json", [{"resources":["course-content/runtime/knowledge/cards/nodes/old.md"]}])
        files=[]
        for kind in ["authoring","runtime"]:
            relative=f"course-content/{kind}/knowledge/cards/nodes/old.md"
            original=root/relative
            original.parent.mkdir(parents=True,exist_ok=True)
            original.write_text("old content")
            backup=batch/"retired"/kind/"old.md"
            backup.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(original,backup)
            files.append({"path":relative,"sha256":hashlib.sha256(original.read_bytes()).hexdigest(),"recoveryPath":str(backup.relative_to(root))})
        put(batch / "retirement.json", {"status":"prepared","bindingReleaseId":"b","replacementDigest":digest,"entries":[{"resourceId":"act:card:old","canonicalId":"new","files":files}]})
        (root/files[0]["path"]).unlink() # interrupted after one deletion
        if corrupt:
            ledger["rows"][0]["retiredResourceIds"].append("act:card:unrelated")
            put(ledger_path,ledger)
        if scope_drift: put(batch / "inventory.json", {"cards":[]})
        result=subprocess.run(["python3",str(batch/"retire.py")],capture_output=True,text=True)
        if corrupt or scope_drift:
            assert result.returncode != 0
            assert (root/files[1]["path"]).exists()
        else:
            assert result.returncode == 0,result.stderr
            report=json.loads((batch/"retirement.json").read_text())
            assert report["status"]=="completed" and len(report["entries"][0]["files"])==2
            assert all(not (root/f["path"]).exists() for f in files)
            assert subprocess.run(["python3",str(batch/"retire.py")],capture_output=True).returncode==0
check();check(True);check(scope_drift=True)
print("PASS partial deletion resumes with complete recovery evidence; PASS mutated ledger and changed inventory refuse deletion")
