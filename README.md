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

   **Email (Resend):** For purchase confirmation emails and receiving inbound mail:

   ```
   RESEND_API_KEY=re_xxxxx
   RESEND_FROM=onboarding@resend.dev  # Or verified domain
   RESEND_WEBHOOK_SECRET=whsec_xxxxx  # For inbound webhook (admin@admuiux.com); from Resend → Webhooks → signing secret
   ```

3. **Database**

   **Option A – Supabase CLI (local):**

   ```bash
   npm run supabase:start   # Start local Supabase (Docker required)
   npm run db:reset         # Apply migrations
   ```

   Local URL: `http://localhost:54321` (from `supabase status`). Use local project URL and anon key in `.env.local`.

   **Email verification on signup:** Untuk Supabase cloud, aktifkan "Confirm email" di Dashboard → Authentication → Providers → Email.

   **Google OAuth:** Aktifkan provider Google di Supabase Dashboard → Auth → Providers → Google, isi Client ID dan Secret dari [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Tambahkan `NEXT_PUBLIC_SITE_URL/auth/callback` ke Redirect URLs di Supabase Auth settings (mis. `http://localhost:3000/auth/callback`).

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
- **Inbound email**: Emails to admin@admuiux.com are received via Resend; webhook `POST /api/webhooks/resend/inbound` (event `email.received`). Configure the receiving address and webhook URL in Resend; panel → "Email masuk" (admin only) lists and shows received emails.

**Troubleshooting — email belum masuk di panel:**
1. **Webhook di Resend**: Dashboard → [Webhooks](https://resend.com/webhooks) → Add → pilih event **`email.received`** (bukan "Emails" / sent). URL: `https://<domain-anda>/api/webhooks/resend/inbound`. Copy **Signing secret** dan set sebagai `RESEND_WEBHOOK_SECRET` di Vercel/env.
2. **Receiving domain**: Pastikan alamat penerima (mis. admin@admuiux.com) sudah aktif di Resend → **Emails → Receiving**. Email yang masuk harus ke alamat itu.
3. **Hanya email baru**: Webhook hanya dipanggil untuk email yang **diterima setelah** webhook dibuat. Email yang sudah ada di Resend sebelum webhook tidak akan masuk panel. Kirim email uji baru ke admin@admuiux.com.
4. **Cek endpoint**: Buka `GET https://<domain-anda>/api/webhooks/resend/inbound` — harus return `configured: true` jika env sudah benar.
5. **Log di Vercel**: Deploy → Functions → pilih log untuk `/api/webhooks/resend/inbound`. Cari `[resend-inbound]` untuk error (verification failed, missing email_id, insert error).
