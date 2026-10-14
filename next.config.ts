import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    // Build-time marker: identical in the HTML and admin route bundle.
    NIBATLAS_RELEASE: /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "")
      ? process.env.GITHUB_SHA!
      : "development",
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
