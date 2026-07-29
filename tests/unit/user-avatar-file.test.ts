import { describe, expect, it } from "vitest";
import { sanitizeAvatarFilename } from "@/lib/user-avatar-file";

describe("sanitizeAvatarFilename", () => {
  it("keeps safe characters", () => {
    expect(sanitizeAvatarFilename("avatar-01")).toBe("avatar-01");
  });
  it("replaces unsafe characters", () => {
    expect(sanitizeAvatarFilename("mi foto #1.png")).toBe("mi_foto__1.png");
  });
  it("falls back when empty", () => {
    expect(sanitizeAvatarFilename("")).toBe("file");
  });
  it("truncates long names", () => {
    expect(sanitizeAvatarFilename("a".repeat(200)).length).toBe(120);
  });
});
