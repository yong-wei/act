#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / 'media' / 'processed'
OUTPUT = PROCESSED / '3-4-cover-comic.png'


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Medium.ttc' if bold else '/System/Library/Fonts/STHeiti Light.ttc',
        '/System/Library/Fonts/Supplemental/Songti.ttc',
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def crop_cover(path: Path, size: tuple[int, int]) -> Image.Image:
    with Image.open(path) as img:
        src = img.convert('RGB')
    target_ratio = size[0] / size[1]
    src_ratio = src.width / src.height
    if src_ratio > target_ratio:
        new_width = int(src.height * target_ratio)
        left = (src.width - new_width) // 2
        src = src.crop((left, 0, left + new_width, src.height))
    else:
        new_height = int(src.width / target_ratio)
        top = (src.height - new_height) // 2
        src = src.crop((0, top, src.width, top + new_height))
    return src.resize(size, Image.Resampling.LANCZOS)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, box: tuple[int, int, int, int], font, fill):
    x0, y0, x1, y1 = box
    max_width = x1 - x0
    lines: list[str] = []
    current = ''
    for char in text:
        candidate = current + char
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = char
    if current:
        lines.append(current)
    line_height = font.size + 6 if hasattr(font, 'size') else 18
    y = y0
    for line in lines:
        if y + line_height > y1:
            break
        draw.text((x0, y), line, font=font, fill=fill)
        y += line_height


def add_panel(
    canvas: Image.Image,
    panel_box: tuple[int, int, int, int],
    image_name: str,
    panel_title: str,
    caption: str,
    bubble: str,
    accent: tuple[int, int, int],
    title_font,
    body_font,
):
    x0, y0, x1, y1 = panel_box
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(panel_box, radius=28, fill=(255, 255, 255), outline=(25, 33, 56), width=5)

    image_margin = 18
    image_box = (x0 + image_margin, y0 + image_margin + 34, x1 - image_margin, y0 + 250)
    image = crop_cover(PROCESSED / image_name, (image_box[2] - image_box[0], image_box[3] - image_box[1]))
    canvas.paste(image, image_box[:2])

    draw.rounded_rectangle((x0 + 16, y0 + 14, x0 + 166, y0 + 56), radius=18, fill=accent)
    draw.text((x0 + 28, y0 + 23), panel_title, font=title_font, fill=(255, 255, 255))

    bubble_box = (x0 + 24, y0 + 262, x1 - 24, y0 + 324)
    draw.rounded_rectangle(bubble_box, radius=20, fill=(248, 250, 255), outline=accent, width=3)
    draw.polygon(
        [(x0 + 72, y0 + 324), (x0 + 108, y0 + 324), (x0 + 90, y0 + 345)],
        fill=(248, 250, 255),
        outline=accent,
    )
    draw.text((bubble_box[0] + 16, bubble_box[1] + 14), bubble, font=body_font, fill=(34, 41, 66))

    draw_wrapped(draw, caption, (x0 + 22, y0 + 352, x1 - 22, y1 - 20), body_font, (60, 67, 94))


def main():
    canvas = Image.new('RGB', (1800, 1280), (244, 246, 252))
    draw = ImageDraw.Draw(canvas)

    title_font = load_font(64, bold=True)
    subtitle_font = load_font(30)
    panel_title_font = load_font(26, bold=True)
    body_font = load_font(26)

    draw.rounded_rectangle((36, 34, 1764, 152), radius=36, fill=(21, 38, 92))
    draw.text((76, 52), '单元 3-4 根轨迹读图与对象化验证', font=title_font, fill=(255, 255, 255))
    draw.text((82, 118), '从“它还稳定吗”走向“它到底值不值得选”', font=subtitle_font, fill=(219, 228, 255))

    panels = [
        ((72, 198, 872, 602), '3-4-root-locus-summary.png', '第1格 看主图', '“它还稳定，是不是就够了？”', '先别急着下结论，先把主图骨架看清楚。', (61, 113, 247)),
        ((928, 198, 1728, 602), '3-4-root-locus-keynodes.png', '第2格 找关键节点', '“分离点、虚轴交点，才是判断的抓手。”', '关键节点把“会看路径”推进成“会抓证据”。', (56, 154, 109)),
        ((72, 652, 872, 1056), '3-4-conditional-stability-window.png', '第3格 做换算', '“图上是 k，工程里最后要用 K。”', '稳定窗口和可接受窗口不能混成一句话。', (237, 128, 45)),
        ((928, 652, 1728, 1056), '3-4-bode-compare.png', '第4格 做验证', '“真正的判断，要让三个域都对得上！”', '根轨迹、时域、频域一起闭环，结论才站得住。', (178, 80, 171)),
    ]

    for panel in panels:
        add_panel(canvas, *panel, title_font=panel_title_font, body_font=body_font)

    footer_font = load_font(24)
    draw.text((84, 1140), '课堂固定产出：关键节点读图记录 / 参数窗口判断表 / 对象化验证记录', font=footer_font, fill=(58, 68, 96))
    draw.text((84, 1182), '工程主线：关键节点读图 → 参数窗口判断 → 增益换算 → 三域验证', font=footer_font, fill=(58, 68, 96))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT, format='PNG')
    print(f'已生成 {OUTPUT}')


if __name__ == '__main__':
    main()
