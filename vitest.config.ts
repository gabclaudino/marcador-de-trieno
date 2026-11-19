import { defineConfig } from "vitest/config";

// Config separada do vite.config.ts: os testes rodam em Node puro, sem os
// plugins do Cloudflare/Tailwind.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
