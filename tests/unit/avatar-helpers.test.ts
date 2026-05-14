import { describe, expect, it } from "vitest";
import {
  avatarBackgroundForUserId,
  resolveAvatarBackgroundColor,
  userInitials,
} from "@/lib/avatar-helpers";

describe("userInitials", () => {
  it("returns two letters for two words", () => {
    expect(userInitials("Ana García")).toBe("AG");
  });
  it("returns single letter for one word", () => {
    expect(userInitials("calidad")).toBe("C");
  });
  it("handles empty", () => {
    expect(userInitials("   ")).toBe("?");
  });
});

describe("avatarBackgroundForUserId", () => {
  it("returns a hex color from palette", () => {
    const c = avatarBackgroundForUserId("user-123");
    expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
  it("is stable for same id", () => {
    expect(avatarBackgroundForUserId("abc")).toBe(avatarBackgroundForUserId("abc"));
  });
});

describe("resolveAvatarBackgroundColor", () => {
  it("uses stored valid hex", () => {
    expect(resolveAvatarBackgroundColor("u1", "#aabbcc")).toBe("#aabbcc");
  });
  it("falls back when stored invalid", () => {
    const fb = avatarBackgroundForUserId("u2");
    expect(resolveAvatarBackgroundColor("u2", "not-a-color")).toBe(fb);
  });
});
