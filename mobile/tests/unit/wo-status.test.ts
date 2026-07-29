import { describe, expect, it } from "vitest";
import { normalizeWoStatus, statusLabel } from "../../lib/wo-status";

describe("normalizeWoStatus", () => {
  it("maps open to pending", () => {
    expect(normalizeWoStatus("open")).toBe("pending");
  });
  it("keeps known statuses", () => {
    expect(normalizeWoStatus("in_progress")).toBe("in_progress");
    expect(normalizeWoStatus("completed")).toBe("completed");
  });
  it("defaults unknown to pending", () => {
    expect(normalizeWoStatus("weird")).toBe("pending");
  });
});

describe("statusLabel", () => {
  it("returns Spanish labels", () => {
    expect(statusLabel("pending")).toBe("Pendiente");
    expect(statusLabel("cancelled")).toBe("Cancelada");
  });
});
