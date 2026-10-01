import { defineConfig } from "vitest/config";

// Pure evidence tests do not need the Cloudflare Worker dev server.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
