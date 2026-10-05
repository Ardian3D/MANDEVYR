import { describe, expect, it } from "vitest";
import { createP1Api, type P1Database } from "./api";

const worker = "https://mandevyr-p1.example.workers.dev";
const site = "https://mandevyr.vercel.app";
const app = createP1Api(async () => ({ items: [] }) as never, async () => false);
const db: P1Database = { prepare() {
  return {
    bind() { return this; },
    async first<T>() { return { count: 1 } as T; },
    async all<T>() { return { results: [] as T[] }; },
    async run() { return { meta: { changes: 1 } }; },
  };
} };

describe("proxied P1 origin", () => {
  it("accepts the configured public site for sign-in requests", async () => {
    const response = await app.request(`${worker}/auth/nonce`, { method: "POST", headers: { Origin: site } }, { DB: db, MANDEVYR_PUBLIC_ORIGINS: site });
    expect(response.status).toBe(200);
    expect((await response.json()).nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it("rejects other and missing origins", async () => {
    for (const origin of ["https://other.example", undefined]) {
      const response = await app.request(`${worker}/auth/nonce`, { method: "POST", headers: origin ? { Origin: origin } : {} }, { DB: db, MANDEVYR_PUBLIC_ORIGINS: site });
      expect(response.status).toBe(403);
    }
  });

  it("reports database and write-switch readiness", async () => {
    const response = await app.request(`${worker}/health`, {}, { DB: db, P2_MAINNET_WRITES_ENABLED: "true" });
    expect(await response.json()).toMatchObject({ status: "ok", chainId: 5042, database: "ready", writesEnabled: true });
  });
});
