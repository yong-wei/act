#!/usr/bin/env python3
import argparse
import json
from datetime import datetime
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ledger", required=True, type=Path)
    parser.add_argument("--agent", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--reasoning-effort", required=True)
    parser.add_argument("--task-type", required=True)
    parser.add_argument("--outcome", required=True)
    parser.add_argument("--quality", required=True)
    parser.add_argument("--notes", default="")
    args = parser.parse_args()

    entry = {
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "agent": args.agent,
        "model": args.model,
        "reasoning_effort": args.reasoning_effort,
        "task_type": args.task_type,
        "outcome": args.outcome,
        "quality": args.quality,
        "notes": args.notes,
    }
    args.ledger.parent.mkdir(parents=True, exist_ok=True)
    with args.ledger.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    print(json.dumps(entry, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
