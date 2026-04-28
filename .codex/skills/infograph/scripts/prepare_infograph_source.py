#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from typing import Any

from infograph_utils import (
    extract_section,
    lesson_manifest_path,
    load_all_authoring_nodes,
    load_authoring_relations,
    load_sequence,
    node_card_path,
    node_group_map,
    node_infograph_dir,
    now_iso,
    parse_frontmatter,
    read_json,
    repo_path,
    strip_frontmatter,
    write_json,
    write_text,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Prepare source package and prompt for one node infographic.')
    parser.add_argument('--lesson', required=True, help='Lesson id such as 3-8')
    parser.add_argument('--node', required=True, help='Knowledge node id')
    return parser.parse_args()


def compact_markdown(text: str, max_chars: int = 1800) -> str:
    normalized = re.sub(r'\n{3,}', '\n\n', text.strip())
    if len(normalized) <= max_chars:
        return normalized
    return normalized[:max_chars].rstrip() + '\n...'


def extract_bold_field(markdown: str, label: str) -> str:
    match = re.search(rf'\*\*{re.escape(label)}\*\*：\s*(.+)', markdown)
    return match.group(1).strip() if match else ''


def extract_first_display_formula(markdown: str) -> str:
    match = re.search(r'\$\$\s*([\s\S]*?)\s*\$\$', markdown)
    if not match:
        return ''
    return re.sub(r'\s+', ' ', match.group(1).strip())


def relation_mentions_node(relation: dict[str, Any], node_id: str, node_name: str) -> bool:
    return (
        relation.get('source_id') == node_id
        or relation.get('target_id') == node_id
        or relation.get('source') == node_name
        or relation.get('target') == node_name
        or relation.get('source_name') == node_name
        or relation.get('target_name') == node_name
    )


def relation_summary(relation: dict[str, Any], node_id: str) -> dict[str, Any]:
    return {
        'source_id': relation.get('source_id'),
        'source': relation.get('source') or relation.get('source_name'),
        'target_id': relation.get('target_id'),
        'target': relation.get('target') or relation.get('target_name'),
        'relation': relation.get('relation') or relation.get('relation_type'),
        'strength': relation.get('strength'),
        'description': relation.get('description'),
        'direction_for_node': (
            'outgoing' if relation.get('source_id') == node_id else
            'incoming' if relation.get('target_id') == node_id else
            'by_name'
        ),
    }


def visual_focus_for_node(node_name: str, groups: list[str]) -> str:
    text = f'{node_name} {" ".join(groups)}'
    if '幅角原理' in text:
        return '用复平面闭合曲线、原点绕行圈数、曲线内部零点和极点表达 N=Z-P 的计数关系。'
    if '统一判稳链' in text or ('奈奎斯特' in text and 'Bode' in text):
        return '左侧画 Nyquist 复平面与 -1 临界点，右侧画 Bode 的 0dB 与 -180° 两条读数线，中间用稳定边界连接。'
    if '零点' in text and '右半平面' in text:
        return '用 s 平面左右半平面、根轨迹方向和响应代价提示表达“改善受限制、非最小相要谨慎”。'
    if '零点' in text:
        return '用根轨迹弯曲、阻尼区域和阶跃响应趋势表达结构变化如何改变动态性能。'
    if '低频' in text or '稳态' in text or '补偿' in text:
        return '用低频段增益抬升、误差下降和相位代价检查表达稳态改善路径。'
    if 'Bode' in text or '裕度' in text or '截止频率' in text or '穿越频率' in text:
        return '用 Bode 幅频/相频双图、穿越线和裕度标尺表达读图位置。'
    if '带宽' in text:
        return '用闭环幅频曲线、低频平台、-3 dB 下降线和 ω_b 入口表达“跟得多快”的频域边界。'
    if '超前' in text:
        return '用目标裕度、目标频带、补角窗口、超前网络参数和时域验收五步表达设计方向。'
    if '综合' in text or '统一' in text or '指纹' in text or '读回' in text:
        return '用“频域指纹 -> 判稳余量 -> 三频段任务 -> 闭环读回”的链条表达工程判断，不堆叠公式。'
    if '频率特性' in text or '带宽' in text or '三频段' in text:
        return '用低频-中频-高频三段横向分区表达稳态、快速性、抗噪声之间的分工。'
    if 'Nyquist' in text or '奈奎斯特' in text:
        return '用复平面围线、关键点 -1 和方向箭头表达判稳逻辑，避免画成普通波形图。'
    return '用概念核心、证据位置和判断边界三块表达该知识点，不添加源材料之外的对象。'


def build_prompt(source: dict[str, Any]) -> str:
    node = source['node']
    lesson = source['lesson']
    groups = [str(item) for item in lesson.get('groups') or []]
    relations = source['relations'][:6]
    relation_label_map = {
        'contains': '包含',
        'leads_to': '引出',
        'generalizes': '概括',
        'cross_domain': '跨域连接',
        'applies_to': '应用于',
        'prerequisite': '前置',
        'related': '相关',
        'opposite': '对照',
    }
    relation_lines = []
    for item in relations:
        relation = str(item.get('relation') or '')
        relation_lines.append(
            f"- {item.get('source') or item.get('source_id')} --{relation_label_map.get(relation, relation)}--> "
            f"{item.get('target') or item.get('target_id')}: {item.get('description') or ''}"
        )

    formulas = node.get('formulas') or []
    formula_line = '；'.join(str(item) for item in formulas[:2]) if formulas else '不在图中渲染长公式，只保留短符号锚点。'
    short_symbol_line = formula_line if formulas else '只放与主题直接相关的短符号。'
    keywords = [str(item) for item in (node.get('keywords') or [])[:8]]
    text_allowlist = [node['name'], *keywords]
    visual_focus = visual_focus_for_node(str(node['name']), groups)

    return f"""请使用 GPT Image 2 / Codex 最新图片生成能力，制作一张横版中文教学信息图。

主题：{node['name']}
所属课程单元：{lesson['lesson_id']}《{lesson.get('title', '')}》
所属分组：{'、'.join(groups) if groups else '未分组'}
知识类型：{node.get('knowledge_type') or node.get('category') or '知识点'}

事实真源如下，禁止添加未出现的事实、公式、术语或工程案例：

一句话定义：
{node.get('definition') or source.get('card_overview', '')}

核心直觉：
{source.get('core_intuition', '')}

关键公式锚点：
{formula_line}

本课关系：
{chr(10).join(relation_lines) if relation_lines else '- 无显式关系，按知识卡片内容呈现。'}

建议视觉骨架：
{visual_focus}

图像要求：
- 横版信息图，适合放在互动课程入口的知识点详情中。
- 中文为主，不使用英文大标题；英文只允许作为小号副标题。
- 不要把“课程单元、所属分组、知识类型、事实真源、关键公式锚点、公式锚点、图像要求”等元数据或提示词字段画进图面。
- 不要整句复刻“一句话定义”；把定义压缩成 3-5 个短标签或短判断。
- 全图可见中文标签控制在 12 个以内；单个标签尽量不超过 10 个汉字，不放解释段落。
- 图中的关系标签统一使用中文，不要显示 contains、leads_to、cross_domain 等英文关系类型。
- 采用“核心直觉 -> 机理路径 -> 边界提醒”的三段式视觉结构。
- 只使用少量短中文标签，优先使用这些词：{'、'.join(text_allowlist[:10]) if text_allowlist else node['name']}。
- 右侧用简洁小面板表达判断结果或边界，不写长段落。
- 不要绘制密集数学公式；不要让公式变形。若需要公式，只放关键公式锚点中的短符号：{short_symbol_line}
- 不要出现教师、课堂、流程说明、软件界面、二维码、水印。
- 字体清晰，文字少而准确，避免密集段落。
- 不要使用纯蓝或纯紫单色风格；使用白底、深墨色文字、青绿/橙色强调和少量红色边界提示。
"""


def main() -> None:
    args = parse_args()
    sequence = load_sequence(args.lesson)
    card_order = [str(item) for item in sequence.get('card_order', [])]
    if args.node not in card_order:
        raise SystemExit(f'Node {args.node} is not in {args.lesson} card_order')

    manifest = read_json(lesson_manifest_path(args.lesson)) if lesson_manifest_path(args.lesson).exists() else {}
    groups = node_group_map(sequence).get(args.node, [])
    card_path = node_card_path(args.node)
    card_markdown = card_path.read_text(encoding='utf-8') if card_path.exists() else ''
    frontmatter = parse_frontmatter(card_markdown)
    nodes = load_all_authoring_nodes(args.lesson)
    node = nodes.get(args.node)
    if not node:
        if not card_path.exists():
            raise SystemExit(f'Missing node data and card for {args.node}')
        node = {
            'id': args.node,
            'name': frontmatter.get('name') or args.node,
            'name_en': frontmatter.get('name_en'),
            'category': frontmatter.get('category'),
            'knowledge_type': frontmatter.get('knowledge_type'),
            'bloom_level': frontmatter.get('bloom_level'),
            'definition': frontmatter.get('definition'),
            'examples': frontmatter.get('examples') or [],
            'formulas': frontmatter.get('formulas') or [],
            'keywords': frontmatter.get('keywords') or [],
        }
    overview = extract_section(card_markdown, '首页')
    detail = extract_section(card_markdown, '详情')

    card_definition = extract_bold_field(overview, '一句话定义')
    core_intuition = extract_bold_field(overview, '核心直觉')
    card_formula = extract_first_display_formula(overview)

    node_name = str(node.get('name') or frontmatter.get('name') or args.node)
    related_relations = [
        relation_summary(relation, args.node)
        for relation in load_authoring_relations(args.lesson)
        if relation_mentions_node(relation, args.node, node_name)
    ][:12]

    source = {
        'schema_version': 1,
        'created_at': now_iso(),
        'lesson': {
            'lesson_id': args.lesson,
            'title': manifest.get('title'),
            'groups': groups,
            'card_order_index': card_order.index(args.node) + 1,
        },
        'node': {
            'id': args.node,
            'name': node_name,
            'name_en': node.get('name_en') or frontmatter.get('name_en'),
            'category': node.get('category') or frontmatter.get('category'),
            'knowledge_type': node.get('knowledge_type') or frontmatter.get('knowledge_type'),
            'bloom_level': node.get('bloom_level') or frontmatter.get('bloom_level'),
            'definition': node.get('definition') or card_definition,
            'examples': node.get('examples') or [],
            'formulas': node.get('formulas') or ([card_formula] if card_formula else []),
            'keywords': node.get('keywords') or [],
        },
        'card_path': repo_path(card_path) if card_path.exists() else None,
        'card_frontmatter': frontmatter,
        'card_overview': compact_markdown(overview, 1400),
        'card_detail': compact_markdown(detail, 1600),
        'card_plain_excerpt': compact_markdown(strip_frontmatter(card_markdown), 2200),
        'core_intuition': core_intuition,
        'relations': related_relations,
        'constraints': {
            'facts_must_come_from_source': True,
            'no_long_formula_rendering': True,
            'target_use': 'interactive lesson entry and global knowledge graph node detail',
        },
    }

    output_dir = node_infograph_dir(args.lesson, args.node)
    write_json(output_dir / 'source.json', source)
    write_text(output_dir / 'prompt.md', build_prompt(source))
    print(repo_path(output_dir / 'source.json'))
    print(repo_path(output_dir / 'prompt.md'))


if __name__ == '__main__':
    main()
