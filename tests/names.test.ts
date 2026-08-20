import { describe, expect, it } from "vitest";
import { parseName, shortenRoster } from "../src/lib/names";

describe("student names", () => {
  it("keeps only the first name and one last letter", () => {
    expect(shortenRoster(["Avery Johnson"])).toEqual(["Avery J"]);
  });

  it("grows the last-name piece only where two students clash", () => {
    expect(shortenRoster(["Maya Chen", "Maya Cetin", "Sam Rivera"])).toEqual([
      "Maya Ch",
      "Maya Ce",
      "Sam R",
    ]);
  });

  it("stops at three letters", () => {
    expect(shortenRoster(["Maya Chandler", "Maya Chandra"])).toEqual([
      "Maya Cha",
      "Maya Cha",
    ]);
  });

  it("avoids clashing with students already in the class", () => {
    expect(shortenRoster(["Maya Chen"], ["Maya C"])).toEqual(["Maya Ch"]);
  });

  it("understands shouted and reversed spreadsheet names", () => {
    expect(parseName("JOHNSON, AVERY")).toEqual({
      first: "Avery",
      last: "Johnson",
    });
  });

  it("accepts a student with no last name", () => {
    expect(shortenRoster(["Jordan"])).toEqual(["Jordan"]);
  });
});
