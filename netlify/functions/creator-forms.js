// netlify/functions/creator-forms.js
//
// Handles the two forms on a creator page:
//   - "contact"  (Work with me)      -> email to the creator + Secret Kitchens via Resend
//   - "suggest"  (Suggest a kitchen) -> Supabase row + email to the creator + Secret Kitchens via Resend
//
//   POST /api/creator-forms
//   { "form": "contact" | "suggest", "creator": "<slug>", ...fields }
//
// Environment variables (set in the Netlify UI; nothing is hard-coded here):
//   RESEND_API_KEY        Resend API key
//   RESEND_FROM           e.g. "Secret Kitchens Creators <creators@secret-kitchens.com>"
//   SK_NOTIFY_EMAIL       Secret Kitchens inbox that gets a copy of every submission
//   SUPABASE_URL              https://<project-ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY server-side key (never ship to the browser); bypasses RLS for the insert
//   SUPABASE_SUGGESTIONS_TABLE table name (default "creator_kitchen_suggestions", see supabase/migrations)
//
// If a service is not configured the function still returns 200 with
// delivered:false so the page works as a demo; the payload is logged instead.

import { readFile } from "node:fs/promises";
import path from "node:path";

const MAX_FIELD = 2000;

export default async function handler(request) {
  if (request.method === "OPTIONS") return json({}, 204);
  if (request.method !== "POST") return json({ error: "POST only" }, 405);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  // Honeypot: bots fill every field, humans never see this one.
  if (payload._gotcha) return json({ ok: true, delivered: false, reason: "spam" }, 200);

  const slug = String(payload.creator || "").toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return json({ error: "invalid creator" }, 400);

  const creator = await loadCreator(slug);
  if (!creator) return json({ error: "unknown creator" }, 404);

  const form = payload.form === "suggest" ? "suggest" : payload.form === "contact" ? "contact" : null;
  if (!form) return json({ error: "unknown form" }, 400);

  const fields = clean(payload, form === "suggest"
    ? ["venue", "suburb", "link", "why", "email"]
    : ["name", "email", "company", "message", "budget"]);

  const missing = (form === "suggest" ? ["venue"] : ["name", "email", "message"]).filter((k) => !fields[k]);
  if (missing.length) return json({ error: `missing: ${missing.join(", ")}` }, 400);
  if (fields.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
    return json({ error: "invalid email" }, 400);
  }

  const results = { supabase: null, email: null };

  if (form === "suggest") {
    results.supabase = await sendToSupabase({ creator: creator.name, slug, ...fields });
  }

  const creatorEmail = creator.mediaKit && creator.mediaKit.contactEmail;
  const to = [creatorEmail, process.env.SK_NOTIFY_EMAIL].filter(Boolean);
  const subject = form === "suggest"
    ? `[${creator.name}] Kitchen suggestion: ${fields.venue}`
    : `[${creator.name}] Work-with-me enquiry from ${fields.name}`;
  results.email = await sendEmail({ to, subject, replyTo: fields.email, text: renderText(form, creator, fields) });

  const delivered = Boolean((results.email && results.email.delivered) || (results.supabase && results.supabase.delivered));
  if (!delivered) console.log(`[creator-forms] not configured; ${form} submission for ${slug}:`, fields);

  return json({ ok: true, delivered, results }, 200);
}

export const config = { path: "/api/creator-forms" };

// ---------------------------------------------------------------------------

async function sendEmail({ to, subject, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from || !to.length) return { delivered: false, reason: "resend not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, reply_to: replyTo || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { delivered: true, id: body.id } : { delivered: false, reason: body.message || `resend ${res.status}` };
  } catch (err) {
    return { delivered: false, reason: String(err.message || err) };
  }
}

async function sendToSupabase(record) {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = process.env.SUPABASE_SUGGESTIONS_TABLE || "creator_kitchen_suggestions";
  if (!url || !key) return { delivered: false, reason: "supabase not configured" };
  try {
    // Plain PostgREST insert — no SDK needed. Service role key bypasses RLS on purpose (server-side only).
    const res = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        creator_slug: record.slug,
        creator_name: record.creator,
        venue: record.venue,
        suburb: record.suburb || null,
        link: record.link || null,
        why: record.why || null,
        submitter_email: record.email || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok
      ? { delivered: true, id: Array.isArray(body) && body[0] ? body[0].id : undefined }
      : { delivered: false, reason: body.message || body.hint || `supabase ${res.status}` };
  } catch (err) {
    return { delivered: false, reason: String(err.message || err) };
  }
}

function renderText(form, creator, f) {
  const lines = form === "suggest"
    ? [
        `New kitchen suggestion for ${creator.name} (${creator.handle})`,
        "",
        `Venue:   ${f.venue}`,
        `Suburb:  ${f.suburb || "-"}`,
        `Link:    ${f.link || "-"}`,
        `Why:     ${f.why || "-"}`,
        `From:    ${f.email || "anonymous"}`,
      ]
    : [
        `New work-with-me enquiry for ${creator.name} (${creator.handle})`,
        "",
        `Name:    ${f.name}`,
        `Email:   ${f.email}`,
        `Company: ${f.company || "-"}`,
        `Budget:  ${f.budget || "-"}`,
        "",
        f.message,
      ];
  return lines.join("\n");
}

function clean(src, keys) {
  const out = {};
  for (const k of keys) {
    const v = src[k];
    out[k] = typeof v === "string" ? v.trim().slice(0, MAX_FIELD) : "";
  }
  return out;
}

async function loadCreator(slug) {
  const rel = path.join("creators", slug, "data", "creator.json");
  const roots = [process.cwd(), process.env.LAMBDA_TASK_ROOT, "/var/task"].filter(Boolean);
  for (const file of roots.map((r) => path.join(r, rel))) {
    try { return JSON.parse(await readFile(file, "utf8")); } catch { /* next */ }
  }
  return null;
}

function json(body, status) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
