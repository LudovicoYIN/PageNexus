import type { DocumentRecord } from "./types";

export function normalizeCitationDocName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）\[\]【】]/g, "");
}

export function resolveCitationDocId(docName: string, docs: DocumentRecord[]): string | null {
  const target = normalizeCitationDocName(docName);
  const exact = docs.find((doc) => normalizeCitationDocName(doc.file_name) === target);
  if (exact) return exact.id;

  const fuzzy = docs.find((doc) => {
    const normalized = normalizeCitationDocName(doc.file_name);
    return normalized.includes(target) || target.includes(normalized);
  });
  return fuzzy?.id ?? null;
}

export function extractPageAnchorText(text: string, anchorMaxLength = 36): string {
  const preferredLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length >= 10);
  if (!preferredLine) return "";
  return preferredLine.slice(0, anchorMaxLength);
}
