import { describe, expect, it } from "vitest";
import { theme } from "../../theme";

describe("mobile theme matches web brand tokens", () => {
  it("keeps AMISSA primary / accent / neutrals", () => {
    expect(theme.primary).toBe("#02257D");
    expect(theme.accent).toBe("#F14C03");
    expect(theme.neutral400).toBe("#9E9F9F");
    expect(theme.neutral900).toBe("#000000");
    expect(theme.supportGreen).toBe("#6FAF6F");
    expect(theme.surface).toBe("#F8FAFC");
  });

  it("matches web kind badge colors from globals.css", () => {
    expect(theme.kindRoutineBg.toLowerCase()).toBe("#dbeafe");
    expect(theme.kindRoutineFg.toLowerCase()).toBe("#1d4ed8");
    expect(theme.kindRoutineBorder.toLowerCase()).toBe("#93c5fd");
    expect(theme.kindOnDemandBg.toLowerCase()).toBe("#ffedd5");
    expect(theme.kindOnDemandFg.toLowerCase()).toBe("#9a3412");
    expect(theme.kindOnDemandBorder.toLowerCase()).toBe("#fdba74");
  });
});
