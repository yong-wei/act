#!/usr/bin/env python3
"""Print a compact Grok image_gen prompt for one prepared authority node."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import AUTHORING_INFOGRAPH_ROOT


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--safe-id", required=True)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    root = AUTHORING_INFOGRAPH_ROOT / args.safe_id
    source = json.loads((root / "source.json").read_text(encoding="utf-8"))
    name = (source.get("node") or {}).get("name") or args.safe_id
    name_en = (source.get("node") or {}).get("name_en")
    definition = source.get("definition") or ""
    archetype = source.get("visual_archetype") or "科普百科图鉴"
    labels = source.get("labels") or [name]
    label_s = "、".join(f"「{x}」" for x in labels[:8])
    title = f"{name}" + (f" ({name_en})" if name_en and name_en != name else "")
    prompt = f"""Generate ONE landscape 16:9 premium educational infographic for control-theory concept: {title}.

SOURCE DEFINITION (fail-closed, do not invent beyond this):
{definition}

visual_archetype: {archetype}

layout_contract:
- Main visual scene or engineering metaphor for this concept (~50% frame)
- 1–3 technical insets (diagram / axes / mechanism)
- Boundary/judgment strip
- Clear left-to-right or top-to-bottom reading order

text_contract:
- Clean Chinese typography; short labels only
- Allowed labels: {label_s}
- Do NOT paste full definition paragraphs
- Do NOT render metadata, entity ids, provider names, or English instruction headers
- No watermark

negative_constraints:
- No electronic handout screenshot look
- No generic icon-card grid with long paragraphs
- No invented numbers, formulas, or engineering claims absent from the source definition
- No malformed Chinese

Style: deep navy, teal accents, warm paper-white panels; high information density with breathing room; magazine-quality control-engineering teaching asset.
"""
    print(prompt)


if __name__ == "__main__":
    main()
