"""Pack authentic numbered articles for random access by the encyclopedia record ID."""
import argparse
import json
import re
import struct
import zlib
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("destination", type=Path)
args = parser.parse_args()
articles = {}
with args.source.open(encoding="utf-8-sig") as source:
    for line in source:
        row = json.loads(line)
        if not re.fullmatch(r"F[0-9]{5}", row["id"]):
            raise ValueError("unexpected record ID")
        if row.get("text"):
            articles[int(row["id"][1:])] = zlib.compress(row["text"].encode("utf-8"), 9)
offset = 4 * (max(articles) + 2)
index = bytearray()
body = bytearray()
for number in range(max(articles) + 1):
    index.extend(struct.pack("<I", offset + len(body)))
    body.extend(articles.get(number, b""))
index.extend(struct.pack("<I", offset + len(body)))
args.destination.write_bytes(index + body)
print("articles", len(articles), "bytes", len(index) + len(body))
