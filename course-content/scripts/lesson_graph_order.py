from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

MANIFEST_ONLY_POLICY = 'manifest-reviewed-no-sequence'

RELATION_ALIASES = {
    'defines': 'related',
    'governs': 'related',
    'implements': 'related',
    'influences': 'related',
    'example': 'instance_of',
    'explains': 'informs',
    '引出机械建模': 'leads_to',
    '引出电路建模': 'leads_to',
    '机电类比': 'cross_domain',
    '非线性扩展': 'generalizes',
    '建模基础': 'provides_foundation',
    '电路应用': 'applies_to',
}

RELATION_CONTRACTS = {
    relation_type: {'family': family, 'direction': direction}
    for relation_type, family, direction in (
        ('contains', 'child', 'parent-to-child'),
        ('prerequisite', 'post-requisite', 'earlier-to-later'),
        ('provides_foundation', 'post-requisite', 'earlier-to-later'),
        ('follows', 'post-requisite', 'earlier-to-later'),
        ('leads_to', 'post-requisite', 'earlier-to-later'),
        *(
            (relation_type, 'association', 'unordered')
            for relation_type in (
                'applies_to', 'opposite', 'related', 'cross_domain', 'generalizes',
                'instance_of', 'supports', 'enables', 'complements', 'contrasts_with',
                'derives', 'describes_migration_of', 'determines', 'embodies', 'informs',
                'quantified_by', 'uses', 'visualized_by', 'causes', 'demonstrates',
                'equivalent_to', 'exemplifies', 'extends', 'has_stage', 'precedes',
                'produces', 'provides_context', 'refined_by', 'refines',
            )
        ),
    )
}

RELATION_CONTRACTS.update({
    relation_type: {
        **RELATION_CONTRACTS[relation_type],
        'label': label,
        'source_sentence': source_sentence,
        'target_sentence': target_sentence,
    }
    for relation_type, label, source_sentence, target_sentence in (
        ('causes', '因果作用', '本节点导致目标结果', '本节点由来源条件或机制导致'),
        ('demonstrates', '示范说明', '本节点展示目标性质或过程', '本节点由来源实例或表征展示'),
        ('equivalent_to', '条件等价', '本节点在已声明模型与条件下等价于目标', '本节点在已声明模型与条件下等价于来源'),
        ('exemplifies', '举例说明', '本节点是目标性质或概念的实例', '本节点由来源实例具体说明'),
        ('extends', '概念扩展', '本节点的既有概念扩展到目标', '本节点扩展来源概念的适用范围或变化维度'),
        ('has_stage', '过程阶段', '本节点过程包含目标阶段', '本节点是来源过程的一个状态或阶段'),
        ('precedes', '演化先后', '本节点在过程或参数演化中先于目标', '本节点在过程或参数演化中后于来源'),
        ('produces', '产生结果', '本节点产生目标现象或结果', '本节点由来源机制或状态产生'),
        ('provides_context', '提供语境', '本节点为目标提供理解语境', '本节点的理解语境由来源提供'),
        ('refined_by', '被精化', '本节点由目标进一步精化', '本节点进一步精化来源概念'),
        ('refines', '精化概念', '本节点进一步精化目标概念', '本节点由来源进一步精化'),
    )
})

CANONICAL_RELATION_TYPES = set(RELATION_CONTRACTS)


def normalize_relation_type(raw_type: Any) -> str:
    if not isinstance(raw_type, str) or not raw_type or raw_type.strip() != raw_type:
        raise ValueError('relation_type must be an exact non-empty string')
    canonical_type = RELATION_ALIASES.get(raw_type, raw_type)
    if canonical_type not in RELATION_CONTRACTS:
        raise ValueError(f'unknown relation_type: {raw_type}')
    return canonical_type


def get_relation_contract(raw_type: Any) -> dict[str, str] | None:
    try:
        return RELATION_CONTRACTS[normalize_relation_type(raw_type)]
    except ValueError:
        return None


def _read_json_object(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(payload, dict):
        raise ValueError(f'{path} must contain a JSON object')
    return payload


def _exact_string_list(value: Any, field: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise ValueError(f'{field} must be a non-empty string array')
    result: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item or item.strip() != item:
            raise ValueError(f'{field} must contain exact non-empty strings')
        if item in result:
            raise ValueError(f'{field} must not contain duplicate ids')
        result.append(item)
    return result


def resolve_authoring_card_order(sequence_path: Path, manifest_path: Path) -> list[str]:
    manifest = _read_json_object(manifest_path)
    manifest_order = _exact_string_list(manifest.get('card_order'), 'manifest.card_order')
    if sequence_path.exists():
        if 'graph_order_policy' in manifest:
            raise ValueError('manifest.graph_order_policy is forbidden when sequence.json exists')
        sequence = _read_json_object(sequence_path)
        sequence_order = _exact_string_list(sequence.get('card_order'), 'sequence.card_order')
        if manifest_order != sequence_order:
            raise ValueError('manifest.card_order must exactly match sequence.card_order')
        return sequence_order
    if manifest.get('graph_order_policy') != MANIFEST_ONLY_POLICY:
        raise ValueError(
            f'manifest-only card order requires graph_order_policy={MANIFEST_ONLY_POLICY!r}'
        )
    return manifest_order


_MISSING = object()


def _first(record: dict[str, Any], fields: tuple[str, ...], *, default: Any = None) -> Any:
    for field in fields:
        if field in record:
            return record[field]
    return default


def _exact_string(value: Any, field: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or (not allow_empty and not value) or value.strip() != value:
        raise ValueError(f'{field} must be an exact string')
    if any(0xD800 <= ord(character) <= 0xDFFF for character in value):
        raise ValueError(f'{field} contains an invalid Unicode surrogate')
    return value


def normalize_overlay_links(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise ValueError('links must be an array')
    normalized: list[dict[str, Any]] = []
    for index, raw_link in enumerate(value):
        if not isinstance(raw_link, dict):
            raise ValueError(f'links[{index}] must be an object')
        raw_type = _exact_string(
            _first(raw_link, ('normalizedType', 'relationType', 'relation_type', 'relation', 'type')),
            f'links[{index}].relationType',
        )
        try:
            normalized_type = normalize_relation_type(raw_type)
        except ValueError as exc:
            raise ValueError(f'links[{index}] has an unknown relation type') from exc
        raw_strength = raw_link.get('strength')
        strength = (
            float(raw_strength)
            if isinstance(raw_strength, (int, float)) and not isinstance(raw_strength, bool)
            else None
        )
        if strength is not None and not math.isfinite(strength):
            strength = None
        if strength == 0:
            strength = 0.0
        raw_relation_id = _first(
            raw_link,
            ('relationId', 'relation_id', 'id'),
            default=_MISSING,
        )
        relation_id = '' if raw_relation_id is _MISSING else _exact_string(
            raw_relation_id,
            f'links[{index}].relationId',
            allow_empty=True,
        )
        normalized.append({
            'normalizedType': normalized_type,
            'relationId': relation_id,
            'sourceId': _exact_string(
                _first(raw_link, ('sourceId', 'source_id')),
                f'links[{index}].sourceId',
            ),
            'strength': strength,
            'targetId': _exact_string(
                _first(raw_link, ('targetId', 'target_id')),
                f'links[{index}].targetId',
            ),
        })
    normalized.sort(key=lambda link: (
        link['sourceId'],
        link['targetId'],
        link['normalizedType'],
        link['relationId'],
        0 if link['strength'] is None else 1,
        0 if link['strength'] is None else link['strength'],
    ))
    return normalized


def _jcs_string(value: str) -> str:
    _exact_string(value, 'JCS string', allow_empty=True)
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def _jcs_number(value: float) -> str:
    if not math.isfinite(value):
        raise ValueError('JCS numbers must be finite')
    if value == 0:
        return '0'
    raw = repr(float(value)).lower()
    decimal_value = abs(value)
    if 1e-6 <= decimal_value < 1e21:
        if 'e' not in raw:
            return raw[:-2] if raw.endswith('.0') else raw
        mantissa, exponent = raw.split('e')
        sign = '-' if mantissa.startswith('-') else ''
        unsigned = mantissa.removeprefix('-')
        integer_part, _, fraction_part = unsigned.partition('.')
        digits = integer_part + fraction_part
        decimal_position = len(integer_part) + int(exponent)
        if decimal_position <= 0:
            return f'{sign}0.{"0" * -decimal_position}{digits}'
        if decimal_position >= len(digits):
            return f'{sign}{digits}{"0" * (decimal_position - len(digits))}'
        return f'{sign}{digits[:decimal_position]}.{digits[decimal_position:]}'
    mantissa, exponent = raw.split('e') if 'e' in raw else (raw, '0')
    mantissa = mantissa.rstrip('0').rstrip('.') if '.' in mantissa else mantissa
    exponent_value = int(exponent)
    sign = '+' if exponent_value >= 0 else '-'
    return f'{mantissa}e{sign}{abs(exponent_value)}'


def _canonical_overlay_json(payload: dict[str, Any]) -> str:
    card_order = _exact_string_list(payload.get('cardOrder'), 'cardOrder')
    lesson_id = _exact_string(payload.get('lessonId'), 'lessonId')
    links = normalize_overlay_links(payload.get('links'))
    serialized_links = []
    for link in links:
        strength = 'null' if link['strength'] is None else _jcs_number(link['strength'])
        serialized_links.append(
            '{'
            f'"normalizedType":{_jcs_string(link["normalizedType"])},'
            f'"relationId":{_jcs_string(link["relationId"])},'
            f'"sourceId":{_jcs_string(link["sourceId"])},'
            f'"strength":{strength},'
            f'"targetId":{_jcs_string(link["targetId"])}'
            '}'
        )
    return (
        '{'
        f'"cardOrder":[{",".join(_jcs_string(item) for item in card_order)}],'
        f'"lessonId":{_jcs_string(lesson_id)},'
        f'"links":[{",".join(serialized_links)}]'
        '}'
    )


def build_overlay_revision(payload: dict[str, Any]) -> dict[str, str]:
    canonical_utf8 = _canonical_overlay_json(payload)
    return {
        'canonicalUtf8': canonical_utf8,
        'sha256': hashlib.sha256(canonical_utf8.encode('utf-8')).hexdigest(),
    }


def build_lesson_overlay_payload(
    *,
    graph_lesson_id: str,
    manifest: dict[str, Any],
    sequence: dict[str, Any],
    runtime_nodes: list[dict[str, Any]],
    runtime_relations: list[dict[str, Any]],
    reviewed_card_order: list[str],
) -> dict[str, Any]:
    node_ids = list(dict.fromkeys(
        list(manifest.get('focus_node_ids', []))
        + list(manifest.get('reuse_node_ids', []))
        + list(manifest.get('entry_nodes', []))
        + list(manifest.get('summary_nodes', []))
        + reviewed_card_order
    ))
    node_set = set(node_ids)
    overlay = {
        'lesson_id': graph_lesson_id,
        'title': manifest.get('title'),
        'focus_node_ids': manifest.get('focus_node_ids', []),
        'reuse_node_ids': manifest.get('reuse_node_ids', []),
        'entry_nodes': manifest.get('entry_nodes', []),
        'summary_nodes': manifest.get('summary_nodes', []),
        'card_order': reviewed_card_order,
        'groups': sequence.get('groups', []),
        'nodes': [node for node in runtime_nodes if node.get('id') in node_set],
        'links': [
            {
                'id': relation['relation_id'],
                'sourceId': relation['source_id'],
                'targetId': relation['target_id'],
                'relation': relation['relation_type'],
                'relationType': relation['relation_type'],
                'strength': relation['strength'],
            }
            for relation in runtime_relations
            if relation.get('source_id') in node_set and relation.get('target_id') in node_set
        ],
    }
    build_lesson_overlay_revision(overlay)
    return overlay


def build_lesson_overlay_revision(overlay: dict[str, Any]) -> dict[str, str]:
    return build_overlay_revision({
        'lessonId': overlay.get('lesson_id'),
        'cardOrder': overlay.get('card_order'),
        'links': overlay.get('links'),
    })
