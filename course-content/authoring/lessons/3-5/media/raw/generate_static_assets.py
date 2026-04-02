#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path('/Users/YW/Documents/Site/act.just.edu.cn')
OUT_DIR = ROOT / 'course-content/authoring/lessons/3-5/media/processed'


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/Supplemental/Hiragino Sans GB.ttc',
        '/System/Library/Fonts/STHeiti Light.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size, index=1 if bold else 0)
        except Exception:
            continue
    return ImageFont.load_default()


def rounded_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: tuple[int, int, int], outline: tuple[int, int, int], radius: int = 26, width: int = 5) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_root_locus(draw: ImageDraw.ImageDraw, origin: tuple[int, int], scale: float, color: tuple[int, int, int], with_zero: bool = False) -> None:
    ox, oy = origin
    draw.line((ox - 170 * scale, oy, ox + 170 * scale, oy), fill=(90, 99, 112), width=int(3 * scale))
    draw.line((ox, oy - 125 * scale, ox, oy + 125 * scale), fill=(90, 99, 112), width=int(3 * scale))
    pts_top = []
    pts_bottom = []
    for i in range(100):
      x = -160 + i * (250 / 99)
      y = 90 * (1 - ((x + 35) / 140) ** 2)
      y = max(y, 0)
      pts_top.append((ox + x * scale, oy - y * scale))
      pts_bottom.append((ox + x * scale, oy + y * scale))
    draw.line(pts_top, fill=color, width=int(5 * scale))
    draw.line(pts_bottom, fill=color, width=int(5 * scale))
    draw.line((ox - 170 * scale, oy, ox - 58 * scale, oy), fill=color, width=int(5 * scale))
    draw.line((ox + 80 * scale, oy, ox + 170 * scale, oy), fill=color, width=int(5 * scale))
    for pole in (-58, 80):
        px = ox + pole * scale
        py = oy
        draw.line((px - 10 * scale, py - 10 * scale, px + 10 * scale, py + 10 * scale), fill=(30, 30, 30), width=int(4 * scale))
        draw.line((px - 10 * scale, py + 10 * scale, px + 10 * scale, py - 10 * scale), fill=(30, 30, 30), width=int(4 * scale))
    if with_zero:
        zx = ox - 130 * scale
        zy = oy
        draw.ellipse((zx - 10 * scale, zy - 10 * scale, zx + 10 * scale, zy + 10 * scale), outline=(242, 153, 74), width=int(4 * scale))


def make_cover() -> None:
    img = Image.new('RGB', (1200, 896), '#f6f1e8')
    draw = ImageDraw.Draw(img)
    title_font = load_font(48, bold=True)
    subtitle_font = load_font(22)
    bubble_font = load_font(34, bold=True)
    small_font = load_font(24)

    panels = [
        (42, 78, 578, 418),
        (622, 78, 1158, 418),
        (42, 470, 578, 810),
        (622, 470, 1158, 810),
    ]
    fills = ['#e8f1fb', '#fbf1e8', '#eef6eb', '#f9eef6']
    for box, fill in zip(panels, fills):
        rounded_panel(draw, box, fill=fill, outline=(50, 59, 73))

    # Panel 1
    draw_root_locus(draw, (220, 258), 1.0, (47, 111, 176), with_zero=False)
    rounded_panel(draw, (322, 96, 550, 222), fill=(255, 255, 255), outline=(50, 59, 73), radius=42, width=4)
    draw.text((350, 120), '只调增益，\n轨迹还是那一条！', font=bubble_font, fill=(30, 30, 30), spacing=6)
    draw.text((74, 118), '一、增益边界已经露出来', font=subtitle_font, fill=(26, 72, 112))

    # Panel 2
    draw_root_locus(draw, (804, 258), 1.0, (196, 76, 36), with_zero=True)
    draw.line((717, 334, 868, 182), fill=(242, 153, 74), width=5)
    rounded_panel(draw, (690, 96, 1098, 222), fill=(255, 255, 255), outline=(50, 59, 73), radius=42, width=4)
    draw.text((720, 120), '零点一进来，\n根轨迹骨架就改了。', font=bubble_font, fill=(30, 30, 30), spacing=6)
    draw.text((654, 244), '二、左半平面零点把分支拉走', font=subtitle_font, fill=(128, 63, 0))

    # Panel 3
    rounded_panel(draw, (78, 558, 262, 744), fill=(255, 255, 255), outline=(74, 144, 217))
    rounded_panel(draw, (354, 558, 538, 744), fill=(255, 255, 255), outline=(74, 144, 217))
    draw.text((114, 584), 'PD', font=load_font(56, bold=True), fill=(217, 72, 1))
    draw.text((390, 584), '测速反馈', font=load_font(42, bold=True), fill=(31, 120, 180))
    draw.text((96, 654), '都能增大阻尼', font=small_font, fill=(30, 30, 30))
    draw.text((382, 654), '但前向零点不一样', font=small_font, fill=(30, 30, 30))
    draw.text((74, 500), '三、同样减小超调，结构副作用却不同', font=subtitle_font, fill=(33, 94, 54))

    # Panel 4
    draw.line((700, 700, 1104, 700), fill=(120, 120, 120), width=3)
    draw.line((904, 528, 904, 782), fill=(120, 120, 120), width=3)
    draw.line((788, 700, 1010, 700), fill=(178, 34, 34), width=5)
    draw.line((904, 700, 1014, 598), fill=(178, 34, 34), width=5)
    draw.line((904, 700, 980, 728), fill=(178, 34, 34), width=5)
    draw.ellipse((990, 690, 1018, 718), outline=(178, 34, 34), width=4)
    rounded_panel(draw, (680, 520, 1120, 620), fill=(255, 255, 255), outline=(50, 59, 73), radius=42, width=4)
    draw.text((708, 544), '右半平面零点一出现，\n“改善动态”就要带条件。', font=load_font(30, bold=True), fill=(30, 30, 30), spacing=4)
    draw.text((654, 500), '四、非最小相会先把输出拉反方向', font=subtitle_font, fill=(119, 41, 83))

    draw.text((52, 18), '单元 3-5｜零点引入与动态改善', font=title_font, fill=(24, 35, 54))
    draw.text((56, 842), '同一对象对照：根轨迹骨架改变 -> 阻尼变化 -> 频域代价 -> 非最小相边界', font=small_font, fill=(70, 70, 70))
    img.save(OUT_DIR / '3-5-cover-comic.png')


def make_info() -> None:
    img = Image.new('RGB', (2752, 1536), '#f7fafc')
    # soft glow background
    glow = Image.new('RGB', img.size, '#f7fafc')
    gd = ImageDraw.Draw(glow)
    gd.ellipse((120, 90, 1260, 1120), fill='#e7f0ff')
    gd.ellipse((1420, 180, 2550, 1220), fill='#fff4e6')
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    img.paste(glow, (0, 0))
    draw = ImageDraw.Draw(img)

    title_font = load_font(78, bold=True)
    section_font = load_font(46, bold=True)
    body_font = load_font(28)
    small_font = load_font(22)
    formula_font = load_font(34, bold=True)

    draw.text((90, 54), '零点引入与动态改善：从根轨迹重排到非最小相边界', font=title_font, fill=(18, 25, 38))
    draw.text((94, 146), '同一对象上建立四段判断链：零点进入哪里，轨迹怎样改写，动态收益是否值得，以及右半平面零点为什么会变成约束。', font=body_font, fill=(60, 72, 88))

    road = [(170, 520), (660, 360), (1140, 520), (1610, 410), (2100, 600), (2480, 520)]
    for width, color in [(56, (61, 123, 196)), (32, (130, 181, 242))]:
        draw.line(road, fill=color, width=width, joint='curve')

    cards = [
        ((120, 760, 650, 1300), '#eaf3ff', '1. 根轨迹先改骨架', ['纯增益：只沿原轨迹移动', '左半平面零点：分支被零点吸引', '右半平面零点：镜像位置却带来反向后果']),
        ((748, 760, 1278, 1300), '#fff5e9', '2. PD 与测速反馈', ['共同点：都能提高等效阻尼', '差异：PD 显式增加前向零点', '测速反馈：单位负反馈外环 + 速度项局部反馈']),
        ((1376, 760, 1906, 1300), '#eef8ef', '3. PD 与超前', ['零点位置可以相同', '超前多了更靠左的极点', '频域上相角提升更受控']),
        ((2004, 760, 2634, 1300), '#fbecf3', '4. 非最小相边界', ['名称来源：相位不再是最小', '典型现象：逆响应', '控制动作：保守带宽，先保相位裕度']),
    ]
    for box, fill, title, bullets in cards:
        rounded_panel(draw, box, fill=fill, outline=(82, 101, 132), radius=34, width=5)
        draw.text((box[0] + 26, box[1] + 24), title, font=section_font, fill=(24, 35, 54))
        y = box[1] + 108
        for bullet in bullets:
            draw.text((box[0] + 34, y), f'• {bullet}', font=body_font, fill=(48, 57, 71))
            y += 78

    rounded_panel(draw, (174, 300, 690, 618), fill=(255, 255, 255), outline=(74, 144, 217), radius=30, width=5)
    draw.text((212, 334), '根轨迹语言', font=section_font, fill=(36, 86, 144))
    draw_root_locus(draw, (430, 492), 1.25, (47, 111, 176), with_zero=True)
    draw.text((214, 564), '零点先改变终点分配，再改变主导极点可达区。', font=small_font, fill=(60, 72, 88))

    rounded_panel(draw, (906, 250, 1450, 560), fill=(255, 255, 255), outline=(217, 72, 1), radius=30, width=5)
    draw.text((946, 284), '阻尼统一表达', font=section_font, fill=(168, 60, 10))
    draw.text((964, 382), 'ζ_PD = ζ + 0.5 K_d ω_n', font=formula_font, fill=(18, 25, 38))
    draw.text((964, 452), 'ζ_v = ζ + 0.5 K_t ω_n', font=formula_font, fill=(18, 25, 38))

    rounded_panel(draw, (1644, 240, 2250, 590), fill=(255, 255, 255), outline=(52, 124, 97), radius=30, width=5)
    draw.text((1682, 274), '频域后果', font=section_font, fill=(35, 103, 78))
    draw.line((1716, 496, 2190, 496), fill=(98, 110, 125), width=3)
    draw.line((1716, 374, 2190, 430), fill=(42, 157, 143), width=6)
    draw.line((1716, 394, 2190, 522), fill=(217, 72, 1), width=6)
    draw.text((1706, 536), 'PD：高频更积极；超前：指定频带做整形。', font=small_font, fill=(60, 72, 88))

    rounded_panel(draw, (2280, 250, 2600, 590), fill=(255, 255, 255), outline=(178, 34, 34), radius=30, width=5)
    draw.text((2312, 284), '非最小相', font=section_font, fill=(135, 24, 24))
    draw.line((2360, 492, 2520, 492), fill=(98, 110, 125), width=3)
    draw.line((2360, 492, 2406, 538), fill=(178, 34, 34), width=6)
    draw.line((2406, 538, 2484, 454), fill=(178, 34, 34), width=6)
    draw.text((2310, 534), '右半平面零点先让输出反向，再限制带宽。', font=small_font, fill=(60, 72, 88))

    draw.text((164, 1420), '课堂主线：同一对象对照 -> 根轨迹重排 -> 时域/频域双验证 -> 非最小相风险边界', font=load_font(34, bold=True), fill=(26, 38, 56))
    draw.text((166, 1470), '建议在互动课中将四段分别映射为：例 1 纯极点对照、例 2 PD/测速反馈、例 3 PD/超前、例 4 右半平面零点。', font=small_font, fill=(72, 84, 96))
    img.save(OUT_DIR / '3-5-info.png')


if __name__ == '__main__':
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    make_cover()
    make_info()
