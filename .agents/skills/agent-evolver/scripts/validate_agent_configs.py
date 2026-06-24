#!/usr/bin/env python3
import argparse
import re
import sys
import tomllib
from pathlib import Path


ALLOWED_EFFORTS = {"low", "medium", "high", "xhigh"}
ALLOWED_SANDBOX = {"read-only", "workspace-write", "danger-full-access"}
CATALOG_START = "# project-agent-catalog:start"
CATALOG_END = "# project-agent-catalog:end"


def load_toml(path: Path) -> dict:
    with path.open("rb") as fh:
        return tomllib.load(fh)


def parse_catalog(config_text: str) -> list[dict]:
    match = re.search(
        rf"{re.escape(CATALOG_START)}\n(?P<body>.*?){re.escape(CATALOG_END)}",
        config_text,
        flags=re.DOTALL,
    )
    if not match:
        raise ValueError("missing project-agent-catalog block in .codex/config.toml")
    entries = []
    for raw_line in match.group("body").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if not line.startswith("# - "):
            raise ValueError(f"invalid catalog line: {raw_line}")
        parts = [part.strip() for part in line[4:].split("|")]
        if len(parts) != 5:
            raise ValueError(f"catalog line should have 5 fields: {raw_line}")
        agent_id, rel_path, model, effort, role = parts
        entries.append(
            {
                "agent_id": agent_id,
                "rel_path": rel_path,
                "model": model,
                "effort": effort,
                "role": role,
            }
        )
    if not entries:
        raise ValueError("project-agent-catalog block is empty")
    return entries


def validate_agent_file(path: Path) -> dict:
    data = load_toml(path)
    required = ["name", "description", "model", "model_reasoning_effort", "developer_instructions"]
    missing = [key for key in required if key not in data]
    if missing:
        raise ValueError(f"{path}: missing required keys: {', '.join(missing)}")
    if data["model_reasoning_effort"] not in ALLOWED_EFFORTS:
        raise ValueError(f"{path}: invalid model_reasoning_effort {data['model_reasoning_effort']!r}")
    sandbox_mode = data.get("sandbox_mode")
    if sandbox_mode and sandbox_mode not in ALLOWED_SANDBOX:
        raise ValueError(f"{path}: invalid sandbox_mode {sandbox_mode!r}")
    if path.stem != data["name"]:
        raise ValueError(f"{path}: file stem must match name")
    return data


def validate_root(root: Path) -> tuple[int, int]:
    config_path = root / ".codex" / "config.toml"
    agents_dir = root / ".codex" / "agents"
    if not config_path.exists():
        raise ValueError(f"missing config file: {config_path}")
    if not agents_dir.exists():
        raise ValueError(f"missing agents directory: {agents_dir}")

    config_text = config_path.read_text(encoding="utf-8")
    catalog = parse_catalog(config_text)
    config_data = load_toml(config_path)
    agents_settings = config_data.get("agents")
    if not agents_settings:
        raise ValueError(f"{config_path}: missing [agents] table")
    for key in ("max_threads", "max_depth"):
        value = agents_settings.get(key)
        if not isinstance(value, int) or value <= 0:
            raise ValueError(f"{config_path}: [agents].{key} must be a positive integer")

    agent_files = sorted(agents_dir.glob("*.toml"))
    if not agent_files:
        raise ValueError(f"{agents_dir}: no agent TOML files found")
    agent_map = {file.name: validate_agent_file(file) for file in agent_files}

    for entry in catalog:
        rel_path = Path(entry["rel_path"])
        if rel_path.parts[:2] != (".codex", "agents"):
            raise ValueError(f"catalog entry must point into .codex/agents: {entry['rel_path']}")
        expected_name = f"{entry['agent_id']}.toml"
        if rel_path.name != expected_name:
            raise ValueError(f"catalog entry path mismatch for {entry['agent_id']}")
        if expected_name not in agent_map:
            raise ValueError(f"catalog entry references missing file: {expected_name}")
        data = agent_map[expected_name]
        if data["model"] != entry["model"]:
            raise ValueError(f"{expected_name}: catalog model mismatch")
        if data["model_reasoning_effort"] != entry["effort"]:
            raise ValueError(f"{expected_name}: catalog effort mismatch")

    if len(catalog) != len(agent_files):
        raise ValueError("catalog entry count must match agent file count")

    return len(agent_files), len(catalog)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    args = parser.parse_args()
    try:
        agent_count, catalog_count = validate_root(args.root.resolve())
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"validated {agent_count} agent files and {catalog_count} catalog entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
