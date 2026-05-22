import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Soroban contract bindings ship as TypeScript from a workspace package.
  transpilePackages: ["@molotov/stellar-client"],
};

export default nextConfig;
