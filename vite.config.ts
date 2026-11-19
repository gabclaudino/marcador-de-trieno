import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Atualiza sozinho: app pessoal, sem aviso de "nova versão".
      registerType: "autoUpdate",
      // O Cloudflare Access protege o domínio todo: o manifest precisa ir com o cookie
      // de login (crossorigin="use-credentials"), senão o Access o redireciona e ele falha.
      useCredentials: true,
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "icon.svg"],
      manifest: {
        id: "/",
        name: "Marcador de Treino",
        short_name: "Treino",
        description: "Registro de cargas de treino na academia.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#059669",
        background_color: "#ffffff",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Pré-cache dos assets do app (JS/CSS/ícones). O HTML fica de fora de propósito:
        // é tratado abaixo, para o login do Access nunca ficar "preso" em cache.
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // A API nunca é cacheada nem servida offline.
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
          // Navegação: rede primeiro (se a sessão do Access expirou, vai para o login);
          // sem rede, abre o app shell salvo.
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "app-shell",
              networkTimeoutSeconds: 4,
              plugins: [{ cacheKeyWillBeUsed: async () => "/index.html" }],
            },
          },
        ],
      },
    }),
    cloudflare(),
  ],
});
