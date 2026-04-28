#!/usr/bin/env python3
"""Audit manifest-first interactive lessons for script-visible module consumption."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[4]
CONTENT_RENDERER_PATH = REPO_ROOT / "src" / "features" / "interactive" / "shared" / "manifest-runtime" / "content-renderers.tsx"
LAYOUT_RENDERER_PATH = REPO_ROOT / "src" / "features" / "interactive" / "shared" / "manifest-runtime" / "layout-renderer.tsx"

ACTIVITY_MODULE_KINDS = {
    "activity-card",
    "activity-card-set",
    "single-choice-card",
    "quiz-card",
    "quiz-group",
}

EXPLANATION_KEYS = {
    "figure_explanations",
    "figure_explanation",
    "figure_reading",
    "figure_requirements",
    "parameter_explanation",
    "formula_explanation",
}


def as_record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def is_non_empty(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set)):
        return any(is_non_empty(item) for item in value)
    if isinstance(value, dict):
        return any(is_non_empty(item) for item in value.values())
    return True


def strings_in(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            result.extend(strings_in(item))
        return result
    if isinstance(value, dict):
        result = []
        for item in value.values():
            result.extend(strings_in(item))
        return result
    return []


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def extract_registry_kinds(path: Path, function_name: str | None = None) -> set[str]:
    if not path.exists():
        return set()

    source = path.read_text(encoding="utf-8")
    if function_name:
        match = re.search(
            rf"function\s+{re.escape(function_name)}[\s\S]*?return\s*\{{(?P<body>[\s\S]*?)^\s*\}}\s*;",
            source,
            re.MULTILINE,
        )
        if match:
            source = match.group("body")

    return set(re.findall(r"^\s*['\"]([^'\"]+)['\"]\s*:", source, re.MULTILINE))


def extract_set_literal(path: Path, set_name: str) -> set[str]:
    if not path.exists():
        return set()

    source = path.read_text(encoding="utf-8")
    match = re.search(
        rf"{re.escape(set_name)}\s*=\s*new\s+Set\(\[(?P<body>[\s\S]*?)\]\)",
        source,
    )
    if not match:
        return set()
    return set(re.findall(r"['\"]([^'\"]+)['\"]", match.group("body")))


def shared_content_renderer_kinds() -> set[str]:
    return extract_registry_kinds(CONTENT_RENDERER_PATH, "createManifestContentModuleRegistry")


def layout_activity_module_kinds() -> set[str]:
    parsed = extract_set_literal(LAYOUT_RENDERER_PATH, "ACTIVITY_RUNTIME_MODULE_KINDS")
    return parsed or ACTIVITY_MODULE_KINDS


def normalize_steps(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    raw_steps = manifest.get("steps", {})
    if isinstance(raw_steps, dict):
        return {str(step_id): as_record(step) for step_id, step in raw_steps.items()}
    if isinstance(raw_steps, list):
        return {
            str(step.get("id") or f"step-{index + 1:02d}"): as_record(step)
            for index, step in enumerate(raw_steps)
            if isinstance(step, dict)
        }
    return {}


def content_blocks(step: dict[str, Any]) -> dict[str, Any]:
    blocks = step.get("content_blocks", step.get("contentBlocks", {}))
    if isinstance(blocks, dict):
        return blocks
    if isinstance(blocks, list):
        return {
            str(item.get("id")): item
            for item in blocks
            if isinstance(item, dict) and item.get("id")
        }
    return {}


def modules(step: dict[str, Any]) -> list[dict[str, Any]]:
    return [as_record(item) for item in as_list(step.get("modules"))]


def interaction_cards(step: dict[str, Any]) -> list[dict[str, Any]]:
    spec = as_record(step.get("interaction_spec", step.get("interactionSpec", {})))
    return [as_record(item) for item in as_list(spec.get("activity_cards", spec.get("activityCards")))]


def must_be_visible(module: dict[str, Any]) -> bool:
    return bool(module.get("must_be_visible", module.get("mustBeVisible", False)))


def module_payload(module: dict[str, Any]) -> dict[str, Any]:
    return as_record(module.get("payload"))


def block_key(payload: dict[str, Any]) -> str | None:
    for key in ("block_key", "blockKey", "formula_key", "formulaKey", "image_key", "imageKey"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def module_id_candidates(module_id: str) -> list[str]:
    normalized = module_id.replace("-", "_")
    candidates = [
        normalized,
        normalized.removesuffix("_card"),
        normalized.removesuffix("_cards"),
        normalized.removesuffix("_figure"),
        normalized.removesuffix("_reading"),
    ]
    parts = [part for part in normalized.split("_") if part]
    if len(parts) > 1:
        candidates.extend(["_".join(parts[-2:]), parts[-1]])
    if "conclusion" in normalized:
        candidates.extend(["conclusion", "structure_conclusion", "delivery_judgment"])
    if "reading" in normalized and "prompt" in normalized:
        candidates.append("reading_prompt")
    if "prompt" in normalized:
        candidates.append("prompt")
    if "criteria" in normalized:
        candidates.append("criteria")
    if "setting" in normalized:
        candidates.append("search_settings")
    if "family" in normalized or "structure" in normalized:
        candidates.extend(["structures", "structure_code_fields"])
    if "frontier" in normalized or "method" in normalized:
        candidates.append("frontier_methods")
    if "limitation" in normalized:
        candidates.append("limitations")
    if "header" in normalized:
        candidates.append("header")
    if "explanation" in normalized:
        candidates.extend(["figure_explanation", "formula_explanation"])
    return list(dict.fromkeys(candidates))


def block_by_module_id(blocks: dict[str, Any], module_id: str) -> tuple[str | None, Any]:
    for candidate in module_id_candidates(module_id):
        if candidate in blocks:
            return candidate, blocks[candidate]
    return None, None


def module_index(step_modules: list[dict[str, Any]], module: dict[str, Any], kinds: set[str]) -> int:
    same_kind = [item for item in step_modules if item.get("kind") in kinds]
    module_id = module.get("id")
    for index, item in enumerate(same_kind):
        if item.get("id") == module_id:
            return index
    return -1


def table_like(value: Any) -> bool:
    record = as_record(value)
    return is_non_empty(record.get("columns")) and is_non_empty(record.get("rows"))


def first_table(blocks: dict[str, Any], index: int) -> tuple[str | None, Any]:
    tables = [(key, value) for key, value in blocks.items() if table_like(value)]
    if not tables:
        return None, None
    if 0 <= index < len(tables):
        return tables[index]
    return tables[0]


def first_non_empty_block(blocks: dict[str, Any], keys: list[str]) -> tuple[str | None, Any]:
    for key in keys:
        value = blocks.get(key)
        if is_non_empty(value):
            return key, value
    return None, None


def resolve_content(step: dict[str, Any], module: dict[str, Any]) -> dict[str, Any]:
    kind = str(module.get("kind", ""))
    module_id = str(module.get("id", ""))
    payload = module_payload(module)
    blocks = content_blocks(step)
    step_modules = modules(step)

    direct_fields = [
        "formula",
        "formulas",
        "src",
        "text",
        "bullets",
        "items",
        "rows",
        "columns",
    ]
    direct_payload = {key: payload.get(key) for key in direct_fields if is_non_empty(payload.get(key))}
    if direct_payload:
        return {
            "source": "module.payload",
            "type": content_type(kind),
            "value": direct_payload,
            "notes_sources": [],
        }

    resolver = payload.get("resolver")
    if isinstance(resolver, str) and resolver:
        return {
            "source": f"implicit:{resolver}",
            "type": content_type(kind),
            "value": True,
            "notes_sources": [],
        }

    key = block_key(payload)
    if key:
        return {
            "source": f"content_blocks.{key}",
            "type": content_type(kind),
            "value": blocks.get(key),
            "notes_sources": [],
        }

    block_name, block_value = block_by_module_id(blocks, module_id)
    if block_name and is_non_empty(block_value):
        return {
            "source": f"content_blocks.{block_name}",
            "type": content_type(kind),
            "value": block_value,
            "notes_sources": [],
        }

    if kind == "stage-map":
        key_name, value = first_non_empty_block(blocks, ["page_intro", "path_items"])
        return {
            "source": f"content_blocks.{key_name}" if key_name else "unresolved",
            "type": "summary",
            "value": value,
            "notes_sources": [],
        }

    if kind in {"goal-card-row", "goal-card-set"}:
        key_name, value = first_non_empty_block(blocks, ["goal_cards", "target_constraints"])
        return {
            "source": f"content_blocks.{key_name}" if key_name else "unresolved",
            "type": "summary",
            "value": value,
            "notes_sources": [],
        }

    if kind == "question-card-set":
        key_name, value = first_non_empty_block(blocks, ["question_cards"])
        return {
            "source": f"content_blocks.{key_name}" if key_name else "unresolved",
            "type": "summary",
            "value": value,
            "notes_sources": [],
        }

    if kind in {"formula-card", "formula-card-row"}:
        formulas = as_list(blocks.get("key_formulas"))
        index = module_index(step_modules, module, {"formula-card", "formula-card-row"})
        return {
            "source": "implicit:key_formulas_by_formula_card_order",
            "type": "formula",
            "value": formulas[index] if 0 <= index < len(formulas) else None,
            "notes_sources": [],
        }

    if kind == "equation-card-row":
        key_name, value = first_non_empty_block(blocks, ["target_cards"])
        return {
            "source": f"content_blocks.{key_name}" if key_name else "unresolved",
            "type": "formula",
            "value": value,
            "notes_sources": [],
        }

    if kind in {"image-panel", "native-figure"}:
        media_items = as_list(blocks.get("media"))
        index = module_index(step_modules, module, {"image-panel", "native-figure"})
        media_value = None
        if media_items:
            media_value = media_items[index] if 0 <= index < len(media_items) else None
        elif "media" in blocks:
            media_value = blocks["media"]
        notes_sources = [key for key in EXPLANATION_KEYS if is_non_empty(blocks.get(key))]
        return {
            "source": "implicit:media_by_image_panel_order",
            "type": "image",
            "value": media_value,
            "notes_sources": notes_sources,
        }

    if kind in {"native-table", "native-formula-table", "table-card"}:
        index = module_index(step_modules, module, {"native-table", "native-formula-table", "table-card"})
        table_key, table_value = first_table(blocks, index)
        return {
            "source": f"implicit:table_by_table_module_order:{table_key}" if table_key else "implicit:table_by_table_module_order",
            "type": "table",
            "value": table_value,
            "notes_sources": [],
        }

    if kind == "problem-statement":
        key_name, value = first_non_empty_block(blocks, ["problem_statement", "fixed_problem", "formula_block"])
        payload_value = payload if is_non_empty(payload) else None
        return {
            "source": f"content_blocks.{key_name}" if key_name else ("module.payload" if payload_value else "unresolved"),
            "type": "summary",
            "value": value if key_name else payload_value,
            "notes_sources": [],
        }

    if kind == "title-card":
        key_name, value = first_non_empty_block(blocks, ["post_quiz_title", "page_intro"])
        return {
            "source": f"content_blocks.{key_name}" if key_name else "unresolved",
            "type": "summary",
            "value": value,
            "notes_sources": [],
        }

    if kind == "quiz-stack":
        key_name, value = first_non_empty_block(blocks, ["post_quiz_items"])
        return {
            "source": f"content_blocks.{key_name}" if key_name else "unresolved",
            "type": "summary",
            "value": value,
            "notes_sources": [],
        }

    if kind == "route-card":
        key_name, value = first_non_empty_block(blocks, ["next_route"])
        return {
            "source": f"content_blocks.{key_name}" if key_name else "unresolved",
            "type": "summary",
            "value": value,
            "notes_sources": [],
        }

    if kind in {"step-reveal", "step-reveal-chain"}:
        return {
            "source": "content_blocks.reveal_layers",
            "type": "reveal",
            "value": blocks.get("reveal_layers"),
            "notes_sources": [],
        }

    return {
        "source": "unresolved",
        "type": content_type(kind),
        "value": None,
        "notes_sources": [],
    }


def content_type(kind: str) -> str:
    if "formula" in kind or "equation" in kind:
        return "formula"
    if "table" in kind:
        return "table"
    if "image" in kind or "figure" in kind:
        return "image"
    if "reveal" in kind:
        return "reveal"
    return "summary"


def audit_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    steps = normalize_steps(manifest)
    content_renderer_kinds = shared_content_renderer_kinds()
    activity_module_kinds = layout_activity_module_kinds()

    for step_id, step in steps.items():
        step_modules = modules(step)
        blocks = content_blocks(step)
        cards = interaction_cards(step)
        prompts = [
            str(card.get("prompt", "")).strip()
            for card in cards
            if str(card.get("prompt", "")).strip()
        ]
        content_payload_text = "\n".join(
            text
            for module in step_modules
            if str(module.get("kind", "")) not in activity_module_kinds
            for text in strings_in(module_payload(module))
        )
        block_text = "\n".join([*strings_in(blocks), content_payload_text])

        for index, card in enumerate(cards):
            if not str(card.get("prompt", "")).strip():
                issues.append({
                    "step_id": step_id,
                    "card_id": str(card.get("id") or f"activity-card-{index + 1}"),
                    "issue": "activity_card_without_prompt",
                })

        for prompt in prompts:
            if prompt and prompt in block_text:
                issues.append({
                    "step_id": step_id,
                    "issue": "activity_prompt_repeated_in_content_blocks",
                    "prompt": prompt,
                })

        for module in step_modules:
            kind = str(module.get("kind", ""))
            module_id = str(module.get("id", ""))
            required = must_be_visible(module)
            if kind in activity_module_kinds:
                entry = {
                    "step_id": step_id,
                    "module_id": module_id,
                    "kind": kind,
                    "renderer_owner": "activity",
                    "resolved_content_source": "interaction_spec.activity_cards",
                    "resolved_content_type": "activity",
                    "is_empty": not bool(prompts),
                    "diagnostic": None,
                }
                if required and not prompts:
                    entry["diagnostic"] = "activity_module_without_activity_cards"
                    issues.append({**entry, "issue": entry["diagnostic"]})
                entries.append(entry)
                continue

            resolved = resolve_content(step, module)
            empty = not is_non_empty(resolved["value"])
            renderer_missing = kind not in content_renderer_kinds
            diagnostic = None
            if renderer_missing and required:
                diagnostic = "missing_shared_content_renderer"
            elif empty and required:
                diagnostic = "empty_required_content_module"

            entry = {
                "step_id": step_id,
                "module_id": module_id,
                "kind": kind,
                "renderer_owner": "content",
                "resolved_content_source": resolved["source"],
                "resolved_content_type": resolved["type"],
                "is_empty": empty,
                "diagnostic": diagnostic,
            }
            if resolved.get("notes_sources"):
                entry["consumed_note_sources"] = resolved["notes_sources"]
            entries.append(entry)
            if diagnostic:
                issues.append({**entry, "issue": diagnostic})

        if any(module.get("kind") in {"image-panel", "native-figure"} for module in step_modules):
            consumed = {
                source
                for entry in entries
                if entry["step_id"] == step_id
                for source in entry.get("consumed_note_sources", [])
            }
            for key in EXPLANATION_KEYS:
                if is_non_empty(blocks.get(key)) and key not in consumed:
                    issues.append({
                        "step_id": step_id,
                        "issue": "image_explanation_not_consumed",
                        "content_block": key,
                    })

    return {
        "status": "pass" if not issues else "fail",
        "summary": {
            "steps": len(steps),
            "modules": len(entries),
            "issues": len(issues),
        },
        "implementation_sources": {
            "content_renderer": str(CONTENT_RENDERER_PATH.relative_to(REPO_ROOT)),
            "layout_renderer": str(LAYOUT_RENDERER_PATH.relative_to(REPO_ROOT)),
            "content_renderer_kinds": sorted(content_renderer_kinds),
            "activity_module_kinds": sorted(activity_module_kinds),
        },
        "entries": entries,
        "issues": issues,
    }


def default_manifest_path(lesson: str) -> Path:
    return REPO_ROOT / "course-content" / "runtime" / "lessons" / lesson / "interactive-manifest.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit a manifest-first interactive lesson.")
    parser.add_argument("--lesson", help="Lesson id, for example 4-7.")
    parser.add_argument("--manifest", help="Path to interactive-manifest.json.")
    parser.add_argument("--json", action="store_true", help="Print full JSON audit result.")
    parser.add_argument("--write-review", action="store_true", help="Write review/interactive-manifest-audit.json.")
    args = parser.parse_args()

    if not args.lesson and not args.manifest:
        parser.error("provide --lesson or --manifest")

    manifest_path = Path(args.manifest).resolve() if args.manifest else default_manifest_path(args.lesson)
    if not manifest_path.exists():
        raise SystemExit(f"manifest not found: {manifest_path}")

    result = audit_manifest(load_json(manifest_path))
    result["manifest_path"] = str(manifest_path.relative_to(REPO_ROOT) if manifest_path.is_relative_to(REPO_ROOT) else manifest_path)

    if args.write_review:
        lesson = args.lesson or manifest_path.parent.name
        review_dir = REPO_ROOT / "course-content" / "runtime" / "lessons" / lesson / "review"
        review_dir.mkdir(parents=True, exist_ok=True)
        (review_dir / "interactive-manifest-audit.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        summary = result["summary"]
        print(
            f"manifest audit {result['status']}: "
            f"{summary['steps']} steps, {summary['modules']} modules, {summary['issues']} issues"
        )
        for issue in result["issues"][:20]:
            print(json.dumps(issue, ensure_ascii=False))
        if len(result["issues"]) > 20:
            print(f"... {len(result['issues']) - 20} more issues")

    return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
