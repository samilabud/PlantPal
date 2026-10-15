# Regenerates the in-app logo images (transparent, light + dark variants) from plantpal-logo.png:
#   python docs/brand/make_logos.py docs/brand/plantpal-logo.png apps/mobile/assets/images
import sys

import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
h, w, _ = img.shape

chroma = img.max(axis=2) - img.min(axis=2)
dark = 255 - img.mean(axis=2)
alpha = np.clip((np.maximum(chroma, dark * 0.9) - 22) / (60 - 22), 0, 1)

# Split mark (plant + pot) from wordmark at the empty band between them.
gap = [r for r in range(int(h * 0.55), int(h * 0.75)) if alpha[r].max() < 0.2]
cut = gap[len(gap) // 2]

def crop(a, rgb):
    ys, xs = np.where(a > 0.5)
    y0, y1, x0, x1 = ys.min() - 4, ys.max() + 5, xs.min() - 4, xs.max() + 5
    return Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8)[y0:y1, x0:x1], 'RGBA')

def variant(rgb, dark_mode):
    if not dark_mode:
        return rgb
    rgb = rgb.copy()
    # Only the wordmark's dark-green "plant" half would vanish on a dark background. The mark's
    # dark leaf shading must stay, so recolour only below the cut, and only pixels whose green
    # channel is low (dark green); the bright "pal" green has a high green channel.
    # A smooth weight keeps anti-aliased edges clean instead of speckled.
    text = rgb[cut:]
    weight = np.clip((135 - text[..., 1]) / 45, 0, 1)[..., None]
    light = np.array([232, 236, 231], dtype=np.float32)
    rgb[cut:] = text * (1 - weight) + light * weight
    return rgb

for dark_mode, suffix in ((False, ''), (True, '-dark')):
    rgb = variant(img, dark_mode)
    a_mark, a_text = alpha.copy(), alpha.copy()
    a_mark[cut:] = 0
    a_text[:cut] = 0
    mark, text = crop(a_mark, rgb), crop(a_text, rgb)

    # Stacked lockup (sign-in screen): mark above the wordmark, like the original logo.
    gap_px = int(text.height * 0.35)
    stacked = Image.new('RGBA', (max(mark.width, text.width), mark.height + gap_px + text.height), (0, 0, 0, 0))
    stacked.alpha_composite(mark, ((stacked.width - mark.width) // 2, 0))
    stacked.alpha_composite(text, ((stacked.width - text.width) // 2, mark.height + gap_px))
    stacked.thumbnail((600, 600), Image.LANCZOS)
    stacked.save(f'{out}/logo-stacked{suffix}.png')

    # Horizontal lockup (header): mark at 1.25x the wordmark height, beside it.
    m = mark.resize((round(mark.width * text.height * 1.25 / mark.height), round(text.height * 1.25)), Image.LANCZOS)
    space = int(text.height * 0.3)
    row = Image.new('RGBA', (m.width + space + text.width, m.height), (0, 0, 0, 0))
    row.alpha_composite(m, (0, 0))
    row.alpha_composite(text, (m.width + space, (m.height - text.height) // 2 + int(text.height * 0.08)))
    row = row.resize((round(row.width * 120 / row.height), 120), Image.LANCZOS)  # 3x of a 40pt header
    row.save(f'{out}/logo-horizontal{suffix}.png')

print('written to', out)

# Mark only (plant + pot), small and transparent: placeholder for plants without a photo.
a_mark = alpha.copy()
a_mark[cut:] = 0
mark_only = crop(a_mark, img)
mark_only.thumbnail((256, 256), Image.LANCZOS)
mark_only.save(f'{out}/logo-mark.png')
