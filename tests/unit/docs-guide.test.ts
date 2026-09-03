import { describe, expect, it } from "vitest";
import {
  DOCS_BASE_PATH,
  DOCS_CALENDAR_TO_TASK_STEPS,
  DOCS_ROLE_ACCESS,
  DOCS_SECTIONS,
  docsHref,
  docsNavForRole,
  getDocsSection,
  isDocsSectionSlug,
  roleAccessLabel,
} from "@/lib/docs-guide";

describe("docs guide catalog", () => {
  it("exposes a stable hub path and unique slugs", () => {
    expect(DOCS_BASE_PATH).toBe("/documentacion");
    const slugs = DOCS_SECTIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(isDocsSectionSlug("tareas")).toBe(true);
    expect(isDocsSectionSlug("nope")).toBe(false);
    expect(getDocsSection("calendario")?.title).toContain("Calendario");
    expect(getDocsSection("xyz")).toBeNull();
    expect(docsHref("movil")).toBe("/documentacion/movil");
  });

  it("lists the same chapters for every role (docs are shared)", () => {
    expect(docsNavForRole("admin")).toHaveLength(DOCS_SECTIONS.length);
    expect(docsNavForRole("tecnico")).toHaveLength(DOCS_SECTIONS.length);
    expect(docsNavForRole("calidad")).toHaveLength(DOCS_SECTIONS.length);
  });

  it("describes role access in Mexican Spanish labels", () => {
    expect(roleAccessLabel(true)).toBe("Sí");
    expect(roleAccessLabel(false)).toBe("—");
    const calendar = DOCS_ROLE_ACCESS.find(
      (r) => r.feature === "Calendario de mantenimiento"
    );
    expect(calendar).toMatchObject({
      admin: true,
      tecnico: false,
      calidad: false,
    });
    const approve = DOCS_ROLE_ACCESS.find(
      (r) => r.feature === "Aprobar / rechazar revisiones"
    );
    expect(approve).toMatchObject({
      admin: false,
      tecnico: false,
      calidad: true,
    });
  });

  it("documents the calendar → tarea workflow steps", () => {
    expect(DOCS_CALENDAR_TO_TASK_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(DOCS_CALENDAR_TO_TASK_STEPS[0]?.title).toMatch(/evento/i);
  });
});
