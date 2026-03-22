import { describe, expect, it } from "vitest";
import { formatCitation, parseCitations } from "./citations";

describe("citations", () => {
  it("parses unique citations from assistant text", () => {
    const result = parseCitations("结论见《Alpha.pdf》p.2，也可参考《Beta.pdf》p.7 和《Alpha.pdf》p.2。");
    expect(result).toEqual([
      { docName: "Alpha.pdf", pageNumber: 2 },
      { docName: "Beta.pdf", pageNumber: 7 }
    ]);
  });

  it("formats citations with stable output", () => {
    expect(formatCitation({ docName: "Gamma.pdf", pageNumber: 12 })).toBe("《Gamma.pdf》p.12");
  });
});
