#!/usr/bin/env python3
import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path


def load_entries(path: Path) -> list[dict]:
    entries = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            entries.append(json.loads(line))
    return entries


def summarize(entries: list[dict]) -> dict:
    per_agent = defaultdict(list)
    for entry in entries:
        per_agent[entry["agent"]].append(entry)

    suggestions = []
    for agent, items in sorted(per_agent.items()):
        total = len(items)
        outcomes = Counter(item["outcome"] for item in items)
        poor_count = sum(1 for item in items if item.get("quality") == "poor")
        poor_ratio = poor_count / total
        timeout_ratio = outcomes["timeout"] / total
        note_blob = " ".join(item.get("notes", "") for item in items)

        if timeout_ratio >= 0.25:
            suggestions.append(
                {
                    "agent": agent,
                    "severity": "medium",
                    "reason": "timeout_ratio",
                    "detail": "超时占比偏高，应检查默认推理强度是否过重或任务是否分派过宽。",
                }
            )
        if poor_ratio >= 0.5:
            suggestions.append(
                {
                    "agent": agent,
                    "severity": "medium",
                    "reason": "poor_quality_ratio",
                    "detail": "低质量占比偏高，应收紧行为边界或补充 developer_instructions。",
                }
            )
        if "扩展到跨文件重构" in note_blob or "超过简单修补" in note_blob:
            suggestions.append(
                {
                    "agent": agent,
                    "severity": "high",
                    "reason": "boundary_drift",
                    "detail": "任务边界发生漂移，应在 agent 配置中进一步强调只处理窄范围简单编码。",
                }
            )

    return {
        "summary": {
            "entry_count": len(entries),
            "agent_count": len(per_agent),
        },
        "suggestions": suggestions,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ledger", required=True, type=Path)
    args = parser.parse_args()
    payload = summarize(load_entries(args.ledger.resolve()))
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
