# Regenerates the app icons from plantpal-logo.png (needs Pillow + numpy):
#   python docs/brand/make_icons.py docs/brand/plantpal-logo.png apps/mobile/assets/images
import sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
h, w, _ = img.shape

# "Ink" = colourful or dark pixels; the background is near-white with a faint green tint.
chroma = img.max(axis=2) - img.min(axis=2)
dark = 255 - img.mean(axis=2)
score = np.maximum(chroma, dark * 0.9)
alpha = np.clip((score - 22) / (60 - 22), 0, 1)

# Keep only the plant + pot (everything above the wordmark).
rows = np.where(alpha.max(axis=1) > 0.5)[0]
gap_rows = [r for r in range(int(h * 0.55), int(h * 0.75)) if alpha[r].max() < 0.2]
cut = gap_rows[len(gap_rows) // 2] if gap_rows else int(h * 0.64)
alpha[cut:, :] = 0
ys, xs = np.where(alpha > 0.5)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
pad = 6
y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
y1, x1 = min(h, y1 + pad), min(w, x1 + pad)

rgba = np.dstack([img, alpha * 255]).astype(np.uint8)[y0:y1, x0:x1]
mark = Image.fromarray(rgba, 'RGBA')
print(f'wordmark cut at y={cut}, mark bbox {x1-x0}x{y1-y0}')

BG = (234, 246, 230)  # light leaf green, close to the logo's background

def place(canvas_size, fraction, background=None, mono=False):
    canvas = Image.new('RGBA', (canvas_size, canvas_size), background + (255,) if background else (0, 0, 0, 0))
    m = mark.copy()
    scale = fraction * canvas_size / max(m.size)
    m = m.resize((round(m.width * scale), round(m.height * scale)), Image.LANCZOS)
    if mono:
        a = m.split()[3]
        m = Image.new('RGBA', m.size, (255, 255, 255, 255))
        m.putalpha(a)
    canvas.alpha_composite(m, ((canvas_size - m.width) // 2, (canvas_size - m.height) // 2))
    return canvas

# iOS / store icon: 1024, full bleed, opaque (iOS rejects transparency), mark ~62%.
place(1024, 0.62, BG).convert('RGB').save(f'{out}/icon.png')
# Android adaptive: the launcher masks a 108dp layer to ~66dp, so keep the mark inside ~58%.
place(1024, 0.56).save(f'{out}/android-icon-foreground.png')
Image.new('RGB', (1024, 1024), BG).save(f'{out}/android-icon-background.png')
place(1024, 0.56, mono=True).save(f'{out}/android-icon-monochrome.png')
# Splash: transparent mark, the background colour comes from app config.
place(1024, 0.9).save(f'{out}/splash-icon.png')
place(48, 0.8, BG).convert('RGB').save(f'{out}/favicon.png')
print('written to', out)
