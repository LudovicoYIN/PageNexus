#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import fitz


def clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_pdf(source_path: Path, pages_output_path: Path, fulltext_output_path: Path) -> dict[str, int]:
    document = fitz.open(source_path)
    pages: list[dict[str, object]] = []
    fulltext_parts: list[str] = []
    empty_pages = 0

    try:
        for index, page in enumerate(document, start=1):
            text = clean_text(page.get_text("text"))
            if not text:
                empty_pages += 1

            pages.append({"pageNumber": index, "text": text})
            fulltext_parts.append(f"--- 第 {index} 页 ---\n{text}")
    finally:
        document.close()

    pages_payload = {
        "docId": source_path.parent.name,
        "fileName": source_path.name,
        "pageCount": len(pages),
        "pages": pages,
    }

    pages_output_path.write_text(json.dumps(pages_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    fulltext_output_path.write_text("\n\n".join(fulltext_parts), encoding="utf-8")

    return {"page_count": len(pages), "empty_pages": empty_pages}


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: parse_pdf.py <source.pdf> <pages.json> <fulltext.txt>", file=sys.stderr)
        return 1

    source_path = Path(sys.argv[1]).expanduser().resolve()
    pages_output_path = Path(sys.argv[2]).expanduser().resolve()
    fulltext_output_path = Path(sys.argv[3]).expanduser().resolve()

    pages_output_path.parent.mkdir(parents=True, exist_ok=True)
    fulltext_output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        summary = parse_pdf(source_path, pages_output_path, fulltext_output_path)
    except Exception as exc:  # pragma: no cover - surfaced to Rust layer
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
