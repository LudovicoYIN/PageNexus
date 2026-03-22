from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import fitz

from python.parse_pdf import parse_pdf


class ParsePdfTest(unittest.TestCase):
    def test_parse_pdf_writes_pages_and_fulltext(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir_name:
            tmp_dir = Path(tmp_dir_name)
            doc_dir = tmp_dir / "docs" / "doc-123"
            doc_dir.mkdir(parents=True)

            source_pdf = doc_dir / "source.pdf"
            pages_json = doc_dir / "pages.json"
            fulltext = doc_dir / "fulltext.txt"

            document = fitz.open()
            page_one = document.new_page()
            page_one.insert_text((72, 72), "Quantum mechanics overview")
            page_two = document.new_page()
            page_two.insert_text((72, 72), "Second page content")
            document.save(source_pdf)
            document.close()

            summary = parse_pdf(source_pdf, pages_json, fulltext)

            self.assertEqual(summary["page_count"], 2)
            self.assertTrue(pages_json.exists())
            self.assertTrue(fulltext.exists())

            payload = json.loads(pages_json.read_text(encoding="utf-8"))
            self.assertEqual(payload["docId"], "doc-123")
            self.assertEqual(payload["fileName"], "source.pdf")
            self.assertEqual(payload["pageCount"], 2)
            self.assertEqual(payload["pages"][0]["pageNumber"], 1)
            self.assertIn("Quantum mechanics overview", payload["pages"][0]["text"])

            fulltext_value = fulltext.read_text(encoding="utf-8")
            self.assertIn("--- 第 1 页 ---", fulltext_value)
            self.assertIn("Second page content", fulltext_value)


if __name__ == "__main__":
    unittest.main()
