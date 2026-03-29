from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[6]
LESSON_MEDIA = ROOT / 'course-content/authoring/lessons/2-2/media/processed'
SHIP_CASE_MEDIA = ROOT / 'course-content/resource-library/ship-control-cases/assets/processed'
OUTPUT = LESSON_MEDIA / '2-2-ship-01-three-case-time-response-gallery.png'

CANVAS_W = 1980
CANVAS_H = 1400
BG = '#f5f7fb'
TITLE = '#12314d'
TEXT = '#27445d'
MUTED = '#5f7387'
CARD_BG = '#ffffff'
CARD_BORDER = '#d7e1ec'
HILIGHT = '#0f8b8d'
ACCENTS = ['#2a9d8f', '#e9c46a', '#457b9d']

CASES = [
    {
        'title': '航向控制',
        'subtitle': '给定阶跃 + 正弦扰动共同作用',
        'source': SHIP_CASE_MEDIA / '3.1-船舶航向控制时域分析实例-figure-07.png',
        'feature': '关注点：跟踪与抗扰同时出现',
        'fit': '指标适用性：可参考，读值需结合扰动背景',
        'why': '曲线同时包含命令跟踪与海浪扰动影响，单一二阶指标只能描述主趋势。',
    },
    {
        'title': '横摇减摇鳍',
        'subtitle': '单位阶跃扰动响应',
        'source': SHIP_CASE_MEDIA / '3.2-船舶横摇减摇鳍控制时域分析实例-figure-02.png',
        'feature': '关注点：振荡明显，阻尼不足',
        'fit': '指标适用性：可定性比较，不宜机械套公式',
        'why': '该对象主要在抗扰工况下暴露振荡衰减快慢，更适合用“振荡强弱”做课堂比较。',
    },
    {
        'title': '稳定平台',
        'subtitle': '单位阶跃跟踪响应（K=5）',
        'source': SHIP_CASE_MEDIA / '3.3-船载稳定平台控制系统时域分析实例-figure-02.png',
        'feature': '关注点：超调大但速度快',
        'fit': '指标适用性：最适合直接套用本课指标语言',
        'why': '这是最接近标准欠阻尼阶跃响应的案例，峰值、超调与调节时间都容易直接标读。',
    },
]


def choose_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size, index=1 if bold and path.endswith('.ttc') else 0)
        except Exception:
            continue
    return ImageFont.load_default()


def crop_white_border(img: Image.Image, padding: int = 18) -> Image.Image:
    rgb = img.convert('RGB')
    bg = Image.new('RGB', rgb.size, '#ffffff')
    diff = ImageChops.difference(rgb, bg)
    bbox = diff.getbbox()
    if not bbox:
        return rgb
    left = max(0, bbox[0] - padding)
    upper = max(0, bbox[1] - padding)
    right = min(rgb.width, bbox[2] + padding)
    lower = min(rgb.height, bbox[3] + padding)
    return rgb.crop((left, upper, right, lower))


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = list(text)
    lines: list[str] = []
    current = ''
    for ch in words:
        trial = current + ch
        width = draw.textbbox((0, 0), trial, font=font)[2]
        if width <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = ch
    if current:
        lines.append(current)
    return lines


def fit_image(img: Image.Image, box_w: int, box_h: int) -> Image.Image:
    cropped = crop_white_border(img)
    return ImageOps.contain(cropped, (box_w, box_h), Image.Resampling.LANCZOS)


def main() -> None:
    canvas = Image.new('RGB', (CANVAS_W, CANVAS_H), BG)
    draw = ImageDraw.Draw(canvas)
    title_font = choose_font(44, bold=True)
    subtitle_font = choose_font(22)
    card_title_font = choose_font(30, bold=True)
    card_subtitle_font = choose_font(20)
    body_font = choose_font(20)
    badge_font = choose_font(18, bold=True)
    source_font = choose_font(18)

    draw.text((96, 68), '三类船舶对象的时域响应对照', fill=TITLE, font=title_font)
    draw.text(
        (96, 128),
        '同一套“快慢 / 振荡 / 指标适用性”语言，在不同对象上体现出的重点并不相同。',
        fill=MUTED,
        font=subtitle_font,
    )
    draw.rounded_rectangle((96, 176, CANVAS_W - 96, 192), radius=8, fill='#d7e9f3')

    margin_x = 96
    gap = 36
    card_w = (CANVAS_W - 2 * margin_x - 2 * gap) // 3
    card_h = 1040
    top_y = 230
    image_box_h = 560

    for idx, case in enumerate(CASES):
        x0 = margin_x + idx * (card_w + gap)
        y0 = top_y
        x1 = x0 + card_w
        y1 = y0 + card_h
        draw.rounded_rectangle((x0, y0, x1, y1), radius=28, fill=CARD_BG, outline=CARD_BORDER, width=3)
        draw.rounded_rectangle((x0 + 24, y0 + 24, x0 + 160, y0 + 58), radius=16, fill=ACCENTS[idx])
        draw.text((x0 + 42, y0 + 31), f'案例 {idx + 1}', fill='white', font=badge_font)
        draw.text((x0 + 24, y0 + 84), case['title'], fill=TITLE, font=card_title_font)
        draw.text((x0 + 24, y0 + 124), case['subtitle'], fill=MUTED, font=card_subtitle_font)

        img = Image.open(case['source'])
        fitted = fit_image(img, card_w - 48, image_box_h)
        img_x = x0 + (card_w - fitted.width) // 2
        img_y = y0 + 170 + (image_box_h - fitted.height) // 2
        canvas.paste(fitted, (img_x, img_y))

        divider_y = y0 + 170 + image_box_h + 24
        draw.line((x0 + 24, divider_y, x1 - 24, divider_y), fill='#e7eef5', width=3)

        text_y = divider_y + 24
        for label, content in [
            ('动态特征', case['feature']),
            ('课堂判断', case['fit']),
            ('工程提示', case['why']),
        ]:
            draw.text((x0 + 24, text_y), label, fill=HILIGHT, font=badge_font)
            text_y += 32
            for line in wrap_text(draw, content, body_font, card_w - 48):
                draw.text((x0 + 24, text_y), line, fill=TEXT, font=body_font)
                text_y += 30
            text_y += 12

        source = f"来源：{case['source'].name}"
        draw.text((x0 + 24, y1 - 48), source, fill=MUTED, font=source_font)

    footer = '教学用途：step-14 资源库对照。制作方式：基于 ship-control-cases 现有图源统一裁切、排版与标注。'
    draw.text((96, CANVAS_H - 56), footer, fill=MUTED, font=source_font)

    LESSON_MEDIA.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT, quality=95)


if __name__ == '__main__':
    main()
