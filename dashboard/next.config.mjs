/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // better-sqlite3 é módulo nativo: precisa ser carregado do node_modules em
  // tempo de execução, não empacotado pelo bundler.
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
