import { afterEach, describe, expect, it, vi } from "vitest";
import { createP1Api } from "../p1/api.ts";
import { p2Client } from "./adapter.ts";
import type { PreparedAction } from "./core.ts";

const wallet = "0x1111111111111111111111111111111111111111";
const target = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}` as `0x${string}`;
const submitted = { id: "act_receipt", wallet, target, calldata: "0x1234", txHash: hash, txNonce: 3, chainId: 5042, state: "submitted", submittedAt: new Date(Date.now() - 31 * 60_000).toISOString() } as unknown as PreparedAction;

function harness(chainId = 5042) {
  let action = { ...submitted, chainId };
  const db = { prepare(query: string) {
    let params: unknown[] = [];
    return {
      bind(...values: unknown[]) { params = values; return this; },
      async first() {
        if (query.includes("FROM p1_sessions")) return { wallet };
        if (query.includes("FROM p2_actions")) return params[0] === action.id && params[1] === wallet ? { action_json: JSON.stringify(action), updated_at: action.submittedAt } : null;
        return null;
      },
      async all() { return { results: [] }; },
      async run() {
        if (query.startsWith("UPDATE p2_actions")) action = JSON.parse(params[0] as string) as PreparedAction;
        return { meta: { changes: 1 } };
      },
    };
  } };
  const app = createP1Api(async () => ({ items: [] }) as never, async () => false);
  return {
    getStatus: async () => (await app.request(`http://localhost/actions/${action.id}`, { headers: { Cookie: `mandevyr_session=${"a".repeat(64)}` } }, { DB: db })).status,
    get: async () => {
      const response = await app.request(`http://localhost/actions/${action.id}`, { headers: { Cookie: `mandevyr_session=${"a".repeat(64)}` } }, { DB: db });
      expect(response.status).toBe(200);
      return response.json() as Promise<PreparedAction>;
    },
    record: async (txHash: string) => {
      const response = await app.request(`http://localhost/actions/${action.id}/tx`, { method: "POST", headers: { Cookie: `mandevyr_session=${"a".repeat(64)}`, Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ hash: txHash }) }, { DB: db });
      return { status: response.status, data: await response.json() as PreparedAction & { error?: string } };
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("P2 receipt reconciliation", () => {
  it("does not expose an old Arc Testnet action through the mainnet endpoint", async () => {
    const api = harness(5042002);
    expect(await api.getStatus()).toBe(404);
    expect((await api.record(hash)).status).toBe(404);
  });
  it("keeps provider timeouts unknown even after thirty minutes", async () => {
    vi.spyOn(p2Client, "getTransaction").mockRejectedValue(new Error("RPC timeout"));
    const action = await harness().get();
    expect(action.state).toBe("unknown");
  });

  it("only drops a transaction after an explicit not-found response", async () => {
    vi.spyOn(p2Client, "getTransaction").mockRejectedValue(Object.assign(new Error("not found"), { name: "TransactionNotFoundError" }));
    vi.spyOn(p2Client, "getTransactionCount").mockResolvedValue(3);
    const action = await harness().get();
    expect(action.state).toBe("dropped");
  });

  it("keeps a missing hash unknown when the wallet nonce has advanced", async () => {
    vi.spyOn(p2Client, "getTransaction").mockRejectedValue(Object.assign(new Error("not found"), { name: "TransactionNotFoundError" }));
    vi.spyOn(p2Client, "getTransactionCount").mockResolvedValue(4);
    const action = await harness().get();
    expect(action.state).toBe("unknown");
    expect(action.message).toContain("replacement");
  });

  it("accepts a replacement hash only for the same wallet nonce and call", async () => {
    const transaction = vi.spyOn(p2Client, "getTransaction");
    const replacement = `0x${"b".repeat(64)}`;
    transaction.mockResolvedValueOnce({ from: wallet, to: target, input: "0x1234", value: 0n, chainId: 5042, nonce: 4 } as never);
    const api = harness();
    expect((await api.record(replacement)).status).toBe(409);
    transaction.mockResolvedValueOnce({ from: wallet, to: target, input: "0x1234", value: 0n, chainId: 5042, nonce: 3 } as never);
    const recorded = await api.record(replacement);
    expect(recorded.status).toBe(200);
    expect(recorded.data.txHash).toBe(replacement);
  });

  it("uses the onchain receipt for success and failure", async () => {
    vi.spyOn(p2Client, "getTransaction").mockResolvedValue({ from: wallet, to: target, input: "0x1234" } as never);
    const receipt = vi.spyOn(p2Client, "getTransactionReceipt");
    receipt.mockResolvedValueOnce({ status: "reverted" } as never);
    expect((await harness().get()).state).toBe("reverted");
    receipt.mockResolvedValueOnce({ status: "success" } as never);
    expect((await harness().get()).state).toBe("confirmed");
  });
});
