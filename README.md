# Landing Page Manager

Next.js + Supabase app to manage and publish HTML landing pages. Authenticated panel for listing, uploading, and editing HTML; public routes for viewing landing pages by slug.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env.local` and set your Supabase project URL and anon key:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For payment callbacks
   NEXT_PUBLIC_SITE_URL=https://your-domain.com     # For Duitku callback/return URLs
   ```

   **Duitku (payment gateway):** For internal checkout, add:

   ```
   DUITKU_MERCHANT_CODE=your-merchant-code
   DUITKU_API_KEY=your-api-key
   DUITKU_SANDBOX=true   # Set false for production
   ```

   **Email (Resend):** For purchase confirmation emails:

   ```
   RESEND_API_KEY=re_xxxxx
   RESEND_FROM=onboarding@resend.dev  # Or verified domain
   ```

3. **Database**

   **Option A – Supabase CLI (local):**

   ```bash
   npm run supabase:start   # Start local Supabase (Docker required)
   npm run db:reset         # Apply migrations
   ```

   Local URL: `http://localhost:54321` (from `supabase status`). Use local project URL and anon key in `.env.local`.

   **Option B – Remote project:**

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-id>
   npm run db:push          # Push migrations to remote
   ```

   Or run `supabase/migrations/20250228000000_landing_pages.sql` manually in the Supabase SQL Editor.

4. **Run**

   ```bash
   npm run dev
   ```

   - Home `/` redirects to `/panel` (if logged in) or `/login`.
   - Sign up or log in, then use the panel to create, upload, or edit landing pages.
   - Public URLs: `/lp/[slug]` (e.g. `/lp/my-page`).

## Features

- **Homepage**: Browse landing pages with preview cards, pricing (normal, discount, free), and purchase links to payment gateways.
- **Auth**: Email/password login and signup; session refresh via middleware; `/panel` protected.
- **Panel**: List landing pages (edit, view, delete), upload HTML file, create new page, edit in HTML/CSS/JS tabbed Monaco editor (Save / Cmd+S), upload assets (images, videos), set pricing and purchase link, preview via `/lp/[slug]`.
- **Editor**: Monaco editor with HTML, CSS, and JavaScript tabs; assets panel; pricing form (normal/discount/free, purchase link, show on homepage).
- **Public**: Full-page HTML view at `/lp/[slug]` (iframe); metadata title from page title.
