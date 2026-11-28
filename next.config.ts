import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // Allow mobile/tunnel access to dev HMR resources during development.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
