#!/usr/bin/env python3
import json
import sys


expected_required = sys.argv[1].lower() == "true"
try:
    payload = json.load(sys.stdin)
    worker = payload["mathDocumentGradingWorker"]
    valid = payload.get("db") is True and payload.get("redis") is True
    valid = valid and worker.get("required") is expected_required and worker.get("ready") is True
    if expected_required:
        valid = valid and worker.get("configReady") is True
        valid = valid and worker.get("capabilities", {}).get("auditSecret") is True
except (json.JSONDecodeError, KeyError, TypeError, AttributeError):
    valid = False

sys.exit(0 if valid else 1)
