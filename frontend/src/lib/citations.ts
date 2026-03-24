import type { SourceCitation } from "./types";

const CITATION_PATTERN = /《([^》]+)》\s*(?:p\s*\.?\s*(\d+)|第\s*(\d+)\s*页)/gi;

export function parseCitations(text: string): SourceCitation[] {
  const seen = new Set<string>();
  const citations: SourceCitation[] = [];

  for (const match of text.matchAll(CITATION_PATTERN)) {
    const docName = match[1]?.trim();
    const pageRaw = match[2] || match[3] || "";
    const pageNumber = Number.parseInt(pageRaw, 10);
    if (!docName || Number.isNaN(pageNumber)) continue;

    const key = `${docName}:${pageNumber}`;
    if (seen.has(key)) continue;

    seen.add(key);
    citations.push({ docName, pageNumber });
  }

  return citations;
}

export function formatCitation(citation: SourceCitation): string {
  return `《${citation.docName}》p.${citation.pageNumber}`;
}
