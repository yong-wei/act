#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'media' / 'processed' / '3-4-gain-conversion-card.png'


def load_font(size: int, bold: bool = False):
    candidates = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/Supplemental/Songti.ttc',
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    img = Image.new('RGB', (1500, 920), (248, 249, 253))
    draw = ImageDraw.Draw(img)
    title_font = load_font(58, bold=True)
    subtitle_font = load_font(28)
    body_font = load_font(34)
    mono_font = load_font(44, bold=True)

    draw.rounded_rectangle((46, 42, 1454, 182), radius=34, fill=(21, 38, 92))
    draw.text((86, 74), '根轨迹增益换算卡', font=title_font, fill=(255, 255, 255))
    draw.text((88, 138), '先读图上的 k，再换成工程里的 K', font=subtitle_font, fill=(218, 227, 255))

    boxes = [
        ((80, 238, 710, 820), '1. 先看图上参数', '根轨迹主图里首先读到的是\ n等效增益 k，不是最终控制器增益。', 'k = 0.0104', (61, 113, 247)),
        ((790, 238, 1420, 820), '2. 再换成工程参数', '对本课对象有\nk = 0.01715K\n所以\nK = k / 0.01715', 'K ≈ 0.6064', (237, 128, 45)),
    ]

    for box, title, desc, formula, accent in boxes:
        x0, y0, x1, y1 = box
        draw.rounded_rectangle(box, radius=28, fill=(255, 255, 255), outline=accent, width=5)
        draw.rounded_rectangle((x0 + 18, y0 + 18, x0 + 340, y0 + 70), radius=18, fill=accent)
        draw.text((x0 + 34, y0 + 28), title, font=body_font, fill=(255, 255, 255))
        draw.multiline_text((x0 + 34, y0 + 110), desc.replace('\\ n', '\n'), font=body_font, fill=(45, 54, 78), spacing=14)
        draw.rounded_rectangle((x0 + 34, y0 + 320, x1 - 34, y0 + 470), radius=20, fill=(247, 249, 255))
        draw.text((x0 + 70, y0 + 368), formula, font=mono_font, fill=accent)

    draw.rounded_rectangle((120, 842, 1380, 886), radius=18, fill=(230, 235, 247))
    draw.text((156, 848), '提醒：不换算，参数窗口判断就无法直接落到工程控制器。', font=subtitle_font, fill=(45, 54, 78))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, format='PNG')
    print(f'已生成 {OUT}')


if __name__ == '__main__':
    main()
