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
        // Mode « prompt » : le nouveau SW RESTE en attente (skipWaiting:false)
        // tant que l'utilisateur n'a pas cliqué « Mettre à jour ». À ce moment,
        // le message SKIP_WAITING l'active ; clientsClaim:true lui fait alors
        // prendre le contrôle de la page ouverte → `controllerchange` →
        // rechargement automatique. Sans clientsClaim, le bouton ne rechargeait
        // pas (le SW s'activait mais ne contrôlait pas la fenêtre courante).
        skipWaiting: false,
        clientsClaim: true,
        // Ne jamais intercepter/mettre en cache des requêtes dynamiques.
        navigateFallbackDenylist: [/^\/api\//],
        // IMPORTANT : on ne déclare AUCUNE route runtime pour Firebase.
        // Les appels Auth/Firestore ne doivent ni être mis en cache, ni même
        // transiter par le service worker. En particulier, la connexion de
        // streaming permanente de Firestore (onSnapshot), si elle passait par
        // le SW, empêcherait `clients.claim()` de prendre le contrôle lors d'une
        // mise à jour (requête « in-flight » jamais terminée) → le rechargement
        // ne se déclenchait pas quand l'utilisateur était synchronisé.
        // Sans route, ces requêtes cross-origin sont gérées normalement par le
        // navigateur, hors du périmètre du SW.
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
