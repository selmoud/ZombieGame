import { describe, expect, it } from "vitest";
import { formatSubgroups } from "../src/lib/subgroups";

describe("subgroup formatting", () => {
  it("shows all selected subgroups in alphabetical order", () => {
    expect(
      formatSubgroups([
        { subgroup: { name: "Развлечения" } },
        { subgroup: { name: "Авторский контент" } },
      ]),
    ).toBe("Авторский контент, Развлечения");
  });

  it("shows a dash when no subgroup is selected", () => {
    expect(formatSubgroups([])).toBe("—");
  });
});
