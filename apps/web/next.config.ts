import type { NextConfig } from "next";
const config: NextConfig = { distDir: process.env.NEXT_DIST_DIR ?? ".next", allowedDevOrigins: ["127.0.0.1"], experimental: { optimizePackageImports: ["lucide-react"] }, transpilePackages: ["@neora/ui", "@neora/scoring", "@neora/contracts"] };
export default config;
