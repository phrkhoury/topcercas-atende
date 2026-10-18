import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que o Next escolha uma pasta acima do projeto como raiz (há outro package-lock.json em C:\Users\ph).
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
