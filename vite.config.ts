import { defineConfig } from "vitest/config";

const serverPort = Number(process.env.SERVER_PORT ?? 8787);
/** `npm run dev:lan` : le jeu est servi sur le réseau local (le serveur proxy, lui, reste sur 127.0.0.1). */
const lan = process.env.MEGAQUIZ_LAN === "1";

export default defineConfig({
  server: {
    host: lan ? "0.0.0.0" : "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      // changeOrigin: false garde l'en-tête Host de la page : le serveur vérifie que les écritures
      // viennent bien de la page du jeu (même origine), en local comme sur le réseau.
      "/api": { target: `http://127.0.0.1:${serverPort}`, changeOrigin: false },
    },
  },
  preview: {
    host: lan ? "0.0.0.0" : "127.0.0.1",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
