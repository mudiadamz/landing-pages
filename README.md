# Landing Page Manager

### **Database**

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

### **Run**

   ```bash
   npm run dev
   ```