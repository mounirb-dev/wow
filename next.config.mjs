/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // `bun run verify` compila en su propia carpeta (NEXT_DIST_DIR) para no pisar la `.next` de un `next dev` abierto.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
