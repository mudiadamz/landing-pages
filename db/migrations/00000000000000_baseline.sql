-- Baseline: seluruh skema aplikasi, untuk Postgres polos (docs/plans/remove-supabase.md, fase 4).
--
-- Dibuat 2026-09-22 dari `pg_dump --schema-only` database lokal yang sudah
-- menerapkan semua migration sampai 20260922000000 (skema public + app_auth,
-- ditambah auth.users & auth.identities), lalu dibersihkan dari yang hanya ada
-- di Supabase: pemilik (supabase_admin/supabase_auth_admin), grant ke role
-- internal Supabase, dan default privilege milik supabase_admin. Riwayat 91
-- migration yang membentuknya ada di db/migrations/_archive/.
--
-- Bagian pertama adalah SHIM: hal kecil yang membuat 62 policy dan semua grant
-- tetap sama persis secara teks — tiga role yang dipakai lib/backend/rls.ts,
-- dan auth.uid() yang membaca klaim yang diisi aplikasi.

-- Seperti pg_dump: badan fungsi SQL tidak diperiksa saat dibuat, karena
-- urutan dump tidak menjamin fungsi yang dipanggilnya sudah ada.
set local check_function_bodies = false;

-- ---------------------------------------------------------------------------
-- Shim
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  -- Role yang dipakai aplikasi untuk tersambung. NOLOGIN di sini — password
  -- dan LOGIN diberikan saat server disiapkan (db/init), bukan di file yang
  -- masuk git.
  if not exists (select 1 from pg_roles where rolname = 'app') then create role app nologin; end if;
end $$;

-- `set local role …` di withRls hanya boleh untuk anggota role itu. INHERIT
-- FALSE: app boleh BERGANTI ke role itu, tapi tidak diam-diam memakai hak-haknya
-- — tanpa `set role`, query app tidak menyentuh satu pun tabel lp_.
grant anon, authenticated, service_role to app with inherit false, set true;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role, app;

-- Sama dengan versi Supabase: klaim `sub` dari request.jwt.claims, yang diisi
-- withRls (lib/backend/rls.ts) per transaksi.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role, app;

-- ---------------------------------------------------------------------------
-- auth.users & auth.identities (bentuk GoTrue, supaya data lama masuk apa adanya)
-- ---------------------------------------------------------------------------

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

--
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);

--
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';

--
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';

--
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);

--
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';

--
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';

--
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);

--
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);

--
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);

--
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);

--
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);

--
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);

--
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);

--
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';

--
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);

--
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);

--
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);

--
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);

--
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';

--
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));

--
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);

--
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);

--
--


--
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;

--
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;

--
-- PostgreSQL database dump complete
--

-- ---------------------------------------------------------------------------
-- public (lp_*) & app_auth
-- ---------------------------------------------------------------------------

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

--
-- Name: app_auth; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA app_auth;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

--
-- Name: lp_can_sell(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lp_can_sell() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(public.lp_get_my_profile_role() in ('company', 'agent'), false)
      or exists (
           select 1 from public.lp_site_members m
            where m.user_id = auth.uid() and m.is_publisher
         );
$$;

--
-- Name: FUNCTION lp_can_sell(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.lp_can_sell() IS 'Pemanggil boleh membuat produk: Company, Agent, atau publisher di salah satu situs. Versi database dari canSellProducts/canSellOnSite — lebih longgar karena produk belum punya site_id.';

--
-- Name: lp_get_my_profile_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lp_get_my_profile_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select account_type from public.lp_profiles where id = auth.uid() limit 1;
$$;

--
-- Name: FUNCTION lp_get_my_profile_role(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.lp_get_my_profile_role() IS 'Jenis akun pemanggil: company | agent | customer. Namanya masih "role" karena 11 policy memanggilnya; yang dikembalikan adalah lp_profiles.account_type.';

--
-- Name: lp_handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lp_handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.lp_profiles (id, full_name, email, email_verified_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    -- Daftar lewat Google = alamatnya sudah dibuktikan oleh Google. Daftar lewat
    -- email = belum dibuktikan apa pun; `lib/email-verify.ts` yang mengisinya
    -- nanti lewat email Resend sendiri.
    case
      when coalesce(new.raw_app_meta_data->>'provider', 'email') = 'email' then null
      else now()
    end
  );
  return new;
end;
$$;

--
-- Name: FUNCTION lp_handle_new_user(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.lp_handle_new_user() IS 'Membuat baris lp_profiles untuk setiap user baru di auth.users. Sengaja TIDAK menyebut account_type — kolomnya punya default, dan menyebutnya di sini berarti kosakata jenis akun tersimpan di dua tempat (itu yang membuat fungsi ini patah waktu kolom role dihapus).';

--
-- Name: lp_increment_view(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lp_increment_view(p_slug text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update lp_landing_pages
     set view_count = coalesce(view_count, 0) + 1
   where slug = p_slug;
$$;

--
-- Name: lp_manages_site(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lp_manages_site(p_site_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(public.lp_get_my_profile_role() = 'company', false)
      or exists (
           select 1 from public.lp_site_agents a
            where a.site_id = p_site_id and a.user_id = auth.uid()
         );
$$;

--
-- Name: FUNCTION lp_manages_site(p_site_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.lp_manages_site(p_site_id uuid) IS 'Pemanggil boleh mengurus situs ini: Company, atau Agent yang terdaftar untuk situs itu. Versi database dari canManageSite() di lib/site-membership.ts — keduanya harus sama.';

--
-- Name: lp_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lp_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

--
-- Name: lp_sync_like_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lp_sync_like_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (tg_op = 'INSERT') then
    update lp_landing_pages set like_count = like_count + 1 where id = new.landing_page_id;
  elsif (tg_op = 'DELETE') then
    update lp_landing_pages set like_count = greatest(like_count - 1, 0) where id = old.landing_page_id;
  end if;
  return null;
end;
$$;

--
-- Name: lp_track_session(text, text, uuid, text, text, text, text, text, text, text, text, uuid, text, text, text, text, text, text, text, text, bigint, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lp_track_session(p_session_id text, p_visitor_id text, p_user_id uuid, p_ip text, p_country text, p_region text, p_city text, p_isp text, p_referrer text, p_referrer_host text, p_landing_path text, p_entry_product_id uuid, p_utm_source text, p_utm_medium text, p_utm_campaign text, p_utm_term text, p_utm_content text, p_device text, p_browser text, p_os text, p_dwell_ms bigint, p_site_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into lp_sessions (
    session_id, visitor_id, user_id, ip, country, region, city, isp,
    referrer, referrer_host, landing_path, entry_product_id,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    device, browser, os, site_id, pageviews, active_ms, started_at, last_seen_at
  ) values (
    p_session_id, p_visitor_id, p_user_id, p_ip, p_country, p_region, p_city, p_isp,
    p_referrer, p_referrer_host, p_landing_path, p_entry_product_id,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content,
    p_device, p_browser, p_os, p_site_id, 1, greatest(p_dwell_ms, 0), now(), now()
  )
  on conflict (session_id) do update set
    last_seen_at = now(),
    pageviews = lp_sessions.pageviews + 1,
    active_ms = lp_sessions.active_ms + greatest(p_dwell_ms, 0),
    user_id = coalesce(lp_sessions.user_id, excluded.user_id);
end;
$$;

--
-- Name: lp_update_landing_page_rating(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lp_update_landing_page_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  target_id uuid;
begin
  if tg_op = 'DELETE' then
    target_id := old.landing_page_id;
  else
    target_id := new.landing_page_id;
  end if;

  update public.lp_landing_pages
  set rating = (
    select round(avg(r.rating)::numeric, 2)
    from public.lp_reviews r
    where r.landing_page_id = target_id
  )
  where id = target_id;

  return null;
end;
$$;

--
-- Name: lp_update_landing_page_sold_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lp_update_landing_page_sold_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.lp_landing_pages
    set sold_count = sold_count + 1
    where id = new.landing_page_id;
  elsif tg_op = 'DELETE' then
    update public.lp_landing_pages
    set sold_count = greatest(0, sold_count - 1)
    where id = old.landing_page_id;
  end if;
  return null;
end;
$$;

--
-- Name: login_failures; Type: TABLE; Schema: app_auth; Owner: postgres
--

CREATE TABLE app_auth.login_failures (
    id bigint NOT NULL,
    ip text,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: login_failures_id_seq; Type: SEQUENCE; Schema: app_auth; Owner: postgres
--

CREATE SEQUENCE app_auth.login_failures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: login_failures_id_seq; Type: SEQUENCE OWNED BY; Schema: app_auth; Owner: postgres
--

ALTER SEQUENCE app_auth.login_failures_id_seq OWNED BY app_auth.login_failures.id;

--
-- Name: sessions; Type: TABLE; Schema: app_auth; Owner: postgres
--

CREATE TABLE app_auth.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash bytea NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    ip text,
    user_agent text
);

--
-- Name: lp_chat_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_chat_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    mime text NOT NULL,
    kind text NOT NULL,
    size integer DEFAULT 0 NOT NULL,
    storage_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lp_chat_attachments_kind_check CHECK ((kind = ANY (ARRAY['image'::text, 'document'::text])))
);

--
-- Name: lp_chat_memories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_chat_memories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    text text NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    session_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: lp_chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    reasoning text,
    sources jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lp_chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

--
-- Name: lp_chat_prefs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_chat_prefs (
    user_id uuid NOT NULL,
    response_instructions text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: lp_chat_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    site_id uuid,
    title text DEFAULT ''::text NOT NULL,
    model text,
    answering_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: lp_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    site_id uuid
);

--
-- Name: TABLE lp_contacts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lp_contacts IS 'Contact form submissions; only admins can list.';

--
-- Name: lp_excluded_ips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_excluded_ips (
    ip text NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: lp_ip_geo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_ip_geo (
    ip text NOT NULL,
    country text,
    region text,
    city text,
    isp text,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: lp_landing_page_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_landing_page_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    icon text DEFAULT 'default'::text NOT NULL,
    parent_id uuid
);

--
-- Name: lp_landing_page_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_landing_page_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    landing_page_id uuid NOT NULL,
    html_content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: lp_landing_pages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_landing_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    html_content text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    price numeric(10,2) DEFAULT NULL::numeric,
    price_discount numeric(10,2) DEFAULT NULL::numeric,
    is_free boolean DEFAULT false,
    purchase_link text,
    featured boolean DEFAULT false,
    thumbnail_url text,
    purchase_type text DEFAULT 'internal'::text,
    zip_url text,
    sold_count integer DEFAULT 0 NOT NULL,
    rating numeric(3,2) DEFAULT NULL::numeric,
    category_id uuid,
    long_description text,
    preview_type text DEFAULT 'html'::text NOT NULL,
    preview_url text,
    story_pdf_url text,
    published boolean DEFAULT true NOT NULL,
    preview_url_dark text,
    story_pdf_url_dark text,
    cta_label text,
    cta_note text,
    cta_action text,
    event_title text,
    event_start text,
    event_end text,
    event_location text,
    event_description text,
    cta_reveal text,
    view_count bigint DEFAULT 0 NOT NULL,
    preview_label text,
    like_count integer DEFAULT 0 NOT NULL,
    related_product_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    available_at timestamp with time zone,
    story_epub_url text,
    next_product_id uuid,
    bundle_product_ids uuid[],
    bundle_note text,
    thumbnail_landscape_url text,
    thumbnail_extra_urls text[],
    preview_cut_percent smallint DEFAULT 60 NOT NULL,
    preview_purged_at timestamp with time zone,
    CONSTRAINT landing_pages_purchase_type_check CHECK ((purchase_type = ANY (ARRAY['external'::text, 'internal'::text]))),
    CONSTRAINT lp_landing_pages_preview_cut_percent_check CHECK (((preview_cut_percent >= 5) AND (preview_cut_percent <= 95))),
    CONSTRAINT lp_landing_pages_preview_type_check CHECK ((preview_type = ANY (ARRAY['html'::text, 'pdf'::text, 'link'::text, 'epub'::text, 'deliverable'::text, 'excerpt'::text])))
);

--
-- Name: COLUMN lp_landing_pages.sold_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_landing_pages.sold_count IS 'Number of purchases (kept in sync via trigger)';

--
-- Name: COLUMN lp_landing_pages.rating; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_landing_pages.rating IS 'Display rating e.g. 4.5 (optional, for display)';

--
-- Name: lp_page_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_page_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    visitor_id text,
    user_id uuid,
    path text NOT NULL,
    product_id uuid,
    product_slug text,
    page_type text,
    referrer_host text,
    dwell_ms integer DEFAULT 0 NOT NULL,
    scroll_depth integer,
    reached_end boolean DEFAULT false NOT NULL,
    engagement text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    site_id uuid
);

--
-- Name: lp_pages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    published boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE lp_pages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lp_pages IS 'Editorial pages per storefront, served at /p/[slug]. Separate from lp_site_settings, which holds fixed surfaces the code already knows about.';

--
-- Name: lp_plan_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_plan_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    site_id uuid,
    plan text NOT NULL,
    months integer DEFAULT 1 NOT NULL,
    amount integer DEFAULT 0 NOT NULL,
    merchant_order_id text NOT NULL,
    invoice_number text,
    status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lp_plan_orders_months_check CHECK (((months >= 1) AND (months <= 24))),
    CONSTRAINT lp_plan_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text])))
);

--
-- Name: COLUMN lp_plan_orders.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_plan_orders.user_id IS 'Pembeli paket, atau NULL kalau akunnya sudah dihapus. Sama seperti lp_purchases.user_id.';

--
-- Name: lp_product_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_product_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    landing_page_id uuid NOT NULL,
    session_id text,
    kind text NOT NULL,
    page text,
    referrer_host text,
    device text,
    browser text,
    os text,
    duration_ms bigint,
    cta_action text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: lp_product_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_product_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    landing_page_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: lp_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    is_active boolean DEFAULT true NOT NULL,
    exclude_from_stats boolean DEFAULT false NOT NULL,
    email_verified_at timestamp with time zone,
    avatar_url text,
    plan text DEFAULT 'free'::text NOT NULL,
    plan_expires_at timestamp with time zone,
    account_type text DEFAULT 'customer'::text NOT NULL,
    CONSTRAINT lp_profiles_account_type_check CHECK ((account_type = ANY (ARRAY['company'::text, 'agent'::text, 'customer'::text])))
);

--
-- Name: COLUMN lp_profiles.avatar_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_profiles.avatar_url IS 'Public URL of the user''s avatar in landing-assets/avatars/<user id>/. NULL = fall back to the initial letter.';

--
-- Name: COLUMN lp_profiles.plan; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_profiles.plan IS 'Plan key validated against lib/plans.ts (free|pro|business|enterprise). Unknown values read as free.';

--
-- Name: COLUMN lp_profiles.account_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_profiles.account_type IS 'Jenis akun: company | agent | customer. Menggantikan lp_profiles.role. "Publisher" bukan jenis akun — itu flag pada keanggotaan situs (lp_site_members.is_publisher).';

--
-- Name: lp_promo_subscribers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_promo_subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    source_slug text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: lp_purchases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    landing_page_id uuid NOT NULL,
    purchased_at timestamp with time zone DEFAULT now(),
    amount integer DEFAULT 0,
    payment_method text,
    invoice_number text,
    bundle_parent_id uuid,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoke_reason text,
    site_id uuid
);

--
-- Name: COLUMN lp_purchases.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_purchases.user_id IS 'Pembeli, atau NULL kalau akunnya sudah dihapus. Baris penjualannya tetap dihitung sebagai omzet — menghapus akun itu keputusan soal data pribadi, bukan refund.';

--
-- Name: COLUMN lp_purchases.site_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_purchases.site_id IS 'Storefront the purchase was made on. NULL = recorded before attribution existed; the panel counts those with the canonical site.';

--
-- Name: lp_received_emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_received_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resend_email_id text NOT NULL,
    from_address text NOT NULL,
    from_name text,
    to_addresses text[] DEFAULT '{}'::text[] NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    body_text text,
    body_html text,
    received_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: lp_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    landing_page_id uuid NOT NULL,
    rating smallint NOT NULL,
    review_text text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    site_id uuid,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

--
-- Name: lp_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    visitor_id text,
    user_id uuid,
    ip text,
    country text,
    region text,
    city text,
    isp text,
    referrer text,
    referrer_host text,
    landing_path text,
    entry_product_id uuid,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    device text,
    browser text,
    os text,
    pageviews integer DEFAULT 0 NOT NULL,
    active_ms bigint DEFAULT 0 NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    site_id uuid
);

--
-- Name: COLUMN lp_sessions.site_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_sessions.site_id IS 'Storefront the visit landed on. Distinct from referrer_host, which is where the visitor came from.';

--
-- Name: lp_signup_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_signup_attempts (
    id bigint NOT NULL,
    ip text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: lp_signup_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lp_signup_attempts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: lp_signup_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lp_signup_attempts_id_seq OWNED BY public.lp_signup_attempts.id;

--
-- Name: lp_site_agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_site_agents (
    site_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invited_by uuid
);

--
-- Name: TABLE lp_site_agents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lp_site_agents IS 'Agent mana mengelola situs mana. Terpisah dari lp_site_members, yang sejak model ini hanya berisi customer. Satu situs boleh punya beberapa Agent.';

--
-- Name: lp_site_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_site_members (
    site_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invited_by uuid,
    is_publisher boolean DEFAULT false NOT NULL,
    publisher_status text DEFAULT 'none'::text NOT NULL,
    publisher_applied_at timestamp with time zone,
    publisher_reviewed_at timestamp with time zone,
    publisher_reviewed_by uuid,
    publisher_reject_note text,
    publisher_ktp_path text,
    publisher_selfie_path text,
    publisher_real_name text,
    publisher_display_name text,
    publisher_address text,
    publisher_terms_accepted_at timestamp with time zone,
    publisher_bank_name text,
    publisher_bank_holder text,
    publisher_bank_account text,
    CONSTRAINT lp_site_members_pub_status_check CHECK ((publisher_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text])))
);

--
-- Name: TABLE lp_site_members; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lp_site_members IS 'Customer sebuah situs. Sejak model account_type tabel ini TIDAK menyimpan role — Agent ada di lp_site_agents. Yang disimpan di sini: apakah customer ini boleh menjual di situs ini (is_publisher) dan berkas pengajuannya.';

--
-- Name: COLUMN lp_site_members.is_publisher; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_site_members.is_publisher IS 'Customer ini boleh menjual DI SITUS INI. Publisher bukan jenis akun — ia customer dengan izin jual, dan izinnya per situs.';

--
-- Name: lp_site_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_site_settings (
    key text NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now(),
    site_id uuid NOT NULL
);

--
-- Name: lp_sites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lp_sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    host text NOT NULL,
    name text NOT NULL,
    tagline text,
    category_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    is_canonical boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    template text DEFAULT 'default'::text NOT NULL,
    palette text DEFAULT 'forest'::text NOT NULL,
    logo_url text,
    icon_url text,
    locale text DEFAULT 'id'::text NOT NULL,
    CONSTRAINT lp_sites_locale_check CHECK ((locale = ANY (ARRAY['id'::text, 'en'::text])))
);

--
-- Name: COLUMN lp_sites.logo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_sites.logo_url IS 'Public URL of the wide/wordmark logo shown in the header. NULL = ADM.UIUX default mark.';

--
-- Name: COLUMN lp_sites.icon_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_sites.icon_url IS 'Public URL of the square icon used for favicon, PWA manifest, apple-touch-icon and the link-in-bio avatar. NULL = ADM.UIUX default.';

--
-- Name: COLUMN lp_sites.locale; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lp_sites.locale IS 'UI language for this storefront. Must match a dictionary in lib/i18n.';

--
-- Name: login_failures id; Type: DEFAULT; Schema: app_auth; Owner: postgres
--

ALTER TABLE ONLY app_auth.login_failures ALTER COLUMN id SET DEFAULT nextval('app_auth.login_failures_id_seq'::regclass);

--
-- Name: lp_signup_attempts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_signup_attempts ALTER COLUMN id SET DEFAULT nextval('public.lp_signup_attempts_id_seq'::regclass);

--
-- Name: login_failures login_failures_pkey; Type: CONSTRAINT; Schema: app_auth; Owner: postgres
--

ALTER TABLE ONLY app_auth.login_failures
    ADD CONSTRAINT login_failures_pkey PRIMARY KEY (id);

--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: app_auth; Owner: postgres
--

ALTER TABLE ONLY app_auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: app_auth; Owner: postgres
--

ALTER TABLE ONLY app_auth.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);

--
-- Name: lp_contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);

--
-- Name: lp_landing_page_categories landing_page_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_landing_page_categories
    ADD CONSTRAINT landing_page_categories_pkey PRIMARY KEY (id);

--
-- Name: lp_landing_page_categories landing_page_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_landing_page_categories
    ADD CONSTRAINT landing_page_categories_slug_key UNIQUE (slug);

--
-- Name: lp_landing_page_versions landing_page_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_landing_page_versions
    ADD CONSTRAINT landing_page_versions_pkey PRIMARY KEY (id);

--
-- Name: lp_landing_pages landing_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_landing_pages
    ADD CONSTRAINT landing_pages_pkey PRIMARY KEY (id);

--
-- Name: lp_landing_pages landing_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_landing_pages
    ADD CONSTRAINT landing_pages_slug_key UNIQUE (slug);

--
-- Name: lp_chat_attachments lp_chat_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_attachments
    ADD CONSTRAINT lp_chat_attachments_pkey PRIMARY KEY (id);

--
-- Name: lp_chat_memories lp_chat_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_memories
    ADD CONSTRAINT lp_chat_memories_pkey PRIMARY KEY (id);

--
-- Name: lp_chat_messages lp_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_messages
    ADD CONSTRAINT lp_chat_messages_pkey PRIMARY KEY (id);

--
-- Name: lp_chat_prefs lp_chat_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_prefs
    ADD CONSTRAINT lp_chat_prefs_pkey PRIMARY KEY (user_id);

--
-- Name: lp_chat_sessions lp_chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_sessions
    ADD CONSTRAINT lp_chat_sessions_pkey PRIMARY KEY (id);

--
-- Name: lp_excluded_ips lp_excluded_ips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_excluded_ips
    ADD CONSTRAINT lp_excluded_ips_pkey PRIMARY KEY (ip);

--
-- Name: lp_ip_geo lp_ip_geo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_ip_geo
    ADD CONSTRAINT lp_ip_geo_pkey PRIMARY KEY (ip);

--
-- Name: lp_page_events lp_page_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_page_events
    ADD CONSTRAINT lp_page_events_pkey PRIMARY KEY (id);

--
-- Name: lp_pages lp_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_pages
    ADD CONSTRAINT lp_pages_pkey PRIMARY KEY (id);

--
-- Name: lp_pages lp_pages_site_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_pages
    ADD CONSTRAINT lp_pages_site_id_slug_key UNIQUE (site_id, slug);

--
-- Name: lp_plan_orders lp_plan_orders_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_plan_orders
    ADD CONSTRAINT lp_plan_orders_invoice_number_key UNIQUE (invoice_number);

--
-- Name: lp_plan_orders lp_plan_orders_merchant_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_plan_orders
    ADD CONSTRAINT lp_plan_orders_merchant_order_id_key UNIQUE (merchant_order_id);

--
-- Name: lp_plan_orders lp_plan_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_plan_orders
    ADD CONSTRAINT lp_plan_orders_pkey PRIMARY KEY (id);

--
-- Name: lp_product_events lp_product_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_product_events
    ADD CONSTRAINT lp_product_events_pkey PRIMARY KEY (id);

--
-- Name: lp_product_likes lp_product_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_product_likes
    ADD CONSTRAINT lp_product_likes_pkey PRIMARY KEY (id);

--
-- Name: lp_product_likes lp_product_likes_user_id_landing_page_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_product_likes
    ADD CONSTRAINT lp_product_likes_user_id_landing_page_id_key UNIQUE (user_id, landing_page_id);

--
-- Name: lp_promo_subscribers lp_promo_subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_promo_subscribers
    ADD CONSTRAINT lp_promo_subscribers_email_key UNIQUE (email);

--
-- Name: lp_promo_subscribers lp_promo_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_promo_subscribers
    ADD CONSTRAINT lp_promo_subscribers_pkey PRIMARY KEY (id);

--
-- Name: lp_sessions lp_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_sessions
    ADD CONSTRAINT lp_sessions_pkey PRIMARY KEY (id);

--
-- Name: lp_sessions lp_sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_sessions
    ADD CONSTRAINT lp_sessions_session_id_key UNIQUE (session_id);

--
-- Name: lp_signup_attempts lp_signup_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_signup_attempts
    ADD CONSTRAINT lp_signup_attempts_pkey PRIMARY KEY (id);

--
-- Name: lp_site_agents lp_site_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_agents
    ADD CONSTRAINT lp_site_agents_pkey PRIMARY KEY (site_id, user_id);

--
-- Name: lp_site_members lp_site_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_members
    ADD CONSTRAINT lp_site_members_pkey PRIMARY KEY (site_id, user_id);

--
-- Name: lp_site_settings lp_site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_settings
    ADD CONSTRAINT lp_site_settings_pkey PRIMARY KEY (site_id, key);

--
-- Name: lp_sites lp_sites_host_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_sites
    ADD CONSTRAINT lp_sites_host_key UNIQUE (host);

--
-- Name: lp_sites lp_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_sites
    ADD CONSTRAINT lp_sites_pkey PRIMARY KEY (id);

--
-- Name: lp_profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

--
-- Name: lp_purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);

--
-- Name: lp_purchases purchases_user_id_landing_page_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_purchases
    ADD CONSTRAINT purchases_user_id_landing_page_id_key UNIQUE (user_id, landing_page_id);

--
-- Name: lp_received_emails received_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_received_emails
    ADD CONSTRAINT received_emails_pkey PRIMARY KEY (id);

--
-- Name: lp_received_emails received_emails_resend_email_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_received_emails
    ADD CONSTRAINT received_emails_resend_email_id_key UNIQUE (resend_email_id);

--
-- Name: lp_reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);

--
-- Name: lp_reviews reviews_user_id_landing_page_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_reviews
    ADD CONSTRAINT reviews_user_id_landing_page_id_key UNIQUE (user_id, landing_page_id);

--
-- Name: login_failures_email_idx; Type: INDEX; Schema: app_auth; Owner: postgres
--

CREATE INDEX login_failures_email_idx ON app_auth.login_failures USING btree (email, created_at DESC);

--
-- Name: login_failures_ip_idx; Type: INDEX; Schema: app_auth; Owner: postgres
--

CREATE INDEX login_failures_ip_idx ON app_auth.login_failures USING btree (ip, created_at DESC);

--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: app_auth; Owner: postgres
--

CREATE INDEX sessions_user_id_idx ON app_auth.sessions USING btree (user_id);

--
-- Name: idx_landing_page_versions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_landing_page_versions_created_at ON public.lp_landing_page_versions USING btree (landing_page_id, created_at DESC);

--
-- Name: idx_landing_page_versions_page_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_landing_page_versions_page_id ON public.lp_landing_page_versions USING btree (landing_page_id);

--
-- Name: idx_landing_pages_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_landing_pages_category_id ON public.lp_landing_pages USING btree (category_id);

--
-- Name: idx_lp_categories_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lp_categories_parent ON public.lp_landing_page_categories USING btree (parent_id);

--
-- Name: idx_purchases_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_purchases_user_id ON public.lp_purchases USING btree (user_id);

--
-- Name: idx_received_emails_received_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_received_emails_received_at ON public.lp_received_emails USING btree (received_at DESC);

--
-- Name: idx_reviews_landing_page; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_landing_page ON public.lp_reviews USING btree (landing_page_id);

--
-- Name: idx_reviews_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_user ON public.lp_reviews USING btree (user_id);

--
-- Name: lp_chat_attachments_by_message_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_chat_attachments_by_message_idx ON public.lp_chat_attachments USING btree (message_id, created_at);

--
-- Name: lp_chat_memories_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX lp_chat_memories_unique_idx ON public.lp_chat_memories USING btree (user_id, lower(text));

--
-- Name: lp_chat_memories_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_chat_memories_user_idx ON public.lp_chat_memories USING btree (user_id, pinned DESC, created_at DESC);

--
-- Name: lp_chat_messages_by_session_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_chat_messages_by_session_idx ON public.lp_chat_messages USING btree (session_id, created_at, id);

--
-- Name: lp_chat_messages_user_recent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_chat_messages_user_recent_idx ON public.lp_chat_messages USING btree (user_id, created_at DESC);

--
-- Name: lp_chat_sessions_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_chat_sessions_user_idx ON public.lp_chat_sessions USING btree (user_id, updated_at DESC);

--
-- Name: lp_contacts_site_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_contacts_site_idx ON public.lp_contacts USING btree (site_id) WHERE (site_id IS NOT NULL);

--
-- Name: lp_landing_pages_next_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_landing_pages_next_idx ON public.lp_landing_pages USING btree (next_product_id);

--
-- Name: lp_landing_pages_published_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_landing_pages_published_idx ON public.lp_landing_pages USING btree (published);

--
-- Name: lp_page_events_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_page_events_created_idx ON public.lp_page_events USING btree (created_at DESC);

--
-- Name: lp_page_events_product_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_page_events_product_idx ON public.lp_page_events USING btree (product_id);

--
-- Name: lp_page_events_session_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_page_events_session_idx ON public.lp_page_events USING btree (session_id);

--
-- Name: lp_page_events_site_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_page_events_site_idx ON public.lp_page_events USING btree (site_id) WHERE (site_id IS NOT NULL);

--
-- Name: lp_pages_site_published_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_pages_site_published_idx ON public.lp_pages USING btree (site_id, published);

--
-- Name: lp_plan_orders_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_plan_orders_user_idx ON public.lp_plan_orders USING btree (user_id, created_at DESC);

--
-- Name: lp_product_events_page_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_product_events_page_idx ON public.lp_product_events USING btree (landing_page_id, created_at DESC);

--
-- Name: lp_product_likes_page_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_product_likes_page_idx ON public.lp_product_likes USING btree (landing_page_id);

--
-- Name: lp_profiles_account_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_profiles_account_type_idx ON public.lp_profiles USING btree (account_type);

--
-- Name: lp_profiles_email_verified_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_profiles_email_verified_at_idx ON public.lp_profiles USING btree (email_verified_at);

--
-- Name: lp_profiles_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_profiles_is_active_idx ON public.lp_profiles USING btree (is_active);

--
-- Name: lp_profiles_plan_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_profiles_plan_idx ON public.lp_profiles USING btree (plan, plan_expires_at);

--
-- Name: lp_promo_subscribers_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_promo_subscribers_created_idx ON public.lp_promo_subscribers USING btree (created_at DESC);

--
-- Name: lp_purchases_bundle_parent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_purchases_bundle_parent_idx ON public.lp_purchases USING btree (bundle_parent_id);

--
-- Name: lp_purchases_revoked_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_purchases_revoked_at_idx ON public.lp_purchases USING btree (revoked_at) WHERE (revoked_at IS NOT NULL);

--
-- Name: lp_purchases_site_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_purchases_site_idx ON public.lp_purchases USING btree (site_id) WHERE (site_id IS NOT NULL);

--
-- Name: lp_reviews_site_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_reviews_site_idx ON public.lp_reviews USING btree (site_id) WHERE (site_id IS NOT NULL);

--
-- Name: lp_sessions_campaign_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_sessions_campaign_idx ON public.lp_sessions USING btree (utm_campaign);

--
-- Name: lp_sessions_ref_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_sessions_ref_idx ON public.lp_sessions USING btree (referrer_host);

--
-- Name: lp_sessions_site_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_sessions_site_idx ON public.lp_sessions USING btree (site_id) WHERE (site_id IS NOT NULL);

--
-- Name: lp_sessions_started_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_sessions_started_idx ON public.lp_sessions USING btree (started_at DESC);

--
-- Name: lp_sessions_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_sessions_user_idx ON public.lp_sessions USING btree (user_id);

--
-- Name: lp_signup_attempts_ip_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_signup_attempts_ip_time_idx ON public.lp_signup_attempts USING btree (ip, created_at DESC);

--
-- Name: lp_site_agents_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_site_agents_user_idx ON public.lp_site_agents USING btree (user_id);

--
-- Name: lp_site_members_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_site_members_user_idx ON public.lp_site_members USING btree (user_id);

--
-- Name: lp_sites_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lp_sites_active_idx ON public.lp_sites USING btree (active);

--
-- Name: lp_sites_one_canonical_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX lp_sites_one_canonical_idx ON public.lp_sites USING btree (is_canonical) WHERE is_canonical;

--
-- Name: purchases_invoice_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX purchases_invoice_number_key ON public.lp_purchases USING btree (invoice_number) WHERE (invoice_number IS NOT NULL);

--
-- Name: lp_landing_pages lp_landing_pages_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER lp_landing_pages_updated_at BEFORE UPDATE ON public.lp_landing_pages FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

--
-- Name: lp_product_likes lp_product_likes_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER lp_product_likes_count AFTER INSERT OR DELETE ON public.lp_product_likes FOR EACH ROW EXECUTE FUNCTION public.lp_sync_like_count();

--
-- Name: lp_purchases lp_purchases_sold_count_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER lp_purchases_sold_count_trigger AFTER INSERT OR DELETE ON public.lp_purchases FOR EACH ROW EXECUTE FUNCTION public.lp_update_landing_page_sold_count();

--
-- Name: lp_reviews lp_reviews_rating_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER lp_reviews_rating_trigger AFTER INSERT OR DELETE OR UPDATE ON public.lp_reviews FOR EACH ROW EXECUTE FUNCTION public.lp_update_landing_page_rating();

--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: app_auth; Owner: postgres
--

ALTER TABLE ONLY app_auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_landing_page_versions landing_page_versions_landing_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_landing_page_versions
    ADD CONSTRAINT landing_page_versions_landing_page_id_fkey FOREIGN KEY (landing_page_id) REFERENCES public.lp_landing_pages(id) ON DELETE CASCADE;

--
-- Name: lp_landing_pages landing_pages_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_landing_pages
    ADD CONSTRAINT landing_pages_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.lp_landing_page_categories(id) ON DELETE SET NULL;

--
-- Name: lp_landing_pages landing_pages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_landing_pages
    ADD CONSTRAINT landing_pages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_chat_attachments lp_chat_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_attachments
    ADD CONSTRAINT lp_chat_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.lp_chat_messages(id) ON DELETE CASCADE;

--
-- Name: lp_chat_attachments lp_chat_attachments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_attachments
    ADD CONSTRAINT lp_chat_attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_chat_memories lp_chat_memories_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_memories
    ADD CONSTRAINT lp_chat_memories_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.lp_chat_sessions(id) ON DELETE SET NULL;

--
-- Name: lp_chat_memories lp_chat_memories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_memories
    ADD CONSTRAINT lp_chat_memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_chat_messages lp_chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_messages
    ADD CONSTRAINT lp_chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.lp_chat_sessions(id) ON DELETE CASCADE;

--
-- Name: lp_chat_messages lp_chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_messages
    ADD CONSTRAINT lp_chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_chat_prefs lp_chat_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_prefs
    ADD CONSTRAINT lp_chat_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_chat_sessions lp_chat_sessions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_sessions
    ADD CONSTRAINT lp_chat_sessions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE SET NULL;

--
-- Name: lp_chat_sessions lp_chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_chat_sessions
    ADD CONSTRAINT lp_chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_contacts lp_contacts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_contacts
    ADD CONSTRAINT lp_contacts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE SET NULL;

--
-- Name: lp_excluded_ips lp_excluded_ips_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_excluded_ips
    ADD CONSTRAINT lp_excluded_ips_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: lp_landing_page_categories lp_landing_page_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_landing_page_categories
    ADD CONSTRAINT lp_landing_page_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.lp_landing_page_categories(id) ON DELETE SET NULL;

--
-- Name: lp_landing_pages lp_landing_pages_next_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_landing_pages
    ADD CONSTRAINT lp_landing_pages_next_product_id_fkey FOREIGN KEY (next_product_id) REFERENCES public.lp_landing_pages(id) ON DELETE SET NULL;

--
-- Name: lp_page_events lp_page_events_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_page_events
    ADD CONSTRAINT lp_page_events_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lp_landing_pages(id) ON DELETE SET NULL;

--
-- Name: lp_page_events lp_page_events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_page_events
    ADD CONSTRAINT lp_page_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE SET NULL;

--
-- Name: lp_page_events lp_page_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_page_events
    ADD CONSTRAINT lp_page_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: lp_pages lp_pages_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_pages
    ADD CONSTRAINT lp_pages_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE CASCADE;

--
-- Name: lp_plan_orders lp_plan_orders_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_plan_orders
    ADD CONSTRAINT lp_plan_orders_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE SET NULL;

--
-- Name: lp_plan_orders lp_plan_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_plan_orders
    ADD CONSTRAINT lp_plan_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: lp_product_events lp_product_events_landing_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_product_events
    ADD CONSTRAINT lp_product_events_landing_page_id_fkey FOREIGN KEY (landing_page_id) REFERENCES public.lp_landing_pages(id) ON DELETE CASCADE;

--
-- Name: lp_product_likes lp_product_likes_landing_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_product_likes
    ADD CONSTRAINT lp_product_likes_landing_page_id_fkey FOREIGN KEY (landing_page_id) REFERENCES public.lp_landing_pages(id) ON DELETE CASCADE;

--
-- Name: lp_product_likes lp_product_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_product_likes
    ADD CONSTRAINT lp_product_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_purchases lp_purchases_bundle_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_purchases
    ADD CONSTRAINT lp_purchases_bundle_parent_id_fkey FOREIGN KEY (bundle_parent_id) REFERENCES public.lp_landing_pages(id) ON DELETE SET NULL;

--
-- Name: lp_purchases lp_purchases_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_purchases
    ADD CONSTRAINT lp_purchases_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: lp_purchases lp_purchases_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_purchases
    ADD CONSTRAINT lp_purchases_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE SET NULL;

--
-- Name: lp_purchases lp_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_purchases
    ADD CONSTRAINT lp_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: lp_reviews lp_reviews_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_reviews
    ADD CONSTRAINT lp_reviews_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE SET NULL;

--
-- Name: lp_sessions lp_sessions_entry_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_sessions
    ADD CONSTRAINT lp_sessions_entry_product_id_fkey FOREIGN KEY (entry_product_id) REFERENCES public.lp_landing_pages(id) ON DELETE SET NULL;

--
-- Name: lp_sessions lp_sessions_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_sessions
    ADD CONSTRAINT lp_sessions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE SET NULL;

--
-- Name: lp_sessions lp_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_sessions
    ADD CONSTRAINT lp_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: lp_site_agents lp_site_agents_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_agents
    ADD CONSTRAINT lp_site_agents_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: lp_site_agents lp_site_agents_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_agents
    ADD CONSTRAINT lp_site_agents_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE CASCADE;

--
-- Name: lp_site_agents lp_site_agents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_agents
    ADD CONSTRAINT lp_site_agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_site_members lp_site_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_members
    ADD CONSTRAINT lp_site_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: lp_site_members lp_site_members_publisher_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_members
    ADD CONSTRAINT lp_site_members_publisher_reviewed_by_fkey FOREIGN KEY (publisher_reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: lp_site_members lp_site_members_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_members
    ADD CONSTRAINT lp_site_members_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE CASCADE;

--
-- Name: lp_site_members lp_site_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_members
    ADD CONSTRAINT lp_site_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_site_settings lp_site_settings_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_site_settings
    ADD CONSTRAINT lp_site_settings_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.lp_sites(id) ON DELETE CASCADE;

--
-- Name: lp_profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: lp_purchases purchases_landing_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_purchases
    ADD CONSTRAINT purchases_landing_page_id_fkey FOREIGN KEY (landing_page_id) REFERENCES public.lp_landing_pages(id) ON DELETE CASCADE;

--
-- Name: lp_reviews reviews_landing_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_reviews
    ADD CONSTRAINT reviews_landing_page_id_fkey FOREIGN KEY (landing_page_id) REFERENCES public.lp_landing_pages(id) ON DELETE CASCADE;

--
-- Name: lp_reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lp_reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: login_failures; Type: ROW SECURITY; Schema: app_auth; Owner: postgres
--

ALTER TABLE app_auth.login_failures ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: app_auth; Owner: postgres
--

ALTER TABLE app_auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_landing_page_categories Admin can delete categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can delete categories" ON public.lp_landing_page_categories FOR DELETE USING ((public.lp_get_my_profile_role() = 'company'::text));

--
-- Name: lp_sites Admin can delete lp_sites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can delete lp_sites" ON public.lp_sites FOR DELETE USING ((public.lp_get_my_profile_role() = 'company'::text));

--
-- Name: lp_landing_page_categories Admin can insert categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can insert categories" ON public.lp_landing_page_categories FOR INSERT WITH CHECK ((public.lp_get_my_profile_role() = 'company'::text));

--
-- Name: lp_sites Admin can insert lp_sites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can insert lp_sites" ON public.lp_sites FOR INSERT WITH CHECK ((public.lp_get_my_profile_role() = 'company'::text));

--
-- Name: lp_profiles Admin can read customer profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can read customer profiles" ON public.lp_profiles FOR SELECT USING (((public.lp_get_my_profile_role() = 'company'::text) AND (account_type = 'customer'::text)));

--
-- Name: lp_landing_page_categories Admin can update categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can update categories" ON public.lp_landing_page_categories FOR UPDATE USING ((public.lp_get_my_profile_role() = 'company'::text));

--
-- Name: lp_sites Admin can update lp_sites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can update lp_sites" ON public.lp_sites FOR UPDATE USING ((public.lp_get_my_profile_role() = 'company'::text));

--
-- Name: lp_plan_orders Admin reads all plan orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin reads all plan orders" ON public.lp_plan_orders FOR SELECT USING ((public.lp_get_my_profile_role() = 'company'::text));

--
-- Name: lp_site_agents Agents read own site links; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents read own site links" ON public.lp_site_agents FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: lp_reviews Buyers insert own reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Buyers insert own reviews" ON public.lp_reviews FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.lp_purchases pu
  WHERE ((pu.user_id = auth.uid()) AND (pu.landing_page_id = lp_reviews.landing_page_id) AND (pu.revoked_at IS NULL))))));

--
-- Name: lp_profiles Enable insert for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users" ON public.lp_profiles FOR INSERT WITH CHECK ((auth.uid() = id));

--
-- Name: lp_site_members Members read own memberships; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members read own memberships" ON public.lp_site_members FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: lp_landing_pages Owners delete own landing pages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners delete own landing pages" ON public.lp_landing_pages FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: lp_landing_pages Owners update own landing pages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners update own landing pages" ON public.lp_landing_pages FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: lp_landing_page_categories Public can read categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read categories" ON public.lp_landing_page_categories FOR SELECT USING (true);

--
-- Name: lp_landing_pages Public can read landing pages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read landing pages" ON public.lp_landing_pages FOR SELECT USING (true);

--
-- Name: lp_sites Public can read lp_sites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read lp_sites" ON public.lp_sites FOR SELECT USING (true);

--
-- Name: lp_pages Public can read published pages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read published pages" ON public.lp_pages FOR SELECT USING ((published = true));

--
-- Name: lp_site_settings Public can read site_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read site_settings" ON public.lp_site_settings FOR SELECT USING (true);

--
-- Name: lp_landing_pages Sellers insert own landing pages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Sellers insert own landing pages" ON public.lp_landing_pages FOR INSERT WITH CHECK (((auth.uid() = user_id) AND public.lp_can_sell()));

--
-- Name: lp_site_settings Site managers insert site_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Site managers insert site_settings" ON public.lp_site_settings FOR INSERT WITH CHECK (public.lp_manages_site(site_id));

--
-- Name: lp_site_settings Site managers update site_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Site managers update site_settings" ON public.lp_site_settings FOR UPDATE USING (public.lp_manages_site(site_id)) WITH CHECK (public.lp_manages_site(site_id));

--
-- Name: lp_landing_page_versions Users can manage own landing page versions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own landing page versions" ON public.lp_landing_page_versions USING ((EXISTS ( SELECT 1
   FROM public.lp_landing_pages lp
  WHERE ((lp.id = lp_landing_page_versions.landing_page_id) AND (lp.user_id = auth.uid())))));

--
-- Name: lp_reviews Users can read all reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read all reviews" ON public.lp_reviews FOR SELECT USING (true);

--
-- Name: lp_profiles Users can read own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own profile" ON public.lp_profiles FOR SELECT USING ((auth.uid() = id));

--
-- Name: lp_purchases Users can read own purchases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own purchases" ON public.lp_purchases FOR SELECT USING (((auth.uid() = user_id) AND (revoked_at IS NULL)));

--
-- Name: lp_profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.lp_profiles FOR UPDATE USING ((auth.uid() = id));

--
-- Name: lp_reviews Users can update own reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own reviews" ON public.lp_reviews FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: lp_purchases Users claim free products for themselves; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users claim free products for themselves" ON public.lp_purchases FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (COALESCE(amount, 0) = 0) AND (EXISTS ( SELECT 1
   FROM public.lp_landing_pages p
  WHERE ((p.id = lp_purchases.landing_page_id) AND (p.is_free OR ((COALESCE(p.price_discount, (0)::numeric) <= (0)::numeric) AND (COALESCE(p.price, (0)::numeric) <= (0)::numeric))))))));

--
-- Name: lp_chat_attachments Users create own chat attachments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users create own chat attachments" ON public.lp_chat_attachments FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.lp_chat_messages m
  WHERE ((m.id = lp_chat_attachments.message_id) AND (m.user_id = auth.uid()))))));

--
-- Name: lp_chat_memories Users create own chat memories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users create own chat memories" ON public.lp_chat_memories FOR INSERT WITH CHECK (((auth.uid() = user_id) AND ((session_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.lp_chat_sessions s
  WHERE ((s.id = lp_chat_memories.session_id) AND (s.user_id = auth.uid())))))));

--
-- Name: lp_chat_messages Users create own chat messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users create own chat messages" ON public.lp_chat_messages FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.lp_chat_sessions s
  WHERE ((s.id = lp_chat_messages.session_id) AND (s.user_id = auth.uid()))))));

--
-- Name: lp_chat_sessions Users create own chat sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users create own chat sessions" ON public.lp_chat_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: lp_chat_attachments Users delete own chat attachments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users delete own chat attachments" ON public.lp_chat_attachments FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: lp_chat_memories Users delete own chat memories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users delete own chat memories" ON public.lp_chat_memories FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: lp_chat_messages Users delete own chat messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users delete own chat messages" ON public.lp_chat_messages FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: lp_chat_sessions Users delete own chat sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users delete own chat sessions" ON public.lp_chat_sessions FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: lp_chat_attachments Users read own chat attachments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own chat attachments" ON public.lp_chat_attachments FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: lp_chat_memories Users read own chat memories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own chat memories" ON public.lp_chat_memories FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: lp_chat_messages Users read own chat messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own chat messages" ON public.lp_chat_messages FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: lp_chat_prefs Users read own chat prefs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own chat prefs" ON public.lp_chat_prefs FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: lp_chat_sessions Users read own chat sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own chat sessions" ON public.lp_chat_sessions FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: lp_plan_orders Users read own plan orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own plan orders" ON public.lp_plan_orders FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: lp_chat_memories Users update own chat memories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users update own chat memories" ON public.lp_chat_memories FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND ((session_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.lp_chat_sessions s
  WHERE ((s.id = lp_chat_memories.session_id) AND (s.user_id = auth.uid())))))));

--
-- Name: lp_chat_prefs Users update own chat prefs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users update own chat prefs" ON public.lp_chat_prefs FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: lp_chat_sessions Users update own chat sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users update own chat sessions" ON public.lp_chat_sessions FOR UPDATE USING ((auth.uid() = user_id));

--
-- Name: lp_chat_prefs Users write own chat prefs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users write own chat prefs" ON public.lp_chat_prefs FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: lp_contacts contacts_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY contacts_insert ON public.lp_contacts FOR INSERT TO authenticated, anon WITH CHECK (true);

--
-- Name: lp_contacts contacts_select_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY contacts_select_admin ON public.lp_contacts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lp_profiles
  WHERE ((lp_profiles.id = auth.uid()) AND (lp_profiles.account_type = 'company'::text)))));

--
-- Name: lp_product_likes delete own likes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "delete own likes" ON public.lp_product_likes FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: lp_product_likes insert own likes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "insert own likes" ON public.lp_product_likes FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: lp_chat_attachments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_chat_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_chat_memories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_chat_memories ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_chat_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_chat_prefs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_chat_prefs ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_chat_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_chat_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_contacts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_excluded_ips; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_excluded_ips ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_ip_geo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_ip_geo ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_landing_page_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_landing_page_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_landing_page_versions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_landing_page_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_landing_pages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_landing_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_page_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_page_events ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_pages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_plan_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_plan_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_product_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_product_events ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_product_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_product_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_promo_subscribers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_promo_subscribers ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_purchases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_received_emails; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_received_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_signup_attempts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_signup_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_site_agents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_site_agents ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_site_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_site_members ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_site_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_sites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lp_sites ENABLE ROW LEVEL SECURITY;

--
-- Name: lp_product_events owner reads product events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "owner reads product events" ON public.lp_product_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.lp_landing_pages p
  WHERE ((p.id = lp_product_events.landing_page_id) AND (p.user_id = auth.uid())))));

--
-- Name: lp_product_likes read own likes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "read own likes" ON public.lp_product_likes FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

--
-- Name: FUNCTION lp_can_sell(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lp_can_sell() TO anon;
GRANT ALL ON FUNCTION public.lp_can_sell() TO authenticated;
GRANT ALL ON FUNCTION public.lp_can_sell() TO service_role;

--
-- Name: FUNCTION lp_get_my_profile_role(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lp_get_my_profile_role() TO anon;
GRANT ALL ON FUNCTION public.lp_get_my_profile_role() TO authenticated;
GRANT ALL ON FUNCTION public.lp_get_my_profile_role() TO service_role;

--
-- Name: FUNCTION lp_handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lp_handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.lp_handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.lp_handle_new_user() TO service_role;

--
-- Name: FUNCTION lp_increment_view(p_slug text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lp_increment_view(p_slug text) TO anon;
GRANT ALL ON FUNCTION public.lp_increment_view(p_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.lp_increment_view(p_slug text) TO service_role;

--
-- Name: FUNCTION lp_manages_site(p_site_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lp_manages_site(p_site_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lp_manages_site(p_site_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lp_manages_site(p_site_id uuid) TO service_role;

--
-- Name: FUNCTION lp_set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lp_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.lp_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.lp_set_updated_at() TO service_role;

--
-- Name: FUNCTION lp_sync_like_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lp_sync_like_count() TO anon;
GRANT ALL ON FUNCTION public.lp_sync_like_count() TO authenticated;
GRANT ALL ON FUNCTION public.lp_sync_like_count() TO service_role;

--
-- Name: FUNCTION lp_track_session(p_session_id text, p_visitor_id text, p_user_id uuid, p_ip text, p_country text, p_region text, p_city text, p_isp text, p_referrer text, p_referrer_host text, p_landing_path text, p_entry_product_id uuid, p_utm_source text, p_utm_medium text, p_utm_campaign text, p_utm_term text, p_utm_content text, p_device text, p_browser text, p_os text, p_dwell_ms bigint, p_site_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.lp_track_session(p_session_id text, p_visitor_id text, p_user_id uuid, p_ip text, p_country text, p_region text, p_city text, p_isp text, p_referrer text, p_referrer_host text, p_landing_path text, p_entry_product_id uuid, p_utm_source text, p_utm_medium text, p_utm_campaign text, p_utm_term text, p_utm_content text, p_device text, p_browser text, p_os text, p_dwell_ms bigint, p_site_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lp_track_session(p_session_id text, p_visitor_id text, p_user_id uuid, p_ip text, p_country text, p_region text, p_city text, p_isp text, p_referrer text, p_referrer_host text, p_landing_path text, p_entry_product_id uuid, p_utm_source text, p_utm_medium text, p_utm_campaign text, p_utm_term text, p_utm_content text, p_device text, p_browser text, p_os text, p_dwell_ms bigint, p_site_id uuid) TO service_role;

--
-- Name: FUNCTION lp_update_landing_page_rating(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lp_update_landing_page_rating() TO anon;
GRANT ALL ON FUNCTION public.lp_update_landing_page_rating() TO authenticated;
GRANT ALL ON FUNCTION public.lp_update_landing_page_rating() TO service_role;

--
-- Name: FUNCTION lp_update_landing_page_sold_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lp_update_landing_page_sold_count() TO anon;
GRANT ALL ON FUNCTION public.lp_update_landing_page_sold_count() TO authenticated;
GRANT ALL ON FUNCTION public.lp_update_landing_page_sold_count() TO service_role;

--
-- Name: TABLE lp_chat_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_chat_attachments TO anon;
GRANT ALL ON TABLE public.lp_chat_attachments TO authenticated;
GRANT ALL ON TABLE public.lp_chat_attachments TO service_role;

--
-- Name: TABLE lp_chat_memories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_chat_memories TO anon;
GRANT ALL ON TABLE public.lp_chat_memories TO authenticated;
GRANT ALL ON TABLE public.lp_chat_memories TO service_role;

--
-- Name: TABLE lp_chat_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_chat_messages TO anon;
GRANT ALL ON TABLE public.lp_chat_messages TO authenticated;
GRANT ALL ON TABLE public.lp_chat_messages TO service_role;

--
-- Name: TABLE lp_chat_prefs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_chat_prefs TO anon;
GRANT ALL ON TABLE public.lp_chat_prefs TO authenticated;
GRANT ALL ON TABLE public.lp_chat_prefs TO service_role;

--
-- Name: TABLE lp_chat_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_chat_sessions TO anon;
GRANT ALL ON TABLE public.lp_chat_sessions TO authenticated;
GRANT ALL ON TABLE public.lp_chat_sessions TO service_role;

--
-- Name: TABLE lp_contacts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_contacts TO anon;
GRANT ALL ON TABLE public.lp_contacts TO authenticated;
GRANT ALL ON TABLE public.lp_contacts TO service_role;

--
-- Name: TABLE lp_excluded_ips; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_excluded_ips TO anon;
GRANT ALL ON TABLE public.lp_excluded_ips TO authenticated;
GRANT ALL ON TABLE public.lp_excluded_ips TO service_role;

--
-- Name: TABLE lp_ip_geo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_ip_geo TO anon;
GRANT ALL ON TABLE public.lp_ip_geo TO authenticated;
GRANT ALL ON TABLE public.lp_ip_geo TO service_role;

--
-- Name: TABLE lp_landing_page_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_landing_page_categories TO anon;
GRANT ALL ON TABLE public.lp_landing_page_categories TO authenticated;
GRANT ALL ON TABLE public.lp_landing_page_categories TO service_role;

--
-- Name: TABLE lp_landing_page_versions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_landing_page_versions TO anon;
GRANT ALL ON TABLE public.lp_landing_page_versions TO authenticated;
GRANT ALL ON TABLE public.lp_landing_page_versions TO service_role;

--
-- Name: TABLE lp_landing_pages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_landing_pages TO anon;
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lp_landing_pages TO authenticated;
GRANT ALL ON TABLE public.lp_landing_pages TO service_role;

--
-- Name: COLUMN lp_landing_pages.title; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(title),UPDATE(title) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.slug; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(slug),UPDATE(slug) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.html_content; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(html_content),UPDATE(html_content) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.created_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(created_at),UPDATE(created_at) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.updated_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(updated_at),UPDATE(updated_at) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.user_id; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(user_id),UPDATE(user_id) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.price; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(price),UPDATE(price) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.price_discount; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(price_discount),UPDATE(price_discount) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.is_free; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(is_free),UPDATE(is_free) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.purchase_link; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(purchase_link),UPDATE(purchase_link) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.featured; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(featured),UPDATE(featured) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.thumbnail_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(thumbnail_url),UPDATE(thumbnail_url) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.purchase_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(purchase_type),UPDATE(purchase_type) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.zip_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(zip_url),UPDATE(zip_url) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.category_id; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(category_id),UPDATE(category_id) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.long_description; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(long_description),UPDATE(long_description) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.preview_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(preview_type),UPDATE(preview_type) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.preview_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(preview_url),UPDATE(preview_url) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.story_pdf_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(story_pdf_url),UPDATE(story_pdf_url) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.published; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(published),UPDATE(published) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.preview_url_dark; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(preview_url_dark),UPDATE(preview_url_dark) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.story_pdf_url_dark; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(story_pdf_url_dark),UPDATE(story_pdf_url_dark) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.cta_label; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(cta_label),UPDATE(cta_label) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.cta_note; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(cta_note),UPDATE(cta_note) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.cta_action; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(cta_action),UPDATE(cta_action) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.event_title; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(event_title),UPDATE(event_title) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.event_start; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(event_start),UPDATE(event_start) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.event_end; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(event_end),UPDATE(event_end) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.event_location; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(event_location),UPDATE(event_location) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.event_description; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(event_description),UPDATE(event_description) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.cta_reveal; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(cta_reveal),UPDATE(cta_reveal) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.preview_label; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(preview_label),UPDATE(preview_label) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.related_product_ids; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(related_product_ids),UPDATE(related_product_ids) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.available_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(available_at),UPDATE(available_at) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.story_epub_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(story_epub_url),UPDATE(story_epub_url) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.next_product_id; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(next_product_id),UPDATE(next_product_id) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.bundle_product_ids; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(bundle_product_ids),UPDATE(bundle_product_ids) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.bundle_note; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(bundle_note),UPDATE(bundle_note) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.thumbnail_landscape_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(thumbnail_landscape_url),UPDATE(thumbnail_landscape_url) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.thumbnail_extra_urls; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(thumbnail_extra_urls),UPDATE(thumbnail_extra_urls) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.preview_cut_percent; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(preview_cut_percent),UPDATE(preview_cut_percent) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: COLUMN lp_landing_pages.preview_purged_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(preview_purged_at),UPDATE(preview_purged_at) ON TABLE public.lp_landing_pages TO authenticated;

--
-- Name: TABLE lp_page_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_page_events TO anon;
GRANT ALL ON TABLE public.lp_page_events TO authenticated;
GRANT ALL ON TABLE public.lp_page_events TO service_role;

--
-- Name: TABLE lp_pages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_pages TO anon;
GRANT ALL ON TABLE public.lp_pages TO authenticated;
GRANT ALL ON TABLE public.lp_pages TO service_role;

--
-- Name: TABLE lp_plan_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_plan_orders TO anon;
GRANT ALL ON TABLE public.lp_plan_orders TO authenticated;
GRANT ALL ON TABLE public.lp_plan_orders TO service_role;

--
-- Name: TABLE lp_product_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_product_events TO anon;
GRANT ALL ON TABLE public.lp_product_events TO authenticated;
GRANT ALL ON TABLE public.lp_product_events TO service_role;

--
-- Name: TABLE lp_product_likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_product_likes TO anon;
GRANT ALL ON TABLE public.lp_product_likes TO authenticated;
GRANT ALL ON TABLE public.lp_product_likes TO service_role;

--
-- Name: TABLE lp_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.lp_profiles TO anon;
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lp_profiles TO authenticated;
GRANT ALL ON TABLE public.lp_profiles TO service_role;

--
-- Name: COLUMN lp_profiles.id; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(id) ON TABLE public.lp_profiles TO authenticated;

--
-- Name: COLUMN lp_profiles.full_name; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT(full_name),UPDATE(full_name) ON TABLE public.lp_profiles TO authenticated;

--
-- Name: COLUMN lp_profiles.avatar_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(avatar_url) ON TABLE public.lp_profiles TO authenticated;

--
-- Name: TABLE lp_promo_subscribers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_promo_subscribers TO anon;
GRANT ALL ON TABLE public.lp_promo_subscribers TO authenticated;
GRANT ALL ON TABLE public.lp_promo_subscribers TO service_role;

--
-- Name: TABLE lp_purchases; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_purchases TO anon;
GRANT ALL ON TABLE public.lp_purchases TO authenticated;
GRANT ALL ON TABLE public.lp_purchases TO service_role;

--
-- Name: TABLE lp_received_emails; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_received_emails TO anon;
GRANT ALL ON TABLE public.lp_received_emails TO authenticated;
GRANT ALL ON TABLE public.lp_received_emails TO service_role;

--
-- Name: TABLE lp_reviews; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_reviews TO anon;
GRANT ALL ON TABLE public.lp_reviews TO authenticated;
GRANT ALL ON TABLE public.lp_reviews TO service_role;

--
-- Name: TABLE lp_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_sessions TO anon;
GRANT ALL ON TABLE public.lp_sessions TO authenticated;
GRANT ALL ON TABLE public.lp_sessions TO service_role;

--
-- Name: TABLE lp_signup_attempts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_signup_attempts TO anon;
GRANT ALL ON TABLE public.lp_signup_attempts TO authenticated;
GRANT ALL ON TABLE public.lp_signup_attempts TO service_role;

--
-- Name: SEQUENCE lp_signup_attempts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lp_signup_attempts_id_seq TO anon;
GRANT ALL ON SEQUENCE public.lp_signup_attempts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.lp_signup_attempts_id_seq TO service_role;

--
-- Name: TABLE lp_site_agents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_site_agents TO anon;
GRANT ALL ON TABLE public.lp_site_agents TO authenticated;
GRANT ALL ON TABLE public.lp_site_agents TO service_role;

--
-- Name: TABLE lp_site_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_site_members TO anon;
GRANT ALL ON TABLE public.lp_site_members TO authenticated;
GRANT ALL ON TABLE public.lp_site_members TO service_role;

--
-- Name: TABLE lp_site_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_site_settings TO anon;
GRANT ALL ON TABLE public.lp_site_settings TO authenticated;
GRANT ALL ON TABLE public.lp_site_settings TO service_role;

--
-- Name: TABLE lp_sites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lp_sites TO anon;
GRANT ALL ON TABLE public.lp_sites TO authenticated;
GRANT ALL ON TABLE public.lp_sites TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

--
--

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

--
--

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

--
--

--
-- PostgreSQL database dump complete
--

-- ---------------------------------------------------------------------------
-- Pengikat antar bagian
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.lp_handle_new_user();

-- Yang dilakukan aplikasi TANPA berganti role (lib/backend/auth.ts: memutuskan
-- siapa pemanggilnya, jadi belum ada pemanggil untuk dipinjam role-nya).
grant usage on schema app_auth to app;
grant select, insert, update, delete on auth.users, auth.identities to app;
grant select, insert, update, delete on all tables in schema app_auth to app;
grant usage, select on all sequences in schema app_auth to app;
-- RLS menyala di keempat tabel ini tanpa policy untuk siapa pun (anon &
-- authenticated tetap tertutup). app bukan pemiliknya, jadi butuh policy sendiri
-- — sengaja bukan BYPASSRLS, yang akan berlaku di mana saja app diberi grant.
create policy app_all on auth.users to app using (true) with check (true);
create policy app_all on auth.identities to app using (true) with check (true);
create policy app_all on app_auth.sessions to app using (true) with check (true);
create policy app_all on app_auth.login_failures to app using (true) with check (true);
