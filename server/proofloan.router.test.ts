import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("proofloan API flow", () => {
  it("moves a preview application through the exact auditable state sequence", async () => {
    const caller = appRouter.createCaller(createContext());
    const snapshot = await caller.proofloan.createApplication({ walletAddress: "0xrouter-flow-wallet", sourceChain: "Ethereum Sepolia" });
    expect(["AwaitingAcceptance", "Rejected"]).toContain(snapshot.state);
    expect(snapshot.audit.map(event => event.state).slice(0, 5)).toEqual(["Intake", "EvidencePending", "EvidencePending", "EvidenceVerified", "Scored"]);
    expect(["OfferPrepared", "Rejected"]).toContain(snapshot.audit.at(-1)?.state);
    expect(snapshot.facts).toHaveLength(3);
    expect(snapshot.decision?.reasonCodes.length).toBeGreaterThan(0);
  }, 30_000);

  it("accepts an offer once and rejects a replay at the API boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    const snapshot = await caller.proofloan.createApplication({ walletAddress: "0xreplay-test-wallet", sourceChain: "Polygon Amoy" });
    const executed = await caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId });
    expect(executed.state).toBe("Executed");
    await expect(caller.proofloan.acceptOffer({ applicationId: snapshot.applicationId })).rejects.toThrow("already accepted");
  }, 30_000);
});
