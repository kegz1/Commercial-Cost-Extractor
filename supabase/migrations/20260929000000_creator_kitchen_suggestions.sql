-- Kitchen suggestions submitted from creator pages (creators/<slug>/ "Suggest a kitchen" form).
-- Written by netlify/functions/creator-forms.js using the service role key; RLS blocks the anon key.
create table if not exists public.creator_kitchen_suggestions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  creator_slug    text not null,
  creator_name    text,
  venue           text not null,
  suburb          text,
  link            text,
  why             text,
  submitter_email text,
  status          text not null default 'new' check (status in ('new', 'contacted', 'onboarded', 'declined'))
);

create index if not exists creator_kitchen_suggestions_creator_idx on public.creator_kitchen_suggestions (creator_slug, created_at desc);

alter table public.creator_kitchen_suggestions enable row level security;
-- No policies on purpose: only the service role (used server-side by the Netlify function) can read/write.
