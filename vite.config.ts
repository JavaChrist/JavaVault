import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// Configuration Vite + PWA.
// Le service worker ne met en cache que l'interface et les ressources statiques.
// Aucune réponse contenant des secrets en clair n'est mise en cache (le coffre
// vit dans IndexedDB chiffré, hors du périmètre du SW).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["icons/logo-180.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Purge les anciens caches applicatifs lors de l'activation d'une
        // nouvelle version (IndexedDB et le coffre ne sont PAS concernés).
        cleanupOutdatedCaches: true,
        // Mode « prompt » : ne pas prendre le contrôle sans action utilisateur.
        skipWaiting: false,
        clientsClaim: false,
        // Ne jamais intercepter/mettre en cache des requêtes dynamiques.
        navigateFallbackDenylist: [/^\/api\//],
        // Ne jamais mettre en cache les appels Firebase (Auth/Firestore).
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              /(^https:\/\/)([a-z0-9-]+\.)?(googleapis|firebaseio|firebaseapp|firebase|gstatic)\.com/.test(
                url.href,
              ),
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: {
        // Permet de tester l'enregistrement du SW en développement.
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "JavaVault",
        short_name: "JavaVault",
        description:
          "Coffre-fort personnel chiffré pour clés, variables et fichiers de configuration.",
        lang: "fr",
        dir: "ltr",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icons/logo-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/logo-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/logo-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // Découpage : Firebase (lourd, chargé pour la synchro) isolé du cœur appli.
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
          ],
          react: ["react", "react-dom"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
