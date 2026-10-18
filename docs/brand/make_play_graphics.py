# Play Store graphics: 512x512 icon and 1024x500 feature graphic. Usage: python make_play_graphics.py <repo root>
import sys
from PIL import Image, ImageDraw, ImageFont
root=sys.argv[1]
icon=Image.open(f'{root}/apps/mobile/assets/images/icon.png').convert('RGB').resize((512,512),Image.LANCZOS)
icon.save(f'{root}/docs/release/graphics/play-icon-512.png')
BG=(234,246,230)
fg=Image.new('RGB',(1024,500),BG)
logo=Image.open(f'{root}/apps/mobile/assets/images/logo-horizontal.png').convert('RGBA')
w=640; h=round(logo.height*w/logo.width)
logo=logo.resize((w,h),Image.LANCZOS)
fg.paste(logo,((1024-w)//2,150-h//2+40),logo)
d=ImageDraw.Draw(fg)
try: font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',44)
except Exception: font=ImageFont.load_default()
t='Never forget to water a plant again.'
tw=d.textlength(t,font=font)
d.text(((1024-tw)/2,330),t,fill=(31,61,36),font=font)
fg.save(f'{root}/docs/release/graphics/play-feature-1024x500.png')
print(icon.size,icon.mode,fg.size,fg.mode)
