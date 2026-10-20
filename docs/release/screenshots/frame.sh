#!/bin/sh
# Fits a raw phone capture onto the 1440 x 2560 (9:16) brand canvas Google Play accepts:
# no alpha, max side <= 2 x min side. Uses macOS sips.
#   docs/release/screenshots/frame.sh raw.png out.png
set -e
in="$1"; out="$2"
tmp="$(mktemp -d)/frame.png"
sips --resampleHeight 2400 "$in" --out "$tmp" >/dev/null
sips --padToHeightWidth 2560 1440 --padColor EAF6E6 "$tmp" --out "$tmp" >/dev/null
# Through JPEG and back: drops the alpha channel that Play rejects.
sips -s format jpeg -s formatOptions 95 "$tmp" --out "${tmp%.png}.jpg" >/dev/null
sips -s format png "${tmp%.png}.jpg" --out "$out" >/dev/null
