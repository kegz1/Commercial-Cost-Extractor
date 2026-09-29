// netlify/functions/tiktok-stats.js
//
// Live TikTok counters for a Secret Kitchens creator page.
//
//   GET /api/tiktok-stats?creator=kuki-monsters
//   -> { handle, followers, likes, following, videos, stale, source, fetchedAt, cachedUntil }
//
// HOW IT WORKS
//   1. Reads creators/<slug>/data/creator.json for the TikTok handle and fallback stats.
//   2. Fetches https://www.tiktok.com/@<handle> with a desktop User-Agent.
//   3. Parses the JSON TikTok embeds in the page — first
//      <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">, then the older
//      <script id="SIGI_STATE">, then a loose regex over the HTML — for
//      followerCount / heartCount / videoCount / followingCount.
//   4. Caches the result for 6 hours (in-memory per warm function instance +
//      Cache-Control / Netlify-CDN-Cache-Control so the CDN serves it too).
//
// !! CAVEAT !!
//   This reads TikTok's PUBLIC profile page and depends on markup TikTok does
//   not document. It may break at any time if TikTok changes the page, blocks
//   datacenter IPs, or serves a captcha. When that happens the function returns
//   the fallback numbers from creator.json with "stale": true, so the page keeps
//   working — the numbers are just not live until creator.json is updated or
//   TikTok is reachable again.

import { readFile } from "node:fs/promises";
import path from "node:path";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FETCH_TIMEOUT_MS = 8000;
const DEFAULT_CREATOR = "kuki-monsters";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Per-instance memory cache. Netlify keeps warm instances around for a while,
// so this alone avoids most repeat fetches; the CDN cache headers do the rest.
const memoryCache = new Map(); // slug -> { body, expiresAt }

export default async function handler(request) {
  const url = new URL(request.url);
  const slug = (url.searchParams.get("creator") || DEFAULT_CREATOR).toLowerCase();
  const bust = url.searchParams.has("nocache");

  if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
    return json({ error: "invalid creator slug" }, 400, 0);
  }

  const cached = memoryCache.get(slug);
  if (cached && cached.expiresAt > Date.now() && !bust) {
    return json({ ...cached.body, cache: "memory" }, 200, secondsLeft(cached.expiresAt));
  }

  const creator = await loadCreator(slug);
  if (!creator) {
    return json({ error: `unknown creator "${slug}"` }, 404, 0);
  }

  const handle = String(creator.handle || "").replace(/^@/, "");
  const fallback = creator.fallbackStats || {};

  let body;
  try {
    const live = await fetchTikTokStats(handle);
    body = {
      handle: `@${handle}`,
      followers: live.followers,
      likes: live.likes,
      following: live.following,
      videos: live.videos,
      stale: false,
      source: live.source,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    body = {
      handle: `@${handle}`,
      followers: num(fallback.followers),
      likes: num(fallback.likes),
      following: num(fallback.following),
      videos: num(fallback.videos),
      stale: true,
      source: "fallback:creator.json",
      fetchedAt: fallback.asOf ? new Date(fallback.asOf).toISOString() : null,
      error: String(err && err.message ? err.message : err).slice(0, 200),
    };
  }

  // Cache successes for the full TTL; cache failures briefly so a TikTok
  // hiccup does not pin stale numbers for 6 hours.
  const ttl = body.stale ? 10 * 60 * 1000 : CACHE_TTL_MS;
  const expiresAt = Date.now() + ttl;
  body.cachedUntil = new Date(expiresAt).toISOString();
  memoryCache.set(slug, { body, expiresAt });

  return json({ ...body, cache: "miss" }, 200, Math.floor(ttl / 1000));
}

export const config = {
  path: "/api/tiktok-stats",
};

// ---------------------------------------------------------------------------

async function fetchTikTokStats(handle) {
  if (!handle) throw new Error("no handle configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html;
  try {
    const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(handle)}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": DESKTOP_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) throw new Error(`tiktok responded ${res.status}`);
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }

  return parseStats(html, handle);
}

// Exported for tests. Tries the three known places TikTok puts profile stats.
export function parseStats(html, handle) {
  // 1. __UNIVERSAL_DATA_FOR_REHYDRATION__ (current markup, 2023+)
  const universal = extractScriptJson(html, "__UNIVERSAL_DATA_FOR_REHYDRATION__");
  if (universal) {
    const scope = universal.__DEFAULT_SCOPE__ || {};
    const detail = scope["webapp.user-detail"] || {};
    const stats = detail.userInfo && detail.userInfo.stats;
    if (stats && isFinite(stats.followerCount)) {
      return normalise(stats, "universal");
    }
    if (detail.statusCode && detail.statusCode !== 0) {
      throw new Error(`tiktok user-detail status ${detail.statusCode}`);
    }
  }

  // 2. SIGI_STATE (older markup)
  const sigi = extractScriptJson(html, "SIGI_STATE");
  if (sigi && sigi.UserModule && sigi.UserModule.stats) {
    const byId = sigi.UserModule.stats;
    const stats = byId[handle] || Object.values(byId)[0];
    if (stats && isFinite(stats.followerCount)) {
      return normalise(stats, "sigi");
    }
  }

  // 3. Loose regex — last resort if the JSON blobs move but the keys survive.
  const grab = (key) => {
    const m = html.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  const followerCount = grab("followerCount");
  if (isFinite(followerCount)) {
    return normalise(
      {
        followerCount,
        heartCount: grab("heartCount") ?? grab("heart"),
        videoCount: grab("videoCount"),
        followingCount: grab("followingCount"),
      },
      "regex"
    );
  }

  throw new Error("could not find stats in tiktok html");
}

function extractScriptJson(html, id) {
  const re = new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`, "i");
  const m = html.match(re);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function normalise(stats, source) {
  return {
    followers: num(stats.followerCount),
    likes: num(stats.heartCount ?? stats.heart),
    following: num(stats.followingCount),
    videos: num(stats.videoCount),
    source: `tiktok:${source}`,
  };
}

async function loadCreator(slug) {
  const rel = path.join("creators", slug, "data", "creator.json");
  // netlify dev runs from the repo root; in production `included_files`
  // are unpacked into the function bundle root (LAMBDA_TASK_ROOT / /var/task).
  const roots = [process.cwd(), process.env.LAMBDA_TASK_ROOT, process.env.NETLIFY_FUNCTIONS_ROOT, "/var/task"].filter(Boolean);
  const candidates = roots.map((r) => path.join(r, rel));
  for (const file of candidates) {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch {
      /* try next */
    }
  }
  return null;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function secondsLeft(expiresAt) {
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

function json(body, status, maxAge) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };
  if (maxAge > 0) {
    headers["Cache-Control"] = `public, max-age=${Math.min(maxAge, 300)}, must-revalidate`;
    headers["Netlify-CDN-Cache-Control"] =
      `public, s-maxage=${maxAge}, stale-while-revalidate=86400`;
    headers["Netlify-Vary"] = "query=creator";
  } else {
    headers["Cache-Control"] = "no-store";
  }
  return new Response(JSON.stringify(body), { status, headers });
}
