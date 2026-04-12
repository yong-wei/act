from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))
sys.path.append(str(ROOT / 'course-content' / 'scripts'))

from PIL import Image, ImageDraw

from pillow_font_fallback import (
    choose_cjk_font_specs,
    choose_symbol_font_specs,
    draw_text_with_fallback,
    load_font_from_specs,
)

OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'
W, H = 1800, 1120

BG = '#f7f8fc'
PANEL = '#ffffff'
TEXT = '#132238'
MUTED = '#5b677a'
LINE = '#d9deea'
BLUE = '#dbeafe'
BLUE_D = '#2563eb'
GREEN = '#dcfce7'
GREEN_D = '#15803d'
AMBER = '#fef3c7'
AMBER_D = '#b45309'
ROSE = '#ffe4e6'
ROSE_D = '#be123c'
SLATE = '#e2e8f0'
SLATE_D = '#334155'

PRIMARY_SPECS = choose_cjk_font_specs()
SYMBOL_SPECS = choose_symbol_font_specs()
TITLE_FONT = load_font_from_specs(PRIMARY_SPECS, 42)
SUBTITLE_FONT = load_font_from_specs(PRIMARY_SPECS, 20)
SECTION_FONT = load_font_from_specs(PRIMARY_SPECS, 30)
BODY_FONT = load_font_from_specs(PRIMARY_SPECS, 20)
SMALL_FONT = load_font_from_specs(PRIMARY_SPECS, 17)
EMPH_FONT = load_font_from_specs(choose_cjk_font_specs(bold=True), 22)
SYMBOL_FONT = load_font_from_specs(SYMBOL_SPECS, 22)


def canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new('RGB', (W, H), BG)
    return image, ImageDraw.Draw(image)


def save(image: Image.Image, filename: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    image.save(OUT_DIR / filename, format='PNG')


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str, outline: str = LINE, width: int = 2, radius: int = 20) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def wrap(text: str, font, max_width: int) -> list[str]:
    lines: list[str] = []
    for raw_line in text.splitlines():
        if not raw_line:
            lines.append('')
            continue
        current = ''
        for ch in raw_line:
            candidate = current + ch
            if font.getlength(candidate) <= max_width or not current:
                current = candidate
            else:
                lines.append(current)
                current = ch
        if current:
            lines.append(current)
    return lines


def draw_paragraph(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, font, max_width: int, fill: str = TEXT, line_gap: int = 8) -> int:
    lines = wrap(text, font, max_width)
    block = '\n'.join(lines)
    return draw_text_with_fallback(
        draw,
        (x, y),
        block,
        font,
        SYMBOL_FONT,
        fill,
        PRIMARY_SPECS,
        SYMBOL_SPECS,
        line_gap=line_gap,
    )


def draw_title(draw: ImageDraw.ImageDraw, title: str, subtitle: str) -> None:
    draw_text_with_fallback(draw, (72, 46), title, TITLE_FONT, SYMBOL_FONT, TEXT, PRIMARY_SPECS, SYMBOL_SPECS, line_gap=10)
    draw_text_with_fallback(draw, (74, 104), subtitle, SUBTITLE_FONT, SYMBOL_FONT, MUTED, PRIMARY_SPECS, SYMBOL_SPECS, line_gap=6)


def panel_title(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, color: str = TEXT) -> None:
    draw_text_with_fallback(draw, (x, y), text, SECTION_FONT, SYMBOL_FONT, color, PRIMARY_SPECS, SYMBOL_SPECS, line_gap=8)


def pill(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill: str, ink: str) -> None:
    width = int(BODY_FONT.getlength(text)) + 36
    rounded(draw, (x, y, x + width, y + 40), fill=fill, outline=fill, radius=18)
    draw_text_with_fallback(draw, (x + 18, y + 8), text, BODY_FONT, SYMBOL_FONT, ink, PRIMARY_SPECS, SYMBOL_SPECS, line_gap=6)


def render_indicator_role_matrix() -> None:
    image, draw = canvas()
    draw_title(draw, '4-1 指标角色矩阵', '把常见指标从“并列名词”改写成设计入口里的最小语言。')

    card_y = 170
    cols = [
        ('时域指标', BLUE, BLUE_D, ['回答问题：过程是否可接受', '典型指标：超调量、调节时间', '在 4-1 中常作：硬约束入口', '场景提醒：舒适、恢复过程、可接受性']),
        ('频域指标', GREEN, GREEN_D, ['回答问题：离风险边界还有多远', '典型指标：相角裕度、带宽频率、Mr', '在 4-1 中常作：硬约束补充 + 观察指标', '场景提醒：提速空间、峰化风险、储备']),
        ('积分误差', AMBER, AMBER_D, ['回答问题：全过程累计代价有多大', '典型指标：ISE、IAE、ITAE', '在 4-1 中常作：后续评价语言', '场景提醒：本课点到为止，不展开最优控制']),
    ]
    x = 60
    for title, fill, ink, lines in cols:
        rounded(draw, (x, card_y, x + 520, card_y + 540), fill=PANEL)
        rounded(draw, (x + 18, card_y + 18, x + 502, card_y + 84), fill=fill, outline=fill)
        panel_title(draw, x + 40, card_y + 32, title, ink)
        y = card_y + 118
        for line in lines:
            pill(draw, x + 34, y, line, fill, ink)
            y += 108
        x += 560

    rounded(draw, (72, 746, 1728, 1026), fill=PANEL)
    panel_title(draw, 102, 778, '4-1 的最短判断链')
    steps = [
        ('1', '先看时域', '先写“过程是否已经不可接受”。'),
        ('2', '再看频域', '再补“离边界还有多远”。'),
        ('3', '最后收口', '把积分误差留作后续评价语言。'),
    ]
    bx = 110
    for no, title, desc in steps:
        rounded(draw, (bx, 844, bx + 490, 984), fill=SLATE)
        pill(draw, bx + 22, 862, f'步骤 {no}', BLUE, BLUE_D)
        draw_paragraph(draw, bx + 24, 912, title, EMPH_FONT, 430)
        draw_paragraph(draw, bx + 24, 948, desc, SMALL_FONT, 430, fill=MUTED, line_gap=6)
        bx += 530

    save(image, '4-1-indicator-role-matrix.png')


def render_task_card_template() -> None:
    image, draw = canvas()
    draw_title(draw, '4-1 任务表达卡模板', '把对象、目标、边界和证据来源压成后续课次共享的输入卡。')

    rounded(draw, (64, 170, 1160, 1034), fill=PANEL)
    panel_title(draw, 96, 202, '六字段模板')
    fields = [
        ('控制对象', '当前到底在控制谁，结构图或对象说明是什么。'),
        ('控制目标', '希望跟随什么、抑制什么，场景任务是什么。'),
        ('硬约束', '哪些底线绝对不能破：稳定、超调、储备、安全。'),
        ('软目标', '守住底线后，继续争取更快、更准或更省。'),
        ('观察指标', '用哪些量跟踪收益与代价：带宽、Mr、摆舵频繁度。'),
        ('证据来源', '这些判断到底来自哪张图、哪个边界、哪条场景要求。'),
    ]
    box_w, box_h = 490, 212
    positions = [(96, 274), (608, 274), (96, 502), (608, 502), (96, 730), (608, 730)]
    colors = [(BLUE, BLUE_D), (GREEN, GREEN_D), (ROSE, ROSE_D), (AMBER, AMBER_D), (SLATE, SLATE_D), (BLUE, BLUE_D)]
    for (title, desc), (x, y), (fill, ink) in zip(fields, positions, colors):
        rounded(draw, (x, y, x + box_w, y + box_h), fill=fill, outline=fill)
        draw_paragraph(draw, x + 24, y + 22, title, EMPH_FONT, box_w - 48, fill=ink)
        draw_paragraph(draw, x + 24, y + 74, desc, BODY_FONT, box_w - 48, fill=TEXT)

    rounded(draw, (1200, 170, 1738, 1034), fill=PANEL)
    panel_title(draw, 1234, 202, '填写顺序')
    order = [
        '先写当前场景最不能接受的后果。',
        '再把后果落到具体指标上。',
        '再判断当前工作点有没有进可接受区域。',
        '最后才写排序和后续输入。',
    ]
    y = 288
    for idx, item in enumerate(order, start=1):
        pill(draw, 1236, y, f'{idx}. {item}', BLUE if idx % 2 else GREEN, BLUE_D if idx % 2 else GREEN_D)
        y += 114

    panel_title(draw, 1234, 738, '字段检查')
    checks = [
        '有没有写“最紧矛盾”？',
        '有没有把观察指标误写成硬约束？',
        '有没有给出证据来源？',
        '有没有偷跑到控制器名字？',
    ]
    y = 796
    for item in checks:
        draw_paragraph(draw, 1248, y, f'• {item}', BODY_FONT, 448)
        y += 62

    save(image, '4-1-task-card-template.png')


def render_region_layering() -> None:
    image, draw = canvas()
    draw_title(draw, '4-1 区域分层示意', '先筛边界，再谈可接受，最优比较留给后续课程。')

    rounded(draw, (64, 170, 1192, 1034), fill=PANEL)
    panel_title(draw, 96, 202, '三层区域')

    outer = (150, 290, 1100, 960)
    middle = (270, 402, 980, 850)
    inner = (430, 520, 820, 740)
    rounded(draw, outer, fill=BLUE, outline=BLUE_D, width=3, radius=42)
    rounded(draw, middle, fill=GREEN, outline=GREEN_D, width=3, radius=36)
    rounded(draw, inner, fill=AMBER, outline=AMBER_D, width=3, radius=30)

    draw_paragraph(draw, 188, 334, '可行域 F\n先排除不能做的。只要踩线，就不该继续留在桌面上。', EMPH_FONT, 330, fill=BLUE_D)
    draw_paragraph(draw, 326, 470, '满意域 S\n已经达到当前场景愿意接受的水平。', EMPH_FONT, 270, fill=GREEN_D)
    draw_paragraph(draw, 470, 578, '最优域 O\n在既定评价口径下，后续再比较谁更优。', EMPH_FONT, 240, fill=AMBER_D)

    draw.line((1180, 624, 1510, 624), fill=SLATE_D, width=4)
    draw.line((980, 626, 1510, 470), fill=SLATE_D, width=4)
    draw.line((820, 632, 1510, 820), fill=SLATE_D, width=4)

    rounded(draw, (1236, 236, 1736, 468), fill=PANEL)
    panel_title(draw, 1268, 266, '4-1 到此为止')
    draw_paragraph(draw, 1270, 326, '本课只负责：\n• 先把边界写清楚\n• 判断当前是否已可接受\n• 不提前求最优', BODY_FONT, 420, fill=TEXT)

    rounded(draw, (1236, 522, 1736, 790), fill=PANEL)
    panel_title(draw, 1268, 552, '判断顺序')
    draw_paragraph(draw, 1270, 612, '1. 先问：有没有踩硬约束。\n2. 再问：当前是否已经可接受。\n3. 最后才问：在可接受方案里谁更优。', BODY_FONT, 420, fill=TEXT)

    rounded(draw, (1236, 832, 1736, 1034), fill=PANEL)
    panel_title(draw, 1268, 860, '防误判')
    draw_paragraph(draw, 1270, 918, '稳定 ≠ 可接受\n可接受 ≠ 最优', EMPH_FONT, 360, fill=ROSE_D)

    save(image, '4-1-region-layering.png')


def render_case_compare_summary() -> None:
    image, draw = canvas()
    draw_title(draw, '4-1 双案例任务排序对照', '同一套跨域证据，在不同场景里会写出不同任务排序。')

    rounded(draw, (56, 170, 1744, 1034), fill=PANEL)
    panel_title(draw, 92, 204, '同图异读')

    rounded(draw, (92, 266, 786, 356), fill=BLUE, outline=BLUE)
    rounded(draw, (1014, 266, 1708, 356), fill=GREEN, outline=GREEN)
    draw_paragraph(draw, 118, 292, '主场景 A｜客船航向控制', EMPH_FONT, 600, fill=BLUE_D)
    draw_paragraph(draw, 1040, 292, '对照案例 B｜船载稳定平台', EMPH_FONT, 600, fill=GREEN_D)

    rows = [
        ('时域先暴露什么', '过程偏冲、偏拖，平顺性不足', '速度很快，但过程偏冒进'),
        ('根轨迹先提醒什么', '当前极点还没进入舒适导向的可行域', '当前极点还没进入“高速且高阻尼”的可行域'),
        ('幅频先提醒什么', '工作频带偏低，提速空间有限', '工作频带较高，速度优势已建立'),
        ('相频/裕度先提醒什么', '中频余量偏紧，提速不能冒进', '储备不足以支撑“高速度 + 低超调”同时成立'),
        ('入口排序怎么写', '平顺与储备优先，再谈提速', '速度与带宽前移，同时补足阻尼与储备'),
    ]
    y = 386
    row_h = 116
    for idx, (head, left, right) in enumerate(rows):
        fill = PANEL if idx % 2 == 0 else '#f8fafc'
        rounded(draw, (92, y, 1708, y + row_h), fill=fill, outline=LINE, radius=18)
        rounded(draw, (110, y + 16, 420, y + 100), fill=SLATE, outline=SLATE, radius=18)
        draw_paragraph(draw, 134, y + 32, head, EMPH_FONT, 250, fill=SLATE_D)
        draw_paragraph(draw, 456, y + 24, left, BODY_FONT, 260, fill=TEXT)
        draw_paragraph(draw, 1040, y + 24, right, BODY_FONT, 610, fill=TEXT)
        y += row_h + 12

    rounded(draw, (92, 980, 1708, 1034), fill=ROSE, outline=ROSE, radius=18)
    draw_paragraph(draw, 126, 994, '带走一句话：客船场景先守平顺与储备，稳定平台先保速度优势，但两个场景都不能放弃边界。', BODY_FONT, 1540, fill=ROSE_D)

    save(image, '4-1-case-compare-summary.png')


def main() -> None:
    render_indicator_role_matrix()
    render_task_card_template()
    render_region_layering()
    render_case_compare_summary()


if __name__ == '__main__':
    main()
