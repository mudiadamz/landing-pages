-- MbahGPT: chat store, ported from the standalone SQLite app (mbahgpt/db.py).
--
-- The original was single-user and local: one chats.db owned by whoever ran the
-- server, no auth, and history keyed by nothing. Here the same data serves many
-- visitors on a shared deployment, so EVERY table carries user_id and is closed
-- with owner-only RLS. That is the whole shape of the port — the columns barely
-- moved, the ownership model is new.
--
-- What changed on purpose, and why:
--   * INTEGER AUTOINCREMENT ids -> uuid, matching every other lp_ table.
--   * attachments.data BLOB     -> a Storage path. Postgres rows are replicated
--                                 and backed up; 8 MB of image bytes per message
--                                 has no business in them, and Storage already
--                                 has an owner-scoped RLS pattern in this repo.
--   * `prefs (key, value)`      -> one row per user with a named column. The
--                                 key/value shape existed to avoid a migration
--                                 in a file-based DB; here a migration is normal
--                                 and a typo'd key is a silent no-op.
--   * NEW: sessions.answering_at, the port of claim_session() in server.py. The
--     Python server held a lock in process memory, which cannot work when the
--     next request lands on a different instance. A timestamp in the row is the
--     lock, and a stale one expires — a crashed generation must not wedge a chat
--     shut forever.
--
-- Table prefix lp_ per invariant I10: one Supabase project serves several apps.

-- -- sessions -----------------------------------------------------------------
create table if not exists public.lp_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Which storefront the chat was started on. Recorded, NOT filtered on: a
  -- visitor's history is theirs and follows them, and hiding chats per domain
  -- would look like data loss. It is here so usage per storefront is answerable.
  site_id uuid references public.lp_sites (id) on delete set null,
  title text not null default '',
  model text,
  /**
   * Non-null means a reply is being generated for this session right now.
   *
   * The browser also disables its composer, but a second tab or a stray script
   * must not interleave two answers into one conversation. Read with a staleness
   * window (see lib/mbahgpt/config.ts ANSWER_LOCK_STALE_MS) so a generation that
   * died mid-flight — deploy, timeout, crash — releases itself instead of
   * locking the chat permanently.
   */
  answering_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lp_chat_sessions_user_idx
  on public.lp_chat_sessions (user_id, updated_at desc);

alter table public.lp_chat_sessions enable row level security;

drop policy if exists "Users read own chat sessions" on public.lp_chat_sessions;
create policy "Users read own chat sessions"
  on public.lp_chat_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own chat sessions" on public.lp_chat_sessions;
create policy "Users create own chat sessions"
  on public.lp_chat_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own chat sessions" on public.lp_chat_sessions;
create policy "Users update own chat sessions"
  on public.lp_chat_sessions for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own chat sessions" on public.lp_chat_sessions;
create policy "Users delete own chat sessions"
  on public.lp_chat_sessions for delete
  using (auth.uid() = user_id);

-- -- messages -----------------------------------------------------------------
create table if not exists public.lp_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lp_chat_sessions (id) on delete cascade,
  -- Denormalised from the session so RLS is one predicate instead of a subquery
  -- on every read of a long transcript.
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  -- Thinking models stream `reasoning` before any answer token. Stored so an old
  -- chat still shows its "Thinking" panel, exactly as the SQLite version did.
  reasoning text,
  -- [{title, url}] from a web search, so the sources list survives a reload.
  sources jsonb,
  created_at timestamptz not null default now()
);

-- 'system' is deliberately NOT an allowed role: the system message is derived
-- from prefs + memories + search context on every turn, so editing your
-- instructions changes how old chats continue instead of leaving a stale copy
-- baked into the transcript.

-- Transcript order. created_at then id: two rows in one turn are microseconds
-- apart, and the id tiebreak keeps the order total rather than merely stable.
create index if not exists lp_chat_messages_by_session_idx
  on public.lp_chat_messages (session_id, created_at, id);

-- The rate limiter counts a user's recent messages; without this it would scan.
create index if not exists lp_chat_messages_user_recent_idx
  on public.lp_chat_messages (user_id, created_at desc);

alter table public.lp_chat_messages enable row level security;

drop policy if exists "Users read own chat messages" on public.lp_chat_messages;
create policy "Users read own chat messages"
  on public.lp_chat_messages for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own chat messages" on public.lp_chat_messages;
create policy "Users create own chat messages"
  on public.lp_chat_messages for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own chat messages" on public.lp_chat_messages;
create policy "Users delete own chat messages"
  on public.lp_chat_messages for delete
  using (auth.uid() = user_id);

-- -- preferences --------------------------------------------------------------
create table if not exists public.lp_chat_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Sent as part of the system message on every request, in every chat.
  response_instructions text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.lp_chat_prefs enable row level security;

drop policy if exists "Users read own chat prefs" on public.lp_chat_prefs;
create policy "Users read own chat prefs"
  on public.lp_chat_prefs for select
  using (auth.uid() = user_id);

drop policy if exists "Users write own chat prefs" on public.lp_chat_prefs;
create policy "Users write own chat prefs"
  on public.lp_chat_prefs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own chat prefs" on public.lp_chat_prefs;
create policy "Users update own chat prefs"
  on public.lp_chat_prefs for update
  using (auth.uid() = user_id);

-- -- memories ----------------------------------------------------------------
create table if not exists public.lp_chat_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  pinned boolean not null default false,
  -- Which chat it came from, kept for provenance only. ON DELETE SET NULL: a
  -- fact you asked to remember must outlive the conversation that produced it.
  session_id uuid references public.lp_chat_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Case-insensitive dedupe, per user: saying the same thing twice stores it once.
-- Per user, not global — two people remembering "pakai TypeScript" is two facts.
create unique index if not exists lp_chat_memories_unique_idx
  on public.lp_chat_memories (user_id, lower(text));

create index if not exists lp_chat_memories_user_idx
  on public.lp_chat_memories (user_id, pinned desc, created_at desc);

alter table public.lp_chat_memories enable row level security;

drop policy if exists "Users read own chat memories" on public.lp_chat_memories;
create policy "Users read own chat memories"
  on public.lp_chat_memories for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own chat memories" on public.lp_chat_memories;
create policy "Users create own chat memories"
  on public.lp_chat_memories for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own chat memories" on public.lp_chat_memories;
create policy "Users update own chat memories"
  on public.lp_chat_memories for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own chat memories" on public.lp_chat_memories;
create policy "Users delete own chat memories"
  on public.lp_chat_memories for delete
  using (auth.uid() = user_id);

-- -- attachments --------------------------------------------------------------
create table if not exists public.lp_chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.lp_chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  mime text not null,
  -- 'image' | 'document'. How the file reaches the model is decided in code
  -- (lib/mbahgpt/messages.ts) from name+mime; this is only what the UI draws.
  kind text not null check (kind in ('image', 'document')),
  size integer not null default 0,
  -- Path inside the private `chat-attachments` bucket, always `<uid>/…` so the
  -- Storage policies below can scope it by folder.
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists lp_chat_attachments_by_message_idx
  on public.lp_chat_attachments (message_id, created_at);

alter table public.lp_chat_attachments enable row level security;

drop policy if exists "Users read own chat attachments" on public.lp_chat_attachments;
create policy "Users read own chat attachments"
  on public.lp_chat_attachments for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own chat attachments" on public.lp_chat_attachments;
create policy "Users create own chat attachments"
  on public.lp_chat_attachments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own chat attachments" on public.lp_chat_attachments;
create policy "Users delete own chat attachments"
  on public.lp_chat_attachments for delete
  using (auth.uid() = user_id);

-- -- storage -----------------------------------------------------------------
-- Private bucket: chat attachments are as personal as the transcript. Reads go
-- through /api/mbahgpt/attachment/[id], which checks ownership and then signs a
-- short-lived URL — the same shape as the paid-download route.
--
-- The size limit is the per-FILE ceiling Storage enforces; the per-message total
-- (OPENROUTER_MAX_UPLOAD) is checked in the chat route, because only it knows how
-- many files this message carries.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  8388608,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
    'text/css', 'text/javascript', 'text/x-python',
    'application/json', 'application/xml', 'application/javascript',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Uploads land in `<uid>/…` and nowhere else. The browser uploads straight to
-- Storage (Server Actions cap the body at ~4.5 MB on Vercel), so this policy —
-- not a check in the app — is what actually confines a file to its owner.
drop policy if exists "Users upload own chat attachments" on storage.objects;
create policy "Users upload own chat attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read own chat attachments storage" on storage.objects;
create policy "Users read own chat attachments storage"
  on storage.objects for select
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own chat attachments storage" on storage.objects;
create policy "Users delete own chat attachments storage"
  on storage.objects for delete
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
