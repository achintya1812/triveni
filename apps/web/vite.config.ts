import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Offline (Stage 17): the app shell is cached and the app installs to the home screen. Clips from the
    // public `audio` bucket are cached as they're fetched (the check fetches its clips ahead), so a check
    // runs with no signal. Writes wait in the Dexie outbox (src/db.ts).
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Triveni",
        short_name: "Triveni",
        description: "Finds why each child is stuck in maths, in three languages.",
        lang: "hi",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0f5132",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/public/audio/"),
            handler: "CacheFirst",
            options: {
              cacheName: "audio",
              cacheableResponse: { statuses: [0, 200] },
              // <audio> asks for byte ranges; this answers them from the cached file.
              rangeRequests: true,
              expiration: { maxEntries: 400 },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
