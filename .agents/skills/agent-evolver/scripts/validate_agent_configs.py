#!/usr/bin/env python3
import argparse
import re
import sys
import tomllib
from pathlib import Path


MODEL_REASONING_EFFORTS = {
    "gpt-5.6-sol": {"low", "medium", "high"},
}
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
    seen_agent_ids = set()
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
        if agent_id in seen_agent_ids:
            raise ValueError(f"duplicate agent id in catalog: {agent_id}")
        seen_agent_ids.add(agent_id)
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
    model = data["model"]
    effort = data["model_reasoning_effort"]
    allowed_efforts = MODEL_REASONING_EFFORTS.get(model)
    if allowed_efforts is None:
        raise ValueError(f"{path}: unsupported model {model!r}")
    if effort not in allowed_efforts:
        allowed_values = ", ".join(sorted(allowed_efforts))
        raise ValueError(
            f"{path}: model {model!r} does not support model_reasoning_effort "
            f"{effort!r}; allowed values: {allowed_values}"
        )
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
    catalog_ids = {entry["agent_id"] for entry in catalog}
    agent_ids = {file.stem for file in agent_files}
    if catalog_ids != agent_ids:
        missing_ids = sorted(agent_ids - catalog_ids)
        extra_ids = sorted(catalog_ids - agent_ids)
        raise ValueError(
            "catalog agent ids must exactly match agent files; "
            f"missing: {missing_ids}; extra: {extra_ids}"
        )

    for entry in catalog:
        rel_path = Path(entry["rel_path"])
        expected_name = f"{entry['agent_id']}.toml"
        expected_path = Path(".codex") / "agents" / expected_name
        if rel_path != expected_path:
            raise ValueError(
                f"catalog entry path for {entry['agent_id']} must be exactly {expected_path}"
            )
        if expected_name not in agent_map:
            raise ValueError(f"catalog entry references missing file: {expected_name}")
        data = agent_map[expected_name]
        if data["model"] != entry["model"]:
            raise ValueError(f"{expected_name}: catalog model mismatch")
        if data["model_reasoning_effort"] != entry["effort"]:
            raise ValueError(f"{expected_name}: catalog effort mismatch")

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
