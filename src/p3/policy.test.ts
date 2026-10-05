import { describe, expect, it } from "vitest";
import { assessAgentSpend, validateAgentPolicy } from "./policy";

const policy = validateAgentPolicy({
  allowedOrigins: ["https://api.example.com"],
  allowedPathPrefixes: ["/v1/report/"],
  maxPerRequestRaw: "10000",
  maxDailyRaw: "20000",
  manualApproval: true,
  enabled: true,
});

describe("agent spending review", () => {
  it("enforces exact HTTPS origin, route prefix and both limits", () => {
    const base = { policy, resourceUrl: "https://api.example.com/v1/report/123", priceRaw: "10000", spentTodayRaw: "10000" };
    expect(assessAgentSpend(base).allowed).toBe(true);
    expect(assessAgentSpend({ ...base, resourceUrl: "https://api.example.com.evil.test/v1/report/123" }).allowed).toBe(false);
    expect(assessAgentSpend({ ...base, resourceUrl: "http://api.example.com/v1/report/123" }).allowed).toBe(false);
    expect(assessAgentSpend({ ...base, resourceUrl: "https://api.example.com/admin" }).allowed).toBe(false);
    expect(assessAgentSpend({ ...base, priceRaw: "10001" }).allowed).toBe(false);
    expect(assessAgentSpend({ ...base, spentTodayRaw: "10001" }).allowed).toBe(false);
  });

  it("requires manual approval and rejects local destinations", () => {
    expect(() => validateAgentPolicy({ ...policy, manualApproval: false })).toThrow();
    expect(() => validateAgentPolicy({ ...policy, allowedOrigins: ["https://127.0.0.1"] })).toThrow();
    expect(assessAgentSpend({ policy: { ...policy, enabled: false }, resourceUrl: "https://api.example.com/v1/report/123", priceRaw: "1", spentTodayRaw: "0" }).allowed).toBe(false);
  });
});
