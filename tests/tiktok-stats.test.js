// node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { parseStats } from "../netlify/functions/tiktok-stats.js";

const universal = `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({
  __DEFAULT_SCOPE__: {
    "webapp.user-detail": {
      userInfo: { user: { uniqueId: "kuki.monsters" }, stats: { followerCount: 812, followingCount: 32, heartCount: 5400, videoCount: 15 } },
    },
  },
})}</script></html>`;

const sigi = `<html><script id="SIGI_STATE" type="application/json">${JSON.stringify({
  UserModule: { stats: { "kuki.monsters": { followerCount: 900, followingCount: 33, heart: 6000, videoCount: 16 } } },
})}</script></html>`;

test("parses __UNIVERSAL_DATA_FOR_REHYDRATION__", () => {
  const s = parseStats(universal, "kuki.monsters");
  assert.deepEqual(s, { followers: 812, likes: 5400, following: 32, videos: 15, source: "tiktok:universal" });
});

test("parses SIGI_STATE", () => {
  const s = parseStats(sigi, "kuki.monsters");
  assert.deepEqual(s, { followers: 900, likes: 6000, following: 33, videos: 16, source: "tiktok:sigi" });
});

test("falls back to regex", () => {
  const s = parseStats(`<div>"followerCount":1234,"heartCount":9999,"videoCount":20,"followingCount":40</div>`, "x");
  assert.equal(s.followers, 1234);
  assert.equal(s.likes, 9999);
  assert.equal(s.source, "tiktok:regex");
});

test("throws when nothing is found", () => {
  assert.throws(() => parseStats("<html>captcha</html>", "x"), /could not find stats/);
});
