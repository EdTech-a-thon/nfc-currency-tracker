import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  allowedDevOrigins: ["*.exe.xyz", "*.edtechathon.com"],
};

export default nextConfig;
