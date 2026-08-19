import { describe, expect, it } from "vitest";
import { applyEnvFileContents } from "@/lib/load-local-env";

describe("applyEnvFileContents", () => {
  it("sets missing keys from KEY=VALUE lines", () => {
    const env: Record<string, string | undefined> = {};
    applyEnvFileContents("DATABASE_URL=postgresql://msa:msa@localhost:5432/msa\n", env);
    expect(env.DATABASE_URL).toBe("postgresql://msa:msa@localhost:5432/msa");
  });

  it("does not override keys that are already set", () => {
    const env: Record<string, string | undefined> = {
      DATABASE_URL: "postgresql://existing/db",
    };
    applyEnvFileContents("DATABASE_URL=postgresql://from-file/db\n", env);
    expect(env.DATABASE_URL).toBe("postgresql://existing/db");
  });

  it("ignores comments, blanks, and strips quotes", () => {
    const env: Record<string, string | undefined> = {};
    applyEnvFileContents(
      `# comment\n\nSESSION_SECRET="quoted-secret"\nNAME='single'\n`,
      env
    );
    expect(env.SESSION_SECRET).toBe("quoted-secret");
    expect(env.NAME).toBe("single");
  });
});
