import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // @ts-ignore
    agentUpgrade: "security",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/super-admin",
        destination: "/superadmin",
        permanent: true,
      },
      {
        source: "/super_admin",
        destination: "/superadmin",
        permanent: true,
      },
      {
        source: "/admin/superadmin",
        destination: "/superadmin",
        permanent: true,
      },
      {
        source: "/gerencia",
        destination: "/superadmin",
        permanent: true,
      },
      {
        source: "/termos",
        destination: "/termos-de-uso",
        permanent: true,
      },
      {
        source: "/privacidade",
        destination: "/politica-de-privacidade",
        permanent: true,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSerwist(nextConfig);
