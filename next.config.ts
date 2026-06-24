import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  experimental: {
    // ZIP uploads are sent to a Server Action as FormData; the default 1MB
    // limit is far too small for a full site bundle.
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
