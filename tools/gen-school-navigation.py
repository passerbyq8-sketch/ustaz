"""Build exact predecessor/successor cursors from the read-only library index."""
import argparse
import json
import re
import sqlite3
import zlib
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("database", type=Path)
parser.add_argument("destination", type=Path)
args = parser.parse_args()
catalogue = Path(__file__).resolve().parents[1] / "lib/data/madhhab-catalog.js"
books = sorted(set(re.findall(r"FC-\d{6}", catalogue.read_text(encoding="utf8"))))
index = sqlite3.connect(args.database.resolve().as_uri() + "?mode=ro", uri=True)
index.row_factory = sqlite3.Row
manifest = {}
for book in books:
    spans = []
    first = None
    for row in index.execute("select atom_id from atom_rows where atom_id >= ? and atom_id < ? order by rowid", (book + ":", book + ";")):
        atom = row["atom_id"]
        _, section, number = atom.split(":")
        n = int(number)
        if spans and spans[-1][0] == section and spans[-1][2] + 1 == n:
            spans[-1][2] = n
        else:
            spans.append([section, n, n])
        if number != str(n).zfill(3):
            raise ValueError("unexpected atom numbering")
        if first is None:
            first = dict(index.execute("select atom_id, heading_path, book_title, author, volume, page_start, page_end, numbering, page_citable, text from atoms where atom_id=?", (atom,)).fetchone())
            if isinstance(first["text"], bytes):
                first["text"] = zlib.decompress(first["text"], -15).decode("utf8")
            first["subject_id"] = book
            first["page_citable"] = bool(first["page_citable"])
            try:
                first["heading_path"] = json.loads(first["heading_path"])
            except ValueError:
                first["heading_path"] = first["heading_path"].split(" > ")
    if spans:
        manifest[book] = dict(spans=spans, first=first)
args.destination.write_bytes(zlib.compress(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")).encode(), 9))
print("books", len(manifest), "bytes", args.destination.stat().st_size)
