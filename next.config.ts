import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  outputFileTracingExcludes: {
    "*": [
      "promotor_app/**",
      "backup_*/**",
      "backups/**",
      "Dados da Coffee mais/**",
      "Power Bi da Forno de Minas/**",
      "_bmad/**",
    ],
  },
};

export default nextConfig;
