import { describe, expect, it } from "vitest";
import { extractPageAnchorText, normalizeCitationDocName, resolveCitationDocId } from "./citation-nav";
import type { DocumentRecord } from "./types";

function mockDoc(id: string, fileName: string): DocumentRecord {
  return {
    id,
    kb_id: "kb-1",
    file_name: fileName,
    source_path: `/tmp/${fileName}`,
    page_count: 1,
    status: "parsed",
    error_message: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("citation-nav", () => {
  it("normalizes doc names", () => {
    expect(normalizeCitationDocName(" 海伦天麓（合同）.PDF ")).toBe("海伦天麓合同.pdf");
  });

  it("resolves exact and fuzzy doc name matches", () => {
    const docs = [
      mockDoc("doc-a", "海伦天麓2025-05-10-2026-05-09.pdf"),
      mockDoc("doc-b", "租赁补充协议.pdf"),
    ];

    expect(resolveCitationDocId("海伦天麓2025-05-10-2026-05-09.pdf", docs)).toBe("doc-a");
    expect(resolveCitationDocId("海伦天麓2025-05-10-2026-05", docs)).toBe("doc-a");
    expect(resolveCitationDocId("不存在的文档.pdf", docs)).toBeNull();
  });

  it("extracts stable anchor text from page body", () => {
    const text = "\n  \n短行\n这是一个足够长的句子用于定位锚点，并且后面还有内容。\n第二段";
    expect(extractPageAnchorText(text)).toBe("这是一个足够长的句子用于定位锚点，并且后面还有内容。");
    expect(extractPageAnchorText(" \n \n短\n", 20)).toBe("");
  });
});
