import { describe, expect, it } from "vitest";
import { sortAssigneeFilterUsers } from "../../lib/assignee-filter-users";

const ana = { id: "a", name: "Ana" };
const carlos = { id: "c", name: "Carlos" };
const beatriz = { id: "b", name: "Beatriz" };
const me = { id: "me", name: "Zulema" };

describe("sortAssigneeFilterUsers", () => {
  it("puts current user first, then others alphabetically", () => {
    expect(sortAssigneeFilterUsers([carlos, me, ana, beatriz], "me")).toEqual([
      me,
      ana,
      beatriz,
      carlos,
    ]);
  });

  it("sorts everyone alphabetically when current user is missing", () => {
    expect(sortAssigneeFilterUsers([carlos, ana, beatriz], null)).toEqual([
      ana,
      beatriz,
      carlos,
    ]);
    expect(sortAssigneeFilterUsers([carlos, ana], "unknown")).toEqual([ana, carlos]);
  });

  it("ignores case when sorting names", () => {
    const diego = { id: "d", name: "diego" };
    const Elena = { id: "e", name: "Elena" };
    expect(sortAssigneeFilterUsers([Elena, diego], "me")).toEqual([diego, Elena]);
  });
});
