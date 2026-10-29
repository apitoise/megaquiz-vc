import { defineConfig } from "vitest/config";

const serverPort = Number(process.env.SERVER_PORT ?? 8787);

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${serverPort}`,
    },
  },
  preview: {
    host: "127.0.0.1",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
