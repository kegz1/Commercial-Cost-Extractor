#!/usr/bin/env bash
# Downloads the optimised generated assets for a creator page and drops them
# into creators/<slug>/assets/, then points creator.json at them.
#
#   ./scripts/fetch-generated-assets.sh kuki-monsters
#
# The bundle was generated with Google models on Higgsfield (Nano Banana /
# Nano Banana 2 for images, Veo 3.1 Lite for the hero loops) and compressed
# with ImageMagick + ffmpeg. It is a gzipped tar despite the .zip name.
# Contents (≈650 KB total):
#   bg-sunset-16x9.jpg  bg-sunset-9x16.jpg  tapa-divider.webp  og-share.jpg
#   thumb-placeholder-{1..4}.webp  hero-loop-16x9.mp4  hero-loop-9x16.mp4
set -euo pipefail
SLUG="${1:-kuki-monsters}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/creators/$SLUG"
ASSETS="$DIR/assets"
JSON="$DIR/data/creator.json"
BUNDLE_URL="${BUNDLE_URL:-https://d2ol7oe51mr4n9.cloudfront.net/user_3EyfhG9hhYTG7CkgTHKaOxqxt5Y/7f7c67f7-c474-40d2-8de3-e618960d225e.zip}"

[ -d "$ASSETS" ] || { echo "no such creator folder: $DIR" >&2; exit 1; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
echo "→ downloading bundle"
if curl -fsSL -o "$tmp/bundle.tgz" "$BUNDLE_URL" && tar xzf "$tmp/bundle.tgz" -C "$ASSETS"; then
  echo "→ bundle extracted"
else
  echo "→ bundle unavailable, rebuilding from the original generations (needs magick/convert + ffmpeg)"
  command -v ffmpeg >/dev/null || { echo "ffmpeg missing" >&2; exit 1; }
  CONVERT="$(command -v magick || command -v convert)"; [ -n "$CONVERT" ] || { echo "ImageMagick missing" >&2; exit 1; }
  B=https://d8j0ntlcm91z4.cloudfront.net/user_3EyfhG9hhYTG7CkgTHKaOxqxt5Y
  curl -fsSL -o "$tmp/bg16.png" $B/hf_20260929_005518_6ab81a17-1f2c-43c1-9e6f-c26519d71f2a.png
  curl -fsSL -o "$tmp/bg9.png"  $B/hf_20260929_005518_a4fe3b06-a35b-440f-b171-26eb285ea7f0.png
  curl -fsSL -o "$tmp/tapa.png" $B/hf_20260929_005518_d0d670e0-8397-48c3-9fa0-4966349cac57.png
  curl -fsSL -o "$tmp/t1.png"   $B/hf_20260929_005518_ae675869-f43d-46f1-a6c9-54175e08fcef.png
  curl -fsSL -o "$tmp/t2.png"   $B/hf_20260929_005518_54249a98-79d8-45cf-9f16-6ea9103baf6b.png
  curl -fsSL -o "$tmp/t3.png"   $B/hf_20260929_005518_8c072e5b-c581-4fd0-b2fe-b1557fe78298.png
  curl -fsSL -o "$tmp/t4.png"   $B/hf_20260929_005518_9b915794-0f6c-456a-93aa-c44b19f1c18e.png
  curl -fsSL -o "$tmp/og.png"   $B/hf_20260929_005518_101bff36-5df7-4b75-aba8-55f09c8c9e0e.png
  curl -fsSL -o "$tmp/h16.mp4"  $B/hf_20260929_005522_1b405327-c541-4351-98fe-cad57c1b106a.mp4
  curl -fsSL -o "$tmp/h9.mp4"   $B/hf_20260929_005522_95cfe25a-92e1-49b3-b789-a9db516061c9.mp4
  "$CONVERT" "$tmp/bg16.png" -resize 1600x -strip -interlace Plane -sampling-factor 4:2:0 -quality 62 "$ASSETS/bg-sunset-16x9.jpg"
  "$CONVERT" "$tmp/bg9.png"  -resize x1400 -strip -interlace Plane -sampling-factor 4:2:0 -quality 62 "$ASSETS/bg-sunset-9x16.jpg"
  "$CONVERT" "$tmp/tapa.png" -resize 1000x -strip -quality 50 -define webp:method=6 "$ASSETS/tapa-divider.webp"
  for i in 1 2 3 4; do "$CONVERT" "$tmp/t$i.png" -resize 480x854^ -gravity center -extent 480x854 -strip -quality 62 -define webp:method=6 "$ASSETS/thumb-placeholder-$i.webp"; done
  "$CONVERT" "$tmp/og.png" -resize 1200x1200 -strip -quality 65 "$ASSETS/og-share.jpg"
  ffmpeg -y -loglevel error -i "$tmp/h16.mp4" -an -vf "scale=960:-2,fps=24" -c:v libx264 -preset veryslow -crf 35 -pix_fmt yuv420p -movflags +faststart "$ASSETS/hero-loop-16x9.mp4"
  ffmpeg -y -loglevel error -i "$tmp/h9.mp4"  -an -vf "scale=-2:960,fps=24" -c:v libx264 -preset veryslow -crf 35 -pix_fmt yuv420p -movflags +faststart "$ASSETS/hero-loop-9x16.mp4"
fi
echo "→ extracted:"; ls -l "$ASSETS" | grep -E '\.(jpg|webp|mp4)$'

# Point creator.json at the binary versions (the SVG fallbacks stay in the repo).
if command -v node >/dev/null; then
  node - "$JSON" <<'NODE'
const fs = require("fs"); const f = process.argv[2];
const c = JSON.parse(fs.readFileSync(f, "utf8"));
c.theme = c.theme || {};
c.theme.heroVideo = { landscape: "assets/hero-loop-16x9.mp4", portrait: "assets/hero-loop-9x16.mp4", poster: "assets/bg-sunset-16x9.jpg", posterPortrait: "assets/bg-sunset-9x16.jpg" };
c.theme.divider = "assets/tapa-divider.webp";
c.theme.ogImage = "assets/og-share.jpg";
c.placeholderThumbs = [1, 2, 3, 4].map((i) => `assets/thumb-placeholder-${i}.webp`);
fs.writeFileSync(f, JSON.stringify(c, null, 2) + "\n");
console.log("→ updated", f);
NODE
else
  echo "node not found — edit theme.heroVideo / theme.divider / theme.ogImage / placeholderThumbs in $JSON by hand"
fi
echo "done. Commit creators/$SLUG/assets and data/creator.json."
