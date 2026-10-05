import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icone.svg"],
      manifest: {
        name: "CheckVale",
        short_name: "CheckVale",
        description: "Checklist digital para mobilizar veículos",
        lang: "pt-BR",
        theme_color: "#0E5B45",
        background_color: "#0E5B45",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [{ src: "icone.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        // App shell offline; chamadas /api nunca vão para o cache do service worker (o dado offline mora no IndexedDB).
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  server: { proxy: { "/api": process.env.API_URL ?? "http://localhost:3000" } },
  test: { environment: "jsdom", setupFiles: ["./src/teste-setup.ts"] },
});
