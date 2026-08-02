import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerComputeDeadline } from "../../src/tools/compute-deadline.js";
import { registerComputePrescription } from "../../src/tools/compute-prescription.js";
import { registerCompute13thMonth } from "../../src/tools/compute-13th-month.js";

/** One connected client per server instance (a server connects only once). */
const connectedClients = new WeakMap<McpServer, Client>();

/**
 * Invoke a tool registered on a bare McpServer by name and return
 * structuredContent. The SDK's McpServer class does not expose callTool
 * directly, so the server is exercised over an in-memory transport with a
 * real MCP Client — the same path the eval harness and real clients use.
 */
async function callTool(
  server: McpServer,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let client = connectedClients.get(server);
  if (!client) {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "0.0.0" });
    // Server must accept the transport BEFORE the client sends its initialize
    // handshake — the opposite order times out the client's request.
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    connectedClients.set(server, client);
  }
  const res = await client.callTool({ name, arguments: args });
  return (res.structuredContent ?? {}) as Record<string, unknown>;
}

function makeServer(): McpServer {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerComputePrescription(server);
  registerComputeDeadline(server);
  registerCompute13thMonth(server);
  return server;
}

describe("compute_prescription", () => {
  it("returns 10 years for a written contract (Art. 1144(1))", async () => {
    const s = makeServer();
    const out = await callTool(s, "compute_prescription", { actionType: "written_contract" });
    expect(out.years).toBe(10);
    expect(out.article).toContain("1144");
  });

  it("returns 1 year for forcible entry and detainer (Art. 1147(1))", async () => {
    const s = makeServer();
    const out = await callTool(s, "compute_prescription", { actionType: "forcible_entry_detainer" });
    expect(out.years).toBe(1);
    expect(out.article).toContain("1147");
  });

  it("uses the Art. 1149 residual 5-year period for 'other'", async () => {
    const s = makeServer();
    const out = await callTool(s, "compute_prescription", { actionType: "other" });
    expect(out.years).toBe(5);
    expect(out.article).toBe("Art. 1149");
  });

  it("computes a deadline from a cause-of-action date", async () => {
    const s = makeServer();
    const out = await callTool(s, "compute_prescription", {
      actionType: "oral_contract",
      causeOfActionDate: "2020-03-01",
    });
    expect(out.deadline).toBe("2026-03-01"); // 6 years later
  });

  it("rejects a malformed date", async () => {
    const s = makeServer();
    const out = await callTool(s, "compute_prescription", {
      actionType: "written_contract",
      causeOfActionDate: "03/01/2020",
    });
    expect(out.status).toBe("invalid_date");
  });
});

describe("compute_deadline", () => {
  it("applies Rule 22: 15 days from notice, excludes first day", async () => {
    const s = makeServer();
    const out = await callTool(s, "compute_deadline", {
      filingType: "motion_reconsideration",
      noticeDate: "2026-01-05",
    });
    // Jan 5 + 15 days = Jan 20 (a Tuesday in 2026); not a weekend/holiday.
    expect(out.lastDay).toBe("2026-01-20");
    expect(out.rule).toContain("Rule 37");
  });

  it("rolls a last day on a Sunday to the next working day", async () => {
    const s = makeServer();
    // 2026-01-06 is a Tuesday; +15 = Jan 21 (Wednesday). Choose dates that land on a Sunday:
    // notice 2026-01-11 (Sunday) is not valid as notice, but we only test arithmetic:
    // 2026-02-01 is a Sunday; notice 2026-01-17 + 15 = 2026-02-01 (Sunday) → rolls to Monday 2026-02-02.
    const out = await callTool(s, "compute_deadline", {
      filingType: "appeal_rtc_to_ca",
      noticeDate: "2026-01-17",
    });
    expect(out.lastDay).toBe("2026-02-02");
  });

  it("honors an explicit holiday list", async () => {
    const s = makeServer();
    // 2026-01-20 lands on Tuesday; if declared a holiday, rolls to Wednesday 2026-01-21.
    const out = await callTool(s, "compute_deadline", {
      filingType: "motion_reconsideration",
      noticeDate: "2026-01-05",
      holidays: ["2026-01-20"],
    });
    expect(out.lastDay).toBe("2026-01-21");
  });

  it("allows the Rule 45 extension (max 30 days)", async () => {
    const s = makeServer();
    const base = await callTool(s, "compute_deadline", {
      filingType: "appeal_certiorari_sc",
      noticeDate: "2026-01-05",
    });
    expect(base.baseDays).toBe(15);
    const ext = await callTool(s, "compute_deadline", {
      filingType: "appeal_certiorari_sc",
      noticeDate: "2026-01-05",
      extensionDays: 30,
    });
    expect(ext.totalDays).toBe(45);
  });

  it("returns 60 days for certiorari/prohibition/mandamus (Rule 65)", async () => {
    const s = makeServer();
    const out = await callTool(s, "compute_deadline", {
      filingType: "certiorari_prohibition_mandamus",
      noticeDate: "2026-01-05",
    });
    expect(out.baseDays).toBe(60);
    expect(out.rule).toContain("Rule 65");
  });

  it("rejects malformed holiday entries", async () => {
    const s = makeServer();
    const out = await callTool(s, "compute_deadline", {
      filingType: "motion_reconsideration",
      noticeDate: "2026-01-05",
      holidays: ["not-a-date"],
    });
    expect(out.status).toBe("invalid_date");
  });
});

describe("compute_13th_month", () => {
  it("computes total ÷ 12 for a full year", async () => {
    const s = makeServer();
    const out = await callTool(s, "compute_13th_month", { totalBasicSalary: 360_000 });
    expect(out.amount).toBe(30_000);
    expect(out.payableOnOrBefore).toContain("December 24");
  });

  it("pro-rates a partial year automatically (total earned ÷ 12)", async () => {
    const s = makeServer();
    // Employee worked 6 months and earned 180,000 in that period.
    const out = await callTool(s, "compute_13th_month", { totalBasicSalary: 180_000 });
    expect(out.amount).toBe(15_000);
  });
});
