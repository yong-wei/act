#!/usr/bin/env python3
import os
import re
import sys
from pathlib import Path

ENV_VAR_NAME = "CODEX_DATABASE_URI"  # Per-project override: change the env var name here if needed.
DEFAULT_CONFIG_PATH = "~/.codex/config.toml"
SECTION_HEADER = "[mcp_servers.postgres.env]"


def toml_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def detect_newline(lines: list[str]) -> str:
    for line in lines:
        if line.endswith("\r\n"):
            return "\r\n"
        if line.endswith("\n"):
            return "\n"
    return "\n"


def update_text(text: str, toml_value: str) -> str:
    lines = text.splitlines(keepends=True)
    header_idx = None
    for idx, line in enumerate(lines):
        if line.strip() == SECTION_HEADER:
            header_idx = idx
            break

    if header_idx is None:
        if text and not text.endswith("\n"):
            text += "\n"
        return f"{text}\n{SECTION_HEADER}\nDATABASE_URI = {toml_value}\n"

    newline = detect_newline(lines)
    section_end = len(lines)
    for idx in range(header_idx + 1, len(lines)):
        if lines[idx].lstrip().startswith("[") and lines[idx].rstrip().endswith("]"):
            section_end = idx
            break

    db_idx = None
    for idx in range(header_idx + 1, section_end):
        if re.match(r"\s*DATABASE_URI\s*=", lines[idx]):
            db_idx = idx
            break

    if db_idx is not None:
        if lines[db_idx].endswith("\r\n"):
            line_ending = "\r\n"
        elif lines[db_idx].endswith("\n"):
            line_ending = "\n"
        else:
            line_ending = ""
        lines[db_idx] = f"DATABASE_URI = {toml_value}{line_ending}"
        return "".join(lines)

    if not lines[header_idx].endswith("\n"):
        lines[header_idx] += newline
    lines.insert(header_idx + 1, f"DATABASE_URI = {toml_value}{newline}")
    return "".join(lines)


def main() -> int:
    config_path = os.environ.get("CODEX_CONFIG_TOML", DEFAULT_CONFIG_PATH)
    if len(sys.argv) > 1:
        config_path = sys.argv[1]

    uri = os.environ.get(ENV_VAR_NAME)
    if not uri:
        print(f"Missing required env var: {ENV_VAR_NAME}", file=sys.stderr)
        return 1

    path = Path(os.path.expanduser(config_path))
    if not path.exists():
        print(f"Config file not found: {path}", file=sys.stderr)
        return 1

    text = path.read_text(encoding="utf-8")
    new_text = update_text(text, toml_quote(uri))
    if new_text == text:
        return 0

    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(new_text, encoding="utf-8")
    os.replace(tmp_path, path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
