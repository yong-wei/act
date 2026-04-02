#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path('/Users/YW/Documents/Site/act.just.edu.cn')
OUT_DIR = ROOT / 'course-content/authoring/lessons/3-5/media/processed'

FONT_TITLE = '/Users/YW/Library/Fonts/FangZhengHeiTi-GBK-1.ttf'
FONT_BODY = '/System/Library/Fonts/Hiragino Sans GB.ttc'
FONT_SERIF = '/System/Library/Fonts/Supplemental/Songti.ttc'


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size, index=index)


def draw_centered(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, ft: ImageFont.FreeTypeFont, fill: tuple[int, int, int], spacing: int = 4) -> None:
    bbox = draw.multiline_textbbox((0, 0), text, font=ft, spacing=spacing, align='center')
    x = box[0] + (box[2] - box[0] - (bbox[2] - bbox[0])) / 2
    y = box[1] + (box[3] - box[1] - (bbox[3] - bbox[1])) / 2
    draw.multiline_text((x, y), text, font=ft, fill=fill, spacing=spacing, align='center')


def rounded_box(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], radius: int, fill, outline, width: int = 3) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def generate_cover() -> None:
    size = (1400, 900)
    img = Image.new('RGB', size, '#f4efe5')
    draw = ImageDraw.Draw(img)

    # background gradient bands
    for i in range(size[1]):
        ratio = i / size[1]
        r = int(244 * (1 - ratio) + 224 * ratio)
        g = int(239 * (1 - ratio) + 238 * ratio)
        b = int(229 * (1 - ratio) + 247 * ratio)
        draw.line([(0, i), (size[0], i)], fill=(r, g, b))

    title_font = font(FONT_TITLE, 56)
    subtitle_font = font(FONT_BODY, 28, index=0)
    label_font = font(FONT_BODY, 24, index=0)
    note_font = font(FONT_SERIF, 26, index=0)

    draw.text((78, 58), '单元 3-5', font=label_font, fill='#7a3e12')
    draw.text((78, 110), '零点引入与动态改善', font=title_font, fill='#12263a')
    draw.text((82, 188), '为什么改变结构后，轨迹和响应会一起变', font=subtitle_font, fill='#36536b')

    # main split scene
    left = (70, 270, 680, 790)
    right = (720, 270, 1330, 790)
    rounded_box(draw, left, 26, '#fffdf8', '#2d4f6c', 4)
    rounded_box(draw, right, 26, '#fffdf8', '#2d4f6c', 4)

    # left panel: gain-only
    draw.text((100, 300), '只调增益', font=font(FONT_TITLE, 32), fill='#8f2d1f')
    draw.line([(120, 700), (610, 700)], fill='#666666', width=3)
    draw.line([(360, 340), (360, 730)], fill='#888888', width=2)
    draw.line([(175, 700), (330, 610), (425, 560), (585, 520)], fill='#1f78b4', width=8)
    for x, y in [(330, 610), (425, 560), (585, 520)]:
        draw.ellipse((x - 11, y - 11, x + 11, y + 11), fill='#1f78b4', outline='white', width=3)
    bubble = (110, 360, 310, 510)
    rounded_box(draw, bubble, 20, '#fff6ed', '#c4773f', 3)
    draw_centered(draw, bubble, '还在原轨迹上\n找更好的点', note_font, '#5b3a29')
    draw.polygon([(300, 488), (335, 520), (295, 515)], fill='#fff6ed', outline='#c4773f')

    # right panel: zero introduced
    draw.text((760, 300), '引入零点', font=font(FONT_TITLE, 32), fill='#125b50')
    draw.line([(770, 700), (1260, 700)], fill='#666666', width=3)
    draw.line([(1010, 340), (1010, 730)], fill='#888888', width=2)
    draw.line([(810, 700), (810, 455)], fill='#117a65', width=8)
    draw.arc((760, 415, 1165, 815), start=210, end=510, fill='#d94801', width=8)
    draw.line([(810, 700), (1000, 700)], fill='#d94801', width=8)
    draw.ellipse((915 - 12, 700 - 12, 915 + 12, 700 + 12), fill='white', outline='#d94801', width=4)
    bubble2 = (1035, 385, 1240, 540)
    rounded_box(draw, bubble2, 20, '#eefbf8', '#47a28b', 3)
    draw_centered(draw, bubble2, '轨迹骨架\n会被重排', note_font, '#184f45')
    draw.polygon([(1045, 500), (1018, 545), (1070, 525)], fill='#eefbf8', outline='#47a28b')

    footer = (70, 820, 1330, 865)
    rounded_box(draw, footer, 18, '#ffffffcc', '#c9b89c', 2)
    draw_centered(draw, footer, '主线：同一对象对照  ->  根轨迹改变  ->  时域变化  ->  频域解释  ->  风险边界', font(FONT_BODY, 24), '#3d4b59')

    img.save(OUT_DIR / '3-5-cover-comic.png')


def generate_info() -> None:
    size = (2752, 1536)
    img = Image.new('RGB', size, '#f8fbff')
    draw = ImageDraw.Draw(img)

    for i in range(size[1]):
        ratio = i / size[1]
        draw.line([(0, i), (size[0], i)], fill=(248 - int(12 * ratio), 251 - int(8 * ratio), 255 - int(20 * ratio)))

    title_font = font(FONT_TITLE, 84)
    h_font = font(FONT_TITLE, 54)
    body_font = font(FONT_BODY, 32)
    mini_font = font(FONT_BODY, 26)

    draw.text((120, 80), '零点引入与动态改善：一张图带走 3-5 的判断链', font=title_font, fill='#102a43')

    chain_y = 240
    cards = [
        ('01', '零点引入', '先问是不是改变了零极点结构。', '#fff4e6', '#d97706'),
        ('02', '根轨迹重排', '再看实轴区段、终点分配和主导分支。', '#eff6ff', '#2563eb'),
        ('03', '动态改善', '把极点移动翻译成超调、调节时间与共振峰。', '#ecfdf5', '#059669'),
        ('04', '风险边界', '最后判断高频代价、逆响应与速度上限。', '#fff1f2', '#e11d48'),
    ]
    x = 120
    for num, title, text, bg, stroke in cards:
        rounded_box(draw, (x, chain_y, x + 575, chain_y + 250), 28, bg, stroke, 4)
        draw.text((x + 28, chain_y + 24), num, font=font(FONT_TITLE, 36), fill=stroke)
        draw.text((x + 28, chain_y + 88), title, font=h_font, fill='#16324f')
        draw.multiline_text((x + 30, chain_y + 155), text, font=body_font, fill='#3d4b59', spacing=8)
        x += 650

    road = [(180, 650), (650, 650), (860, 770), (1260, 770), (1500, 940), (1930, 940), (2220, 1120), (2550, 1120)]
    draw.line(road, fill='#2b6cb0', width=30, joint='curve')
    draw.line(road, fill='#90cdf4', width=10, joint='curve')

    # three comparison panels
    panels = [
        (140, 860, 760, 1360, 'PD vs 测速反馈', '相同点：都能提高等效阻尼\n不同点：PD 显式引入零点，测速反馈没有', '#fff7ed', '#ea580c'),
        (860, 860, 1480, 1360, 'PD vs 超前', '零点位置可接近\n但超前多了一个极点来约束高频代价', '#f0fdf4', '#16a34a'),
        (1580, 860, 2610, 1360, '非最小相', '右半平面零点 = 非最小相\n最典型现象：逆响应 + 额外相位滞后', '#eff6ff', '#2563eb'),
    ]
    for x1, y1, x2, y2, title, text, bg, stroke in panels:
        rounded_box(draw, (x1, y1, x2, y2), 26, bg, stroke, 4)
        draw.text((x1 + 28, y1 + 26), title, font=h_font, fill='#102a43')
        draw.multiline_text((x1 + 30, y1 + 120), text, font=body_font, fill='#334e68', spacing=10)
        # tiny icon sketch
        cy = y2 - 120
        draw.line([(x1 + 70, cy), (x1 + 300, cy)], fill='#64748b', width=4)
        draw.line([(x1 + 185, cy - 90), (x1 + 185, cy + 90)], fill='#94a3b8', width=3)
        draw.line([(x1 + 90, cy), (x1 + 185, cy - 55), (x1 + 260, cy - 15)], fill=stroke, width=8)
        draw.ellipse((x1 + 210, cy - 14, x1 + 234, cy + 10), outline=stroke, width=4, fill='white')
        draw.text((x2 - 250, y2 - 85), '实例先行\n三域对照', font=mini_font, fill=stroke, spacing=6)

    footer = (120, 1440, 2630, 1496)
    rounded_box(draw, footer, 18, '#ffffff', '#bfdbfe', 2)
    draw_centered(draw, footer, '课末记忆句：先看有没有引入零点，再看零点在左还是在右；先看动态改善，再看改善的代价落在哪里。', font(FONT_BODY, 30), '#16324f')

    img = img.filter(ImageFilter.UnsharpMask(radius=1.4, percent=120, threshold=3))
    img.save(OUT_DIR / '3-5-info.png')


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    generate_cover()
    generate_info()


if __name__ == '__main__':
    main()
