from pathlib import Path
import os

from PIL import Image, ImageDraw, ImageOps


root = Path(os.environ.get('STAGE_A_PDF_RENDER_ROOT', '.runtime/stage-a-pdf-verification'))
output = root / 'contact-sheets'
output.mkdir(exist_ok=True)
images = sorted(root.rglob('*.png'))
thumb_width = 900
thumb_height = 1250
gap = 40
label_height = 44
sheet_width = 2 * thumb_width + 3 * gap
sheet_height = 2 * (thumb_height + label_height) + 3 * gap

for index in range(0, len(images), 4):
    sheet = Image.new('RGB', (sheet_width, sheet_height), 'white')
    draw = ImageDraw.Draw(sheet)
    for offset, path in enumerate(images[index:index + 4]):
        column = offset % 2
        row = offset // 2
        x = gap + column * (thumb_width + gap)
        y = gap + row * (thumb_height + label_height + gap)
        image = Image.open(path).convert('RGB')
        sheet.paste(ImageOps.contain(image, (thumb_width, thumb_height)), (x, y + label_height))
        draw.text((x, y), str(path.relative_to(root)), fill='black')
    sheet.save(output / f'sheet-{index // 4 + 1:02d}.jpg', quality=92)

print(f'pages={len(images)} sheets={(len(images) + 3) // 4}')
