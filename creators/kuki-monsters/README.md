# Secret Kitchens creator page — Kuki Monsters

First instance of the reusable creator-profile template. Will later be served at
`creators.secret-kitchens.com/<handle>`; for now it lives at `/creators/kuki-monsters/`.

```
creators/kuki-monsters/
├── index.html            # the whole page (HTML + CSS + JS). Nothing creator-specific inside.
├── data/creator.json     # ALL creator content: name, handle, bio, socials, stats, theme, reviews[]
├── assets/               # logo, SVG fallbacks (divider, thumbs), qrcode.min.js — plus the generated
│                         # jpg/webp/mp4 set once you run scripts/fetch-generated-assets.sh
├── README.md             # this file
└── TODO.md               # things that still need filling in by a human
netlify/functions/
├── tiktok-stats.js       # live follower / like / video counters (6h cache, fallback to creator.json)
└── creator-forms.js      # "Work with me" + "Suggest a kitchen" -> Resend / Supabase
supabase/migrations/…creator_kitchen_suggestions.sql   # table for the suggestions
scripts/fetch-generated-assets.sh   # pulls the generated imagery + hero loops into assets/
tests/tiktok-stats.test.js          # npm test
```

## Generated assets (one-off step)

The atmospheric backgrounds, tapa divider, placeholder thumbnails and the two hero
loops were generated with Google models on Higgsfield (Nano Banana / Nano Banana 2,
Veo 3.1 Lite) and compressed to ~650 KB total. They could not be written into the
repo from the build sandbox, so the page ships with SVG/CSS fallbacks and you run:

```bash
./scripts/fetch-generated-assets.sh kuki-monsters   # needs curl; ffmpeg + ImageMagick only for the rebuild path
git add creators/kuki-monsters && git commit -m "Add generated assets"
```

The script downloads the optimised bundle, extracts it into `assets/`, and rewrites
`theme.heroVideo`, `theme.divider`, `theme.ogImage` and `placeholderThumbs` in
`creator.json` to point at the jpg/webp/mp4 files. If the bundle URL has expired it
re-downloads the original generations and rebuilds them with the same settings.

## Run locally

```bash
npm install
npm run dev            # netlify dev -> http://localhost:8888/creators/kuki-monsters/
npm test               # parser unit tests
curl http://localhost:8888/api/tiktok-stats?creator=kuki-monsters
```

`tiktok-stats` scrapes the public TikTok profile page. On a network that blocks
tiktok.com it returns the fallback numbers from `creator.json` with `"stale": true`
and the page shows a "showing saved numbers" note. Set the fallback numbers whenever
you touch the file so the page never looks wrong.

## Environment variables (Netlify UI → Site settings → Environment variables)

| Variable            | Used by            | Notes                                                     |
| ------------------- | ------------------ | --------------------------------------------------------- |
| `RESEND_API_KEY`    | creator-forms      | Resend API key                                            |
| `RESEND_FROM`       | creator-forms      | e.g. `Secret Kitchens Creators <creators@secret-kitchens.com>` (verified domain) |
| `SK_NOTIFY_EMAIL`   | creator-forms      | Secret Kitchens inbox that gets a copy of every submission |
| `SUPABASE_URL`      | creator-forms      | `https://<project-ref>.supabase.co`                       |
| `SUPABASE_SERVICE_ROLE_KEY` | creator-forms | server-side only; the function inserts with it (RLS has no anon policy) |
| `SUPABASE_SUGGESTIONS_TABLE` | creator-forms | defaults to `creator_kitchen_suggestions`               |

Without these the forms still work in "demo mode": the function returns
`delivered: false`, logs the payload, and the page says so. The creator's own
address goes in `creator.json → mediaKit.contactEmail`.

Suggestions land in the `creator_kitchen_suggestions` table. Apply
`supabase/migrations/20260929000000_creator_kitchen_suggestions.sql` to the Secret
Kitchens project (SQL editor or `supabase db push`); it creates the table with RLS on and
no anon policies, so only the function's service-role insert gets through.

## Clone this for the next creator

1. `cp -r creators/kuki-monsters creators/<new-handle>` (handle = lowercase, hyphens).
2. Edit `creators/<new-handle>/data/creator.json`:
   - `slug` must equal the folder name (the functions look up `creators/<slug>/data/creator.json`).
   - `handle`, `name`, `bio`, `tagline`, `hook`, `location`, `areas`, `whatTheyLookFor`.
   - `socials.*.url` — leave empty + `comingSoon: true` to show a disabled "coming soon" button.
   - `fallbackStats` — copy from their TikTok profile the day you build it, set `asOf`.
   - `theme` — accent colours, and swap the asset paths if you generate a new look.
   - `reviews[]` — one object per video. `kukiScore` is free text (`"8.5"` renders as 8.5/10, `"—"` shows a blank badge).
     `secretKitchensUrl` wins over `venueUrl`; leave both empty and the card links to the video with an "invite them" link.
     `kitchen: false` keeps a review (e.g. a viral snack test) out of the "Kitchens they've discovered" strip.
     `thumbnail` (optional) overrides the placeholder image.
   - `network.utm` / `network.ref` — change the campaign to the new handle.
3. Replace `assets/logo.svg` (or point `logo` at a PNG) and, if you want, regenerate the
   backgrounds / hero loops. Keep them small: the hero loops here are ~170–250 KB.
4. Add the creator's real video URLs as you find them — the card then upgrades itself to
   the official TikTok embed on tap and pulls the real thumbnail via oEmbed.
5. Commit, push; Netlify deploys the folder as-is. Nothing else to configure.

## Notes

- Lighthouse (mobile, simulated throttling, `netlify dev`): performance 94, LCP 1.1 s, TBT 90 ms, CLS 0.14.
  Re-run with `npm run lighthouse` after adding the generated assets (they are lazy, so the score should hold).
- Fonts: Anton (display) + Inter (body) from Google Fonts, loaded non-blocking.
- Hero video only loads after `load`, never on `prefers-reduced-motion` or `saveData`.
- TikTok embeds and the QR library load lazily on interaction / scroll.
- Every link to `secret-kitchens.com` gets `?utm_source=creator&utm_medium=page&utm_campaign=<slug>`,
  every CTA has a `data-ref` attribute for click tracking.
- Open Graph tags are set by JS from `creator.json`. Crawlers that don't run JS will see the
  generic title; if that matters, hard-code the four `og:` tags per creator at clone time.
