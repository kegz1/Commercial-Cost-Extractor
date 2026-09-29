# TODO — Kuki Monsters creator page

Things I could not find or verify from the build environment. Everything below is a
one-line edit in `data/creator.json` unless noted.

## Blocked by network (tiktok.com is not reachable from the build sandbox)

- [ ] **Video URLs for all 15 review cards** — `reviews[].tiktokUrl` is empty for every card, so each
      card links to the profile (https://www.tiktok.com/@kuki.monsters) instead of the video.
      Paste the `https://www.tiktok.com/@kuki.monsters/video/<id>` URL for:
      Punjabi Bytes · Vanilla Bar · Zesty Cup · Donut Burger · Toatakeova Lamb Buns ·
      Viral Cake In A Can (Drizzl Dessert Bar) · Mr. Puff · Viral Pineapple Kool-Aid ·
      Viral Butter Dipped Cone · Cloud Soufflé Pancakes · Hulu House Tanghulu · Dragon's Breath ·
      Viral Magnum Croissant · Chris Williams Mr Pulled · Mama's Premium Watermelon Otai.
      Once a URL is in, the card swaps to the official TikTok embed on tap and pulls the real thumbnail.
- [ ] **View counts** — only Punjabi Bytes (44.5K) and Vanilla Bar (13.4K) are known. Others show no count.
- [ ] **Live stats function** — `tiktok-stats.js` could not be exercised against the real profile from here
      (proxy blocks tiktok.com). It returns the fallback numbers with `stale: true` in that case. Run
      `netlify dev` on your machine and hit `/api/tiktok-stats?creator=kuki-monsters` to confirm real numbers.

## Assets

- [ ] **Run `./scripts/fetch-generated-assets.sh kuki-monsters`** from your machine and commit the result.
      The generated backgrounds / tapa divider / placeholder thumbs / hero loops (≈650 KB, already optimised)
      are sitting in Higgsfield storage; the build sandbox could not write binaries into the repo, so the page
      currently uses SVG/CSS fallbacks. The upload-confirmation step on Higgsfield was blocked by a permission
      rule, so if the bundle URL 404s the script falls back to rebuilding from the original generations
      (needs ffmpeg + ImageMagick).
- [ ] **Real logo** — the screenshots/logo were not attached to the session, so `assets/logo.svg` is a
      placeholder wordmark in the same style (gold brushed text on black, "COOK ISLANDS" underneath).
      Drop the real file in as `assets/logo.png` (or .svg) and point `logo` in creator.json at it.
- [ ] Generated imagery came from Google models on Higgsfield: Nano Banana / Nano Banana 2 for images
      (the catalogue has no model named "Imagen") and Veo 3.1 Lite for the two hero loops.

## Creator details to confirm

- [ ] Instagram and YouTube handles (`socials.instagram.url`, `socials.youtube.url`, set `comingSoon: false`).
- [ ] Creator contact email for form notifications (`mediaKit.contactEmail`).
- [ ] Audience numbers in the media kit (`mediaKit.audience[]` — all marked "update").
- [ ] Kuki Score per review (`reviews[].kukiScore`, currently "—").
- [ ] Suburb for each venue (`reviews[].suburb`, currently empty) and cuisine labels (best guesses from the titles).
- [ ] Venue websites/Instagram (`reviews[].venueUrl`) and, where they exist, Secret Kitchens pages
      (`reviews[].secretKitchensUrl`). Without either, the card shows "Watch the review" + the invite link.
- [ ] Confirm `network.registerUrl` (currently https://secret-kitchens.com/register) is the real cook
      registration form; the `?ref=kuki-monsters` param is appended automatically.

## Integrations (blank slate — nothing is connected yet)

- [ ] Resend: verify sending domain, set `RESEND_API_KEY`, `RESEND_FROM`, `SK_NOTIFY_EMAIL`.
- [ ] Supabase: run `supabase/migrations/20260929000000_creator_kitchen_suggestions.sql` on the Secret Kitchens
      project, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Netlify.
- [ ] Netlify: connect the repo; `netlify.toml` already sets publish dir, functions dir and `/api/*` redirect.
- [x] Lighthouse mobile: 94 (LCP 1.1 s, TBT 90 ms, CLS 0.14) on `netlify dev` with the SVG fallbacks. Re-check after the assets land.
- [ ] `netlify dev` note: the CLI downloads a Deno runtime for Edge Functions on first run; on a locked-down
      network put a Deno ≥ 2.4 binary on PATH (or in `~/.netlify/deno-cli/` with a `version.txt`) and it starts fine.
