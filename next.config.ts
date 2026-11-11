import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  transpilePackages: ["@capacitor/core", "@capacitor/local-notifications", "@capacitor/app"],
  async redirects() {
    return [
      { source: "/os", destination: "/home", permanent: false },
      { source: "/os/:path*", destination: "/home/:path*", permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ]
  },
};

export default nextConfig;
