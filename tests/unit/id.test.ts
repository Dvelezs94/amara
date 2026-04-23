import { describe, expect, it } from "vitest";
import { createId } from "@/lib/id";

describe("createId", () => {
  it("returns a UUID-shaped string", () => {
    const id = createId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
