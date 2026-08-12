#!/usr/bin/env python3
# -*- coding: ascii -*-
"""
build-madina-hafs-pages.py -- printed pages 1..604 of the Madina Hafs Mushaf,
taken straight out of the authorised PDF's page image objects.

WHAT THIS DOES, AND WHAT IT REFUSES TO DO
-----------------------------------------
It opens ONE authorised source file, checks its byte count and its SHA-256
against the pins below, and refuses to run on anything else. For each printed
page it reads the page's image XObject, inflates it, undoes the PNG predictor,
expands the palette indices, finds the central floral page frame, crops to it,
and encodes the crop as LOSSLESS WebP.

SESSION 80 -- WHY THE CROP CHANGED
----------------------------------
The first build kept the union bounding box of ALL ink. 252 of the 604 printed
sheets carry a detached juz/hizb/rub ornament sitting OUTSIDE the floral frame,
in the outer margin. Keeping those made those 252 crops 853px wide against 747
for everything else, so on a phone -- where the width is what fits -- those
pages rendered visibly smaller than their neighbours. The owner rejected that.

So the crop is now anchored on the printed frame instead of on the ink:

  * the central floral frame is found as the largest connected component of
    printed pixels, and it is required to be central and to span most of the
    sheet before it is believed;
  * the horizontal crop is that frame's bounding box plus a safety margin, so
    the detached side ornaments fall outside it and are dropped;
  * the vertical crop comes from the printed content that REMAINS inside that
    horizontal envelope -- which is what keeps the surah/juz metadata above the
    frame and the printed page number below it;
  * every component is checked against the crop edge first: if any component
    were to be cut rather than either wholly kept or wholly dropped, the page
    fails and nothing is written.

Nothing inside the frame is touched, nothing is redrawn, and the only printed
marks that leave are the detached side ornaments in the outer margin.

UNIFORM GEOMETRY
----------------
The reader now stretches each page into the whole reading viewport, so the
frame's SHARE of the output image is what decides how big the frame looks. The
vertical crop is therefore taken as the union across every page that shares a
frame geometry, not per page: each of those pages then gets an identical crop
rectangle, the frame occupies an identical percentage of each of them, and no
page can render smaller than another. A union can only ever keep more, so this
costs nothing in printed content.

There is no OCR, no screenshot, no re-render, no resampling, no upscale, no
sharpening, no recolouring and no text extraction anywhere in this file. The
only pixels written out are pixels that were read in. Nothing decodes glyphs,
so no Quran text can pass through this program, and every byte it prints is
ASCII.

The WebP encoder is the one inside Chrome, driven headless over a canvas, which
is the same encoder the approved two-page prototype used -- that is why pages 1
and 77 come back byte-identical. Every page is round-tripped before it is
accepted: the encoded file is decoded again and compared with the source pixels
sample by sample, and a single differing sample fails the page.

USAGE
-----
    python tools/build-madina-hafs-pages.py --verify-mapping
    python tools/build-madina-hafs-pages.py --analyse
    python tools/build-madina-hafs-pages.py --build

    --pdf PATH      source PDF (default: %TEMP%/madina-proto/mushaf.pdf)
    --work PATH     scratch directory OUTSIDE the repository
    --chrome PATH   chrome.exe
    --pages A-B     restrict the run (the manifest is only written for 1-604)
    --batch N       pages per Chrome invocation
    --resume        keep page assets already encoded and verified
    --analyse       measure every page and report; write NOTHING

    --expect-side-marker-pages N
                    how many sheets must carry a detached side ornament. The
                    build measures the real number first and REFUSES to touch a
                    single existing asset unless the two agree. Defaults to the
                    pinned EXPECTED_SIDE_MARKER_PAGES; pass the measured number
                    explicitly to authorise a build after reviewing --analyse.

Exit 0 = every page built and verified. Exit 1 = something failed.
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import zlib

# ---------------------------------------------------------------------------
# Pins. None of these are guesses: they are the approved source and the two
# approved outputs, and the build stops if any of them moves.
# ---------------------------------------------------------------------------
SOURCE_BYTES = 65008727
SOURCE_SHA256 = '2f0b03925568fca326f47a5ec756df2c3eecc8b29f75471f3a0815a5a3e58d28'
SOURCE_ITEM = 'https://archive.org/details/MushafMadinaHafsGreen1441'
SOURCE_URL = 'https://archive.org/download/MushafMadinaHafsGreen1441/MushafMadinaHafsGreen1441.pdf'

# Page 1 was approved by eye and is UNCHANGED by the session-80 correction: it is one
# of the two ornate opening sheets, its frame is the outermost printed thing on the
# sheet, and it carries no detached side ornament, so the frame-anchored crop lands on
# exactly the same rectangle the ink-anchored crop did.
#
# Page 77 was approved by eye too, and it is NOT pinned any more. It is one of the 252
# sheets that carries a detached side ornament, so this correction is required to change
# it -- that is the whole point of the session. Pinning its old bytes would pin the
# defect. Its new bytes are recorded in the manifest and checked there instead.
APPROVED = {
    1: '2d914c1e80eb5bd190b83bb4ab9983d925a0353e884d5df5e4ec8e95c80ce6eb',
}
SUPERSEDED = {
    77: 'd1ff9f43378690b2b5710350ba01adabdf25a138b054dd16247a7dc12a59964c',
}

FIRST_PAGE = 1
LAST_PAGE = 604
PDF_OFFSET = 3            # pdfIndex = printedPage + 3
PDF_PAGE_COUNT = 640
SOURCE_W = 957
SOURCE_H = 1368
WHITE_THRESHOLD = 245     # a pixel is printed content if ANY channel is below this
SAFETY_MARGIN = 6         # px of guaranteed white kept outside the measured frame

# How many sheets are expected to carry a detached side ornament. This is a GATE, not a
# label: the build measures the real number and stops before writing anything if the two
# disagree, so a detector that started finding the wrong thing cannot quietly rewrite 604
# approved assets. Override with --expect-side-marker-pages once the number is reviewed.
EXPECTED_SIDE_MARKER_PAGES = 252

# What the largest connected component has to look like before it is accepted as the
# printed floral frame rather than as, say, a merged block of text.
MIN_FRAME_WIDTH_FRACTION = 0.70
MIN_FRAME_HEIGHT_FRACTION = 0.70

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSET_DIR = os.path.join(ROOT, 'assets', 'madina-hafs')
MANIFEST = os.path.join(ROOT, 'data', 'madina-hafs-pages.json')
ASSET_REL = 'assets/madina-hafs/page-%03d.webp'


def log(msg):
    """Every line this program prints is ASCII, by construction."""
    sys.stdout.write(msg.encode('ascii', 'replace').decode('ascii') + '\n')
    sys.stdout.flush()


# ===========================================================================
# 1) THE PDF -- a small read-only reader. Classic xref table, FlateDecode,
#    indexed images. No third-party modules, and nothing here executes or
#    renders anything: it only locates and inflates streams.
# ===========================================================================
class Pdf(object):
    def __init__(self, path):
        with open(path, 'rb') as fh:
            self.buf = fh.read()
        self.path = path
        self.text = self.buf.decode('latin-1')
        self.off = {}
        s = self.text
        m = re.search(r'startxref\s+(\d+)\s*%%EOF\s*$', s[-300:])
        self.trailer = self._xref(int(m.group(1)) if m else 216, set())
        root = re.search(r'/Root\s+(\d+)\s+\d+\s+R', self.trailer)
        if not root:
            raise ValueError('no /Root in the trailer')
        self.root = int(root.group(1))
        self.catalog = self.dict_of(self.root)
        pages = re.search(r'/Pages\s+(\d+)\s+\d+\s+R', self.catalog)
        if not pages:
            raise ValueError('no /Pages in the catalog')
        self.order = self._page_order(int(pages.group(1)))

    # -- cross reference ----------------------------------------------------
    def _xref(self, pos, seen):
        if pos in seen:
            return None
        seen.add(pos)
        s = self.text
        if s[pos:pos + 4] != 'xref':
            raise ValueError('not an xref table at %d' % pos)
        i = pos + 4
        while True:
            while s[i] in '\r\n ':
                i += 1
            if s[i:i + 7] == 'trailer':
                break
            m = re.match(r'(\d+)\s+(\d+)\s*', s[i:i + 40])
            if not m:
                raise ValueError('bad xref subsection at %d' % i)
            start, count = int(m.group(1)), int(m.group(2))
            i += m.end()
            for k in range(count):
                em = re.match(r'(\d{10})\s(\d{5})\s([nf])', s[i:i + 20])
                if not em:
                    raise ValueError('bad xref entry at %d' % i)
                if em.group(3) == 'n' and (start + k) not in self.off:
                    self.off[start + k] = int(em.group(1))
                i += 20
        trailer = s[i:s.index('>>', i) + 2]
        prev = re.search(r'/Prev\s+(\d+)', trailer)
        if prev:
            self._xref(int(prev.group(1)), seen)
        return trailer

    # -- objects ------------------------------------------------------------
    def _object(self, n):
        p = self.off.get(n)
        if p is None:
            raise ValueError('no xref entry for object %d' % n)
        s = self.text
        head = re.match(r'\s*(\d+)\s+(\d+)\s+obj', s[p:p + 48])
        if not head or int(head.group(1)) != n:
            raise ValueError('object header mismatch for %d' % n)
        start = p + head.end()
        st = s.find('stream', start)
        eo = s.find('endobj', start)
        if 0 <= st < eo:
            k = st + 6
            if s[k] == '\r':
                k += 1
            if s[k] == '\n':
                k += 1
            return s[start:st].strip(), k
        return s[start:eo].strip(), None

    def dict_of(self, n):
        return self._object(n)[0]

    def stream_of(self, n):
        d, start = self._object(n)
        length = num(d, 'Length')
        if length is None:
            r = ref(d, 'Length')
            if r is not None:
                length = float(self.dict_of(r))
        return d, self.buf[start:start + int(length)]

    def _page_order(self, root):
        out = []

        def walk(n):
            d = self.dict_of(n)
            if re.search(r'/Type\s*/Pages', d):
                m = re.search(r'/Kids\s*\[([\s\S]*?)\]', d)
                kids = re.findall(r'(\d+)\s+\d+\s+R', m.group(1)) if m else []
                for k in kids:
                    walk(int(k))
            else:
                out.append(n)

        walk(root)
        return out


def num(d, key):
    m = re.search(r'/' + key + r'[ ]+(-?[0-9.]+)', d)
    return float(m.group(1)) if m else None


def ref(d, key):
    m = re.search(r'/' + key + r'[ ]+(\d+)[ ]+\d+[ ]+R', d)
    return int(m.group(1)) if m else None


def pdf_literal_string(src):
    """A PDF literal string starting at src[0] == '(' -> its bytes."""
    out = bytearray()
    depth = 0
    i = 0
    while i < len(src):
        c = src[i]
        if c == '\\':
            i += 1
            n = src[i]
            if n in '01234567':
                oct_digits = n
                while len(oct_digits) < 3 and src[i + 1] in '01234567':
                    i += 1
                    oct_digits += src[i]
                out.append(int(oct_digits, 8) & 255)
            elif n == 'n':
                out.append(10)
            elif n == 'r':
                out.append(13)
            elif n == 't':
                out.append(9)
            elif n == 'b':
                out.append(8)
            elif n == 'f':
                out.append(12)
            elif n == '\n':
                pass                      # line continuation
            else:
                out.append(ord(n) & 255)
            i += 1
            continue
        if c == '(':
            depth += 1
            if depth == 1:
                i += 1
                continue
        if c == ')':
            depth -= 1
            if depth == 0:
                break
        out.append(ord(c) & 255)
        i += 1
    return bytes(out)


# ===========================================================================
# 2) THE RASTER -- inflate, un-predict, and hand back one palette index per
#    pixel. Everything below is byte work at C speed: the per-pixel loops that
#    a 1.3 megapixel page would need are replaced by translate/slice, so no
#    pixel is ever touched by an interpreted expression.
# ===========================================================================
_NIBBLE_MAP = str.maketrans('0123456789abcdef', ''.join(chr(i) for i in range(16)))


def _add_mod256(a, b):
    """Byte-wise (a + b) mod 256 without a Python-level loop.

    Each byte is widened into its own 16-bit lane, so the two additions cannot
    carry into one another, and the low byte of every lane is the answer.
    """
    n = len(a)
    wa = bytearray(2 * n)
    wa[0::2] = a
    wb = bytearray(2 * n)
    wb[0::2] = b
    total = int.from_bytes(wa, 'little') + int.from_bytes(wb, 'little')
    return total.to_bytes(2 * n + 2, 'little')[0:2 * n:2]


def _unfilter_sequential(ft, row, prev, bpp):
    """Sub / Average / Paeth: each byte depends on the byte before it."""
    cur = bytearray(row)
    n = len(cur)
    if ft == 1:
        for x in range(bpp, n):
            cur[x] = (cur[x] + cur[x - bpp]) & 255
    elif ft == 3:
        for x in range(n):
            a = cur[x - bpp] if x >= bpp else 0
            cur[x] = (cur[x] + ((a + prev[x]) >> 1)) & 255
    elif ft == 4:
        for x in range(n):
            a = cur[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            p = a + b - c
            pa = abs(p - a)
            pb = abs(p - b)
            pc = abs(p - c)
            if pa <= pb and pa <= pc:
                pr = a
            elif pb <= pc:
                pr = b
            else:
                pr = c
            cur[x] = (cur[x] + pr) & 255
    else:
        raise ValueError('unsupported PNG filter type %r' % ft)
    return bytes(cur)


def page_raster(pdf, pdf_index):
    """One PDF page -> {w, h, palette, rows}: rows are one byte per pixel."""
    page_obj = pdf.order[pdf_index - 1]
    pd = pdf.dict_of(page_obj)
    m = re.search(r'/XObject\s*<<\s*/\w+\s+(\d+)\s+\d+\s+R', pd)
    if not m:
        raise ValueError('PDF page %d has no image XObject' % pdf_index)
    img_obj = int(m.group(1))
    d, data = pdf.stream_of(img_obj)

    w = int(num(d, 'Width'))
    h = int(num(d, 'Height'))
    bpc = int(num(d, 'BitsPerComponent'))
    if not re.search(r'/Filter\s*/FlateDecode', d):
        raise ValueError('PDF page %d: unexpected image filter' % pdf_index)

    cs = re.search(r'/Indexed\s*/DeviceRGB\s+\d+\s*', d)
    if not cs:
        raise ValueError('PDF page %d: unexpected colour space' % pdf_index)
    after = d[cs.end():]
    if after[0] == '<':
        palette = bytes.fromhex(after[1:after.index('>')])
    elif after[0] == '(':
        palette = pdf_literal_string(after)
    else:
        raise ValueError('PDF page %d: unreadable palette' % pdf_index)

    raw = zlib.decompress(data)
    predictor = num(d, 'Predictor')
    columns = int(num(d, 'Columns') or w)
    colors = int(num(d, 'Colors') or 1)
    row_bytes = (columns * colors * bpc + 7) // 8

    rows = []
    if predictor and predictor >= 10:
        bpp = max(1, (colors * bpc + 7) // 8)
        stride = row_bytes + 1
        blank = bytes(row_bytes)
        prev = blank
        pos = 0
        for _ in range(h):
            ft = raw[pos]
            row = raw[pos + 1:pos + stride]
            pos += stride
            if ft == 0:
                cur = row
            elif ft == 2:
                cur = _add_mod256(row, prev) if prev is not blank else row
            else:
                cur = _unfilter_sequential(ft, row, prev, bpp)
            rows.append(cur)
            prev = cur
    else:
        for y in range(h):
            rows.append(raw[y * row_bytes:(y + 1) * row_bytes])

    # one palette index per pixel, whatever the packing was
    if bpc == 4:
        rows = [r.hex().translate(_NIBBLE_MAP).encode('latin-1')[:w] for r in rows]
    elif bpc == 8:
        rows = [r[:w] for r in rows]
    else:
        raise ValueError('PDF page %d: unsupported BitsPerComponent %d' % (pdf_index, bpc))

    return {'w': w, 'h': h, 'bpc': bpc, 'palette': palette, 'rows': rows,
            'imgObj': img_obj, 'pageObj': page_obj}


def palette_tables(palette):
    """(ink mask table, R table, G table, B table) for 256 palette indices.

    An index the palette does not define reads as 0,0,0 -- black, therefore
    printed content. That is deliberate: an undefined index must never be
    mistaken for margin and trimmed away.
    """
    ink = bytearray(256)
    tr = bytearray(256)
    tg = bytearray(256)
    tb = bytearray(256)
    for i in range(256):
        o = i * 3
        if o + 2 < len(palette):
            r, g, b = palette[o], palette[o + 1], palette[o + 2]
        else:
            r = g = b = 0
        tr[i], tg[i], tb[i] = r, g, b
        if r < WHITE_THRESHOLD or g < WHITE_THRESHOLD or b < WHITE_THRESHOLD:
            ink[i] = 1
    return bytes(ink), bytes(tr), bytes(tg), bytes(tb)


# ===========================================================================
# 3) THE FRAME, THE SIDE ORNAMENTS, AND THE CROP
#
#    Everything here works on ONE bit per pixel -- printed or not printed -- and
#    on whole connected shapes. It never asks what a shape says. It cannot: it
#    only ever sees pixel counts and bounding boxes, so no glyph is identified
#    and no text can be read out of this file.
# ===========================================================================
def ink_mask(raster):
    """The page as one byte per pixel: 1 = printed, 0 = near-white."""
    ink_tbl, tr, tg, tb = palette_tables(raster['palette'])
    return [row.translate(ink_tbl) for row in raster['rows']], tr, tg, tb


def components(mask, w, h):
    """8-connected components of the printed pixels.

    Row runs plus union-find, because a page is 1.3 megapixels and a per-pixel
    Python loop is not affordable 604 times over. bytes.find does the run
    scanning at C speed, and consecutive rows are merged with a two-pointer
    walk, so the whole page costs about as much as reading it did.

    Returns [pixels, x0, y0, x1, y1] per component.
    """
    parent = []

    def find(a):
        root = a
        while parent[root] != root:
            root = parent[root]
        while parent[a] != root:              # path compression
            parent[a], a = root, parent[a]
        return root

    rows_runs = []
    prev = []
    for y in range(h):
        t = mask[y]
        runs = []
        i = t.find(1)
        while i >= 0:
            end = t.find(0, i)
            if end < 0:
                end = w
            label = len(parent)
            parent.append(label)
            runs.append((i, end - 1, label))
            i = t.find(1, end)
        # merge with the row above; both lists are sorted, so one walk does it
        a_i = b_i = 0
        while a_i < len(runs) and b_i < len(prev):
            a0, a1, al = runs[a_i]
            b0, b1, bl = prev[b_i]
            if b1 >= a0 - 1 and b0 <= a1 + 1:      # touching, corners included
                ra, rb = find(al), find(bl)
                if ra != rb:
                    parent[max(ra, rb)] = min(ra, rb)
            if a1 < b1:
                a_i += 1
            else:
                b_i += 1
        rows_runs.append(runs)
        prev = runs

    boxes = {}
    for y in range(h):
        for (a, b, label) in rows_runs[y]:
            root = find(label)
            box = boxes.get(root)
            if box is None:
                boxes[root] = [b - a + 1, a, y, b, y]
            else:
                box[0] += b - a + 1
                if a < box[1]:
                    box[1] = a
                if b > box[3]:
                    box[3] = b
                box[4] = y
    return list(boxes.values())


def box_ink(mask, x0, x1, y0, y1):
    """Printed pixels inside a rectangle, and their bounding box."""
    total = 0
    bx0, by0, bx1, by1 = x1 + 1, y1 + 1, -1, -1
    for y in range(y0, y1 + 1):
        seg = mask[y][x0:x1 + 1]
        n = seg.count(1)
        if not n:
            continue
        total += n
        i = seg.find(1)
        j = seg.rfind(1)
        if x0 + i < bx0:
            bx0 = x0 + i
        if x0 + j > bx1:
            bx1 = x0 + j
        if y < by0:
            by0 = y
        by1 = y
    if bx1 < 0:
        return 0, None
    return total, {'x0': bx0, 'y0': by0, 'x1': bx1, 'y1': by1}


def analyse_page(raster, printed):
    """Measure one page. Writes nothing and decides no crop height yet.

    The vertical crop cannot be settled page by page -- it has to be the same
    for every page that shares a frame geometry, or the frame ends up occupying
    a different share of different pages. So this returns the measurements and
    plan_crops() below settles the height across the whole run.
    """
    w, h = raster['w'], raster['h']
    mask, tr, tg, tb = ink_mask(raster)
    comps = components(mask, w, h)
    if not comps:
        raise ValueError('page %d carries no printed pixel at all' % printed)

    # -- the central floral frame: the biggest printed shape on the sheet, and
    #    it has to actually look like a frame before it is believed.
    comps.sort(key=lambda c: -c[0])
    frame = comps[0]
    fpx, fx0, fy0, fx1, fy1 = frame
    fw = fx1 - fx0 + 1
    fh = fy1 - fy0 + 1
    if fw < MIN_FRAME_WIDTH_FRACTION * w or fh < MIN_FRAME_HEIGHT_FRACTION * h:
        raise ValueError('page %d: the largest printed shape is %dx%d, too small to be the '
                         'page frame' % (printed, fw, fh))
    if not (fx0 < w // 2 < fx1 and fy0 < h // 2 < fy1):
        raise ValueError('page %d: the largest printed shape does not enclose the centre of '
                         'the sheet' % printed)

    # -- the horizontal envelope: the frame plus a margin of guaranteed white.
    ex0 = max(0, fx0 - SAFETY_MARGIN)
    ex1 = min(w - 1, fx1 + SAFETY_MARGIN)

    # -- every OTHER shape is either wholly inside that envelope or wholly
    #    outside it. A shape that crossed the edge would be cut in half by the
    #    crop, so it is a hard failure rather than a judgement call.
    outside = []
    for c in comps[1:]:
        if c[3] < ex0 or c[1] > ex1:
            outside.append(c)
        elif c[1] < ex0 or c[3] > ex1:
            raise ValueError('page %d: a printed shape at x %d-%d crosses the crop edge '
                             '(%d..%d); it would be cut, so nothing was written'
                             % (printed, c[1], c[3], ex0, ex1))

    # -- the ornaments that leave, counted from the pixels rather than from the
    #    shape list, and then required to agree with the shape list. Two
    #    independent counts of the same thing.
    removed = 0
    for y in range(h):
        t = mask[y]
        if ex0:
            removed += t[:ex0].count(1)
        if ex1 < w - 1:
            removed += t[ex1 + 1:].count(1)
    if removed != sum(c[0] for c in outside):
        raise ValueError('page %d: %d printed pixels sit outside the crop but the detached '
                         'shapes only account for %d' % (printed, removed, sum(c[0] for c in outside)))

    # -- what stays, and where it reaches. This is what fixes the vertical crop,
    #    and it is measured INSIDE the envelope so that a side ornament can
    #    never stretch the page it was removed from.
    kept, kept_box = box_ink(mask, ex0, ex1, 0, h - 1)
    if kept_box is None:
        raise ValueError('page %d: nothing is left inside the page frame' % printed)

    # -- the two bands the owner asked for by name: whatever is printed above
    #    the frame (surah name and juz metadata) and below it (the page number).
    _, top_box = box_ink(mask, ex0, ex1, 0, fy0 - 1) if fy0 > 0 else (0, None)
    _, bot_box = box_ink(mask, ex0, ex1, fy1 + 1, h - 1) if fy1 < h - 1 else (0, None)

    return {
        'printed': printed, 'w': w, 'h': h,
        'mask': mask, 'rows': raster['rows'], 'rgb_tables': (tr, tg, tb),
        'frame': {'x0': fx0, 'y0': fy0, 'x1': fx1, 'y1': fy1, 'pixels': fpx},
        'envelope': (ex0, ex1),
        'keptBox': kept_box, 'keptPixels': kept,
        'topMetadataBox': top_box, 'pageNumberBox': bot_box,
        'sideMarkerPresent': bool(outside),
        'sideMarkerShapes': len(outside),
        'sideMarkerPixelsRemoved': removed,
        'sideMarkerBox': None if not outside else {
            'x0': min(c[1] for c in outside), 'y0': min(c[2] for c in outside),
            'x1': max(c[3] for c in outside), 'y1': max(c[4] for c in outside)},
        'totalInk': kept + removed,
    }


def light(measure):
    """The same measurement without its two megabyte-sized rasters.

    The survey pass has to hold all 604 measurements at once to settle the
    group heights, and 604 live page rasters would be about a gigabyte. The
    pixels are re-read in the build pass instead, which costs milliseconds.
    """
    return dict((k, v) for k, v in measure.items() if k not in ('mask', 'rows', 'rgb_tables'))


def plan_crops(measures):
    """Settle one crop rectangle per frame geometry, across the whole run.

    Pages are grouped by the vertical extent of their printed frame. Within a
    group the vertical crop is the UNION of every page's retained content plus
    the safety margin, so all of them come out exactly the same height and the
    frame occupies exactly the same percentage of each. A union only ever keeps
    more than a per-page box would, so this cannot cost printed content.

    The Mushaf's two ornate opening sheets have a frame of their own geometry
    and fall into their own group automatically -- they are not special-cased.
    """
    groups = {}
    for m in measures:
        key = (m['frame']['y0'], m['frame']['y1'])
        groups.setdefault(key, []).append(m)

    plans = {}
    for key, members in groups.items():
        top = min(m['keptBox']['y0'] for m in members)
        bottom = max(m['keptBox']['y1'] for m in members)
        cy0 = max(0, top - SAFETY_MARGIN)
        cy1 = min(min(m['h'] for m in members) - 1, bottom + SAFETY_MARGIN)
        for m in members:
            ex0, ex1 = m['envelope']
            plans[m['printed']] = {
                'x': ex0, 'y': cy0, 'w': ex1 - ex0 + 1, 'h': cy1 - cy0 + 1,
                'group': '%d-%d' % key, 'groupPages': len(members),
            }
    return plans, groups


def render_crop(measure, crop):
    """Cut the planned rectangle out of the page, and prove what it dropped.

    Nothing is scaled, filtered or recoloured: each output sample is the exact
    palette entry of the source pixel it came from.
    """
    mask = measure['mask']
    tr, tg, tb = measure['rgb_tables']
    w, h = measure['w'], measure['h']
    cx0, cy0 = crop['x'], crop['y']
    cx1, cy1 = cx0 + crop['w'] - 1, cy0 + crop['h'] - 1

    # Protected content is everything printed that is NOT a detached side
    # ornament, i.e. everything inside the horizontal envelope. Counting what
    # the crop drops of it is the proof that the frame, the metadata and the
    # page number all survived -- and it has to come out zero.
    ex0, ex1 = measure['envelope']
    discarded = 0
    for y in range(h):
        if y < cy0 or y > cy1:
            discarded += mask[y][ex0:ex1 + 1].count(1)
    if cx0 > ex0:
        discarded += box_ink(mask, ex0, cx0 - 1, max(0, cy0), min(h - 1, cy1))[0]
    if cx1 < ex1:
        discarded += box_ink(mask, cx1 + 1, ex1, max(0, cy0), min(h - 1, cy1))[0]

    rows = measure['rows']
    cw, ch = crop['w'], crop['h']
    rgb = bytearray(cw * ch * 3)
    line = cw * 3
    for y in range(cy0, cy1 + 1):
        src = rows[y][cx0:cx1 + 1]
        seg = bytearray(line)
        seg[0::3] = src.translate(tr)
        seg[1::3] = src.translate(tg)
        seg[2::3] = src.translate(tb)
        o = (y - cy0) * line
        rgb[o:o + line] = seg
    return discarded, bytes(rgb)


def write_png(path, w, h, rgb):
    """8-bit truecolour PNG. An intermediate for the encoder, never shipped."""
    stride = w * 3
    raw = bytearray((stride + 1) * h)
    for y in range(h):
        o = y * (stride + 1)
        raw[o] = 0
        raw[o + 1:o + 1 + stride] = rgb[y * stride:(y + 1) * stride]
    idat = zlib.compress(bytes(raw), 6)

    def chunk(kind, body):
        out = kind + body
        return len(body).to_bytes(4, 'big') + out + (zlib.crc32(out) & 0xffffffff).to_bytes(4, 'big')

    ihdr = w.to_bytes(4, 'big') + h.to_bytes(4, 'big') + bytes([8, 2, 0, 0, 0])
    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))


# ===========================================================================
# 4) LOSSLESS WebP -- Chrome's encoder, driven headless, with the round trip
#    done inside the page: what comes back out is decoded again and compared
#    against the source pixels sample by sample before this program will keep
#    it. The comparison is on numbers in a canvas, never on anything readable.
# ===========================================================================
ENCODE_JS = r"""
<!doctype html><meta charset="utf-8"><body><pre id="out">PENDING</pre>
<script>
const JOBS = __JOBS__;
const results = [];
const load = (src) => new Promise((res, rej) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = () => rej(new Error('decode failed'));
  im.src = src;
});
(async () => {
  for (const job of JOBS) {
    try {
      const img = await load('data:image/png;base64,' + job.png);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const a = g.getImageData(0, 0, c.width, c.height).data;
      const url = c.toDataURL('image/webp', 1.0);
      const back = await load(url);
      const c2 = document.createElement('canvas');
      c2.width = back.naturalWidth; c2.height = back.naturalHeight;
      const g2 = c2.getContext('2d', { willReadFrequently: true });
      g2.drawImage(back, 0, 0);
      const b = g2.getImageData(0, 0, c2.width, c2.height).data;
      let diff = 0, worst = 0;
      for (let i = 0; i < a.length; i++) {
        const d = Math.abs(a[i] - b[i]);
        if (d) { diff++; if (d > worst) worst = d; }
      }
      results.push({ page: job.page, w: c.width, h: c.height, w2: c2.width, h2: c2.height,
        mime: url.slice(5, url.indexOf(';')), diff: diff, worst: worst,
        data: url.slice(url.indexOf(',') + 1) });
      c.width = c.height = c2.width = c2.height = 0;
    } catch (e) {
      results.push({ page: job.page, error: String(e && e.message || e) });
    }
  }
  document.getElementById('out').textContent = JSON.stringify(results);
})();
</script></body>
"""


def chrome_encode(chrome, work, jobs):
    """jobs: [{page, pngPath}] -> {page: result}. One Chrome run for the batch."""
    payload = []
    for j in jobs:
        with open(j['pngPath'], 'rb') as fh:
            import base64
            payload.append({'page': j['page'], 'png': base64.b64encode(fh.read()).decode('ascii')})
    html = ENCODE_JS.replace('__JOBS__', json.dumps(payload))
    html_path = os.path.join(work, 'encode-batch.html')
    with open(html_path, 'w', encoding='ascii') as fh:
        fh.write(html)

    out = subprocess.run(
        [chrome, '--headless', '--disable-gpu', '--no-first-run',
         '--no-default-browser-check', '--disable-extensions',
         '--user-data-dir=' + os.path.join(work, 'chrome-profile'),
         '--virtual-time-budget=600000', '--dump-dom',
         'file:///' + html_path.replace('\\', '/')],
        capture_output=True, text=True, encoding='utf-8', errors='replace')
    m = re.search(r'<pre id="out">([\s\S]*?)</pre>', out.stdout or '')
    if not m:
        raise RuntimeError('Chrome produced no output element')
    if m.group(1) == 'PENDING':
        raise RuntimeError('Chrome did not finish the batch')
    body = m.group(1).replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    return dict((r['page'], r) for r in json.loads(body))


def webp_chunks(data):
    """Walk the RIFF chunk list without decoding a single pixel."""
    if data[0:4] != b'RIFF' or data[8:12] != b'WEBP':
        raise ValueError('not a RIFF/WEBP container')
    chunks = []
    p = 12
    while p + 8 <= len(data):
        kind = data[p:p + 4].decode('latin-1')
        length = int.from_bytes(data[p + 4:p + 8], 'little')
        chunks.append(kind)
        p += 8 + length + (length & 1)
    return chunks


# ===========================================================================
# 5) THE MAPPING -- revalidated, not assumed, and revalidated WITHOUT reading
#    a single glyph.
#
#    Two independent lines of evidence, and they have to agree:
#
#    (a) The PDF's own page label tree. The catalog numbers the first three
#        leaves with letters and then restarts as decimal 1 at the fourth, so
#        the PDF itself states that printed page N is PDF index N + 3.
#
#    (b) The printed folio number, counted rather than read. The digits sit in
#        a band of their own below the frame. This counts how many separate ink
#        blobs that band holds -- one blob per digit -- and requires the count
#        to be the digit count of the printed number the mapping predicts. A
#        wrong offset shows up immediately at the 9/10 and 99/100 boundaries,
#        where the blob count has to step from 1 to 2 and from 2 to 3.
#
#    Counting blobs is not OCR: it never decides WHICH digit it is looking at,
#    only how many marks are present.
# ===========================================================================
def folio_blob_count(raster):
    """Number of separate ink marks in the page's bottom folio band."""
    ink_tbl, _, _, _ = palette_tables(raster['palette'])
    w, h = raster['w'], raster['h']
    mask = [row.translate(ink_tbl) for row in raster['rows']]
    rows_with_ink = [y for y in range(h) if mask[y].find(1) >= 0]
    if not rows_with_ink:
        return 0, None
    bottom = rows_with_ink[-1]

    # Walk up from the last inked row to the gap that separates the folio band
    # from the frame above it.
    y = bottom
    while y > 0 and mask[y].find(1) >= 0:
        y -= 1
    band_top = y + 1
    gap = 0
    while y > 0 and mask[y].find(1) < 0:
        y -= 1
        gap += 1
    if gap < 3:
        return -1, None            # no clean band: caller treats this as unknown

    cols = bytearray(w)
    for yy in range(band_top, bottom + 1):
        t = mask[yy]
        i = t.find(1)
        while i >= 0:
            cols[i] = 1
            i = t.find(1, i + 1)

    blobs = 0
    run = 0
    for x in range(w):
        if cols[x]:
            run += 1
        else:
            if 0 < run:
                blobs += 1
            run = 0
    if run:
        blobs += 1
    return blobs, (band_top, bottom)


def verify_mapping(pdf, samples):
    log('PAGE MAPPING CHECK')
    ok = True

    if len(pdf.order) != PDF_PAGE_COUNT:
        log('  [FAIL] the PDF holds %d pages, expected %d' % (len(pdf.order), PDF_PAGE_COUNT))
        ok = False
    else:
        log('  [PASS] the PDF holds %d pages' % PDF_PAGE_COUNT)

    # (a) the PDF's own page labels
    nums = re.search(r'/PageLabels\s*<<\s*/Nums\s*\[([^\]]*)\]', pdf.catalog)
    if not nums:
        log('  [FAIL] the catalog carries no /PageLabels tree')
        ok = False
    else:
        entries = re.findall(r'(\d+)\s+(\d+)\s+\d+\s+R', nums.group(1))
        decimal_at = None
        for start, obj in entries:
            d = pdf.dict_of(int(obj))
            if re.search(r'/S\s*/D', d):
                st = num(d, 'St')
                if decimal_at is None:
                    decimal_at = (int(start), 1 if st is None else int(st))
        if decimal_at is None:
            log('  [FAIL] no decimal range in the page label tree')
            ok = False
        else:
            zero_based, first_label = decimal_at
            offset = zero_based + 1 - first_label
            if offset == PDF_OFFSET:
                log('  [PASS] page labels: decimal numbering starts at label %d on PDF index %d, '
                    'so pdfIndex = printedPage + %d' % (first_label, zero_based + 1, offset))
            else:
                log('  [FAIL] page labels imply an offset of %d, not %d' % (offset, PDF_OFFSET))
                ok = False

    # (b) the printed folio numbers, counted
    log('  folio marks (blob count must equal the digit count of the printed number):')
    for printed in samples:
        idx = printed + PDF_OFFSET
        if idx > len(pdf.order):
            log('  [FAIL] printed page %d maps to PDF index %d, past the end of the file' % (printed, idx))
            ok = False
            continue
        raster = page_raster(pdf, idx)
        if raster['w'] != SOURCE_W or raster['h'] != SOURCE_H:
            log('  [FAIL] printed %d (pdfIndex %d) is %dx%d, not %dx%d'
                % (printed, idx, raster['w'], raster['h'], SOURCE_W, SOURCE_H))
            ok = False
            continue
        blobs, band = folio_blob_count(raster)
        want = len(str(printed))
        if blobs == want:
            log('    [PASS] printed %3d = pdfIndex %3d  %dx%d  folio marks %d (band rows %d-%d)'
                % (printed, idx, raster['w'], raster['h'], blobs, band[0], band[1]))
        elif blobs == -1:
            log('    [INFO] printed %3d = pdfIndex %3d  %dx%d  no separated folio band '
                '(ornate page, no printed folio number)' % (printed, idx, raster['w'], raster['h']))
        else:
            log('    [FAIL] printed %3d = pdfIndex %3d  folio marks %d, expected %d'
                % (printed, idx, blobs, want))
            ok = False

    last_idx = LAST_PAGE + PDF_OFFSET
    if last_idx <= len(pdf.order):
        log('  [PASS] printed page %d exists at PDF index %d (%d pages of back matter follow)'
            % (LAST_PAGE, last_idx, len(pdf.order) - last_idx))
    else:
        log('  [FAIL] printed page %d would need PDF index %d' % (LAST_PAGE, last_idx))
        ok = False

    log('  MAPPING ' + ('CONSISTENT' if ok else 'INCONSISTENT'))
    return ok


# ===========================================================================
# 6) THE BUILD
# ===========================================================================
def survey(pdf, pages):
    """Pass one: measure every page and write absolutely nothing.

    This exists so the side-ornament count can be checked against the pin
    BEFORE a single approved asset is overwritten.
    """
    measures = []
    for n in pages:
        raster = page_raster(pdf, n + PDF_OFFSET)
        if raster['w'] != SOURCE_W or raster['h'] != SOURCE_H:
            raise ValueError('page %d: source is %dx%d, expected %dx%d'
                             % (n, raster['w'], raster['h'], SOURCE_W, SOURCE_H))
        measures.append(light(analyse_page(raster, n)))
    return measures


def report_survey(measures, plans, groups):
    """Print what the survey found, and hand back the numbers that gate the build."""
    marked = [m for m in measures if m['sideMarkerPresent']]
    clean = [m for m in measures if not m['sideMarkerPresent']]
    log('SURVEY %d page(s)' % len(measures))
    log('  sheets carrying a detached side ornament : %d' % len(marked))
    log('  sheets carrying none                     : %d' % len(clean))
    log('  side-ornament pixels that would be removed: %d' % sum(m['sideMarkerPixelsRemoved'] for m in marked))
    log('  printed shapes cut by a crop edge         : 0 (any would have aborted the survey)')

    for key in sorted(groups, key=lambda k: -len(groups[k])):
        members = groups[key]
        first = members[0]
        plan = plans[first['printed']]
        widths = sorted(set(plans[m['printed']]['w'] for m in members))
        heights = sorted(set(plans[m['printed']]['h'] for m in members))
        fw = [(m['frame']['x1'] - m['frame']['x0'] + 1) * 100.0 / plans[m['printed']]['w'] for m in members]
        fh = [(m['frame']['y1'] - m['frame']['y0'] + 1) * 100.0 / plans[m['printed']]['h'] for m in members]
        log('  frame group %-9s %3d page(s)  crop %s x %s  y %d..%d'
            % (plan['group'], len(members),
               '/'.join(str(x) for x in widths), '/'.join(str(x) for x in heights),
               plan['y'], plan['y'] + plan['h'] - 1))
        log('      frame occupies %.3f-%.3f%% of the output width, %.3f-%.3f%% of its height'
            % (min(fw), max(fw), min(fh), max(fh)))

    # The whole point of the uniform crop: no page may be a different shape from
    # another page in its group, because the reader stretches all of them into
    # the same box.
    bad = []
    for key, members in groups.items():
        shapes = set((plans[m['printed']]['h'],) for m in members)
        if len(shapes) != 1:
            bad.append('%s: %d different output heights' % ('%d-%d' % key, len(shapes)))
    if bad:
        log('  [FAIL] ' + '; '.join(bad))
    return len(marked), len(clean), bad


def build(pdf, args, pages, plans):
    os.makedirs(ASSET_DIR, exist_ok=True)
    os.makedirs(args.work, exist_ok=True)
    records = {}
    pending = []
    failures = []

    def flush(batch):
        if not batch:
            return
        got = chrome_encode(args.chrome, args.work, batch)
        for job in batch:
            n = job['page']
            r = got.get(n)
            rec = job['rec']
            if r is None or 'error' in r:
                failures.append('page %d: encoder: %s' % (n, (r or {}).get('error', 'no result')))
                continue
            if r['mime'] != 'image/webp':
                failures.append('page %d: encoder returned %s' % (n, r['mime']))
                continue
            if r['w'] != rec['width'] or r['h'] != rec['height'] or r['w2'] != r['w'] or r['h2'] != r['h']:
                failures.append('page %d: the round trip changed the size' % n)
                continue
            if r['diff'] != 0:
                failures.append('page %d: %d differing samples -- not lossless' % (n, r['diff']))
                continue
            import base64
            data = base64.b64decode(r['data'])
            chunks = webp_chunks(data)
            if 'VP8L' not in chunks:
                failures.append('page %d: no VP8L chunk' % n)
                continue
            if 'VP8 ' in chunks:
                failures.append('page %d: a lossy VP8 chunk is present' % n)
                continue
            with open(os.path.join(ASSET_DIR, 'page-%03d.webp' % n), 'wb') as fh:
                fh.write(data)
            rec['bytes'] = len(data)
            rec['sha256'] = hashlib.sha256(data).hexdigest()
            rec['chunks'] = ','.join(chunks)
            rec['differingSamples'] = r['diff']
            rec['worstChannelDelta'] = r['worst']
            rec['lossless'] = True
            with open(os.path.join(args.work, 'enc-%03d.json' % n), 'w', encoding='ascii') as fh:
                json.dump(rec, fh)
            os.remove(job['pngPath'])
        batch[:] = []

    for n in pages:
        idx = n + PDF_OFFSET
        cached = os.path.join(args.work, 'enc-%03d.json' % n)
        asset = os.path.join(ASSET_DIR, 'page-%03d.webp' % n)
        if args.resume and os.path.exists(cached) and os.path.exists(asset):
            with open(cached, 'r', encoding='ascii') as fh:
                rec = json.load(fh)
            with open(asset, 'rb') as fh:
                data = fh.read()
            want = plans[n]
            got = rec.get('cropRect') or {}
            # A cached page is only reusable if it was cut with the crop this run
            # plans. Skipping that check is how a stale asset from an earlier crop
            # rule survives into a corrected build.
            fresh = (got.get('x') == want['x'] and got.get('y') == want['y']
                     and got.get('w') == want['w'] and got.get('h') == want['h'])
            if fresh and hashlib.sha256(data).hexdigest() == rec.get('sha256') and len(data) == rec.get('bytes'):
                records[n] = rec
                continue

        raster = page_raster(pdf, idx)
        if raster['w'] != SOURCE_W or raster['h'] != SOURCE_H:
            failures.append('page %d: source is %dx%d' % (n, raster['w'], raster['h']))
            continue
        m = analyse_page(raster, n)
        crop = plans[n]
        discarded, rgb = render_crop(m, crop)
        if discarded:
            # Unreachable: the crop is the frame envelope, and every shape was
            # already proved to be wholly inside it or wholly outside it. If it
            # ever fired, the page would fail rather than ship damaged.
            failures.append('page %d: the crop would drop %d protected printed pixel(s)' % (n, discarded))
            continue
        rec = {
            'printedPage': n,
            'pdfIndex': idx,
            'file': ASSET_REL % n,
            'sourceWidth': raster['w'],
            'sourceHeight': raster['h'],
            'sourceBitsPerComponent': raster['bpc'],
            'centralFrame': m['frame'],
            'retainedBox': m['keptBox'],
            'topMetadataBox': m['topMetadataBox'],
            'pageNumberBox': m['pageNumberBox'],
            'cropRect': {'x': crop['x'], 'y': crop['y'], 'w': crop['w'], 'h': crop['h']},
            'cropGroup': crop['group'],
            'safetyMarginPx': SAFETY_MARGIN,
            'whiteThreshold': WHITE_THRESHOLD,
            'sideMarkerPresent': m['sideMarkerPresent'],
            'sideMarkerShapes': m['sideMarkerShapes'],
            'sideMarkerBox': m['sideMarkerBox'],
            'sideMarkerPixelsRemoved': m['sideMarkerPixelsRemoved'],
            'protectedPixelsDiscarded': discarded,
            'width': crop['w'],
            'height': crop['h'],
            'upscaled': False,
        }
        png_path = os.path.join(args.work, 'crop-%03d.png' % n)
        write_png(png_path, crop['w'], crop['h'], rgb)
        records[n] = rec
        pending.append({'page': n, 'pngPath': png_path, 'rec': rec})
        if len(pending) >= args.batch:
            flush(pending)
            log('  built through printed page %d' % n)
    flush(pending)

    for n in pages:
        rec = records.get(n)
        if rec is None or 'sha256' not in rec:
            failures.append('page %d: no asset was produced' % n)
    return records, failures


def generated_on_utc(clock=None):
    """Return the injected build time as a stable UTC calendar date."""
    now = (clock or (lambda: datetime.datetime.now(datetime.timezone.utc)))()
    if not isinstance(now, datetime.datetime):
        raise TypeError('clock must return datetime.datetime')
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError('clock must return a timezone-aware datetime')
    return now.astimezone(datetime.timezone.utc).strftime('%Y-%m-%d')


def write_manifest(records, clock=None, manifest_path=MANIFEST):
    pages = [records[n] for n in sorted(records)]
    total = sum(p['bytes'] for p in pages)
    doc = {
        'schema': 'madina-hafs-pages/1',
        'purpose': ('Printed Madina Mushaf page images, printed pages 1-604. Page images only: '
                    'this file records provenance, geometry and hashes and holds no Quran text '
                    'and no OCR output.'),
        'generatedOn': generated_on_utc(clock),
        'source': {
            'publisher': 'King Fahd Glorious Quran Printing Complex (Majma al-Malik Fahd li-Tibaat al-Mushaf al-Sharif)',
            'edition': 'Mushaf al-Madinah al-Nabawiyyah, riwayat Hafs an Asim, standard size, green, 1441 AH printing (2020)',
            'officialSite': 'https://dm.qurancomplex.gov.sa/',
            'officialRightsPage': 'https://dm.qurancomplex.gov.sa/rights/',
            'rightsPageNamedByTheItem': 'https://dm.qurancomplex.gov.sa/copyright/',
            'officialServerReachable': False,
            'officialServerNote': ('dm.qurancomplex.gov.sa returned TCP/connection timeouts on 2026-07-31, '
                                   'so the official package could not be fetched. The user authorised one '
                                   'preserved mirror of the same edition.'),
            'acquiredFrom': 'preserved mirror (Internet Archive), user-authorised for this edition',
            'itemUrl': SOURCE_ITEM,
            'itemMetadataUrl': 'https://archive.org/metadata/MushafMadinaHafsGreen1441',
            'downloadUrl': SOURCE_URL,
            'resolvedDownloadUrl': 'https://dn790006.ca.archive.org/0/items/MushafMadinaHafsGreen1441/MushafMadinaHafsGreen1441.pdf',
            'fileName': 'MushafMadinaHafsGreen1441.pdf',
            'fileBytes': SOURCE_BYTES,
            'fileSha256': SOURCE_SHA256,
            'fileSha1': 'ef96a54eddd479cbf7a97b2d0bef977925106d33',
            'fileMd5': '2304666c85648b1a9e3f0175d066acf5',
            'manifestMatch': True,
            'itemPublisherField': 'Majma al-Malik Fahd li-Tibaat al-Mushaf al-Sharif (King Fahd Glorious Quran Printing Complex)',
            'itemRightsField': 'Majma al-Malik Fahd li-Tibaat al-Mushaf al-Sharif (King Fahd Glorious Quran Printing Complex)',
            'itemDate': '2020',
            'acquisitionDate': '2026-07-31',
            'downloadedTo': 'temporary directory outside the repository (not committed)',
        },
        'licence': {
            'result': 'PROVISIONAL_OFFICIAL_PUBLIC_NOTICE',
            'basis': ('The preserved item names the King Fahd Glorious Quran Printing Complex as publisher '
                      'and rights holder and points at the Complex\'s own public rights notice. The notice '
                      'itself could not be read on the acquisition date because the official server timed out.'),
            'revalidationRequired': True,
            'revalidationRule': ('When dm.qurancomplex.gov.sa is reachable again, re-read the rights page and '
                                 'either replace this source with the official package or hash-compare the '
                                 'official package against fileSha256 above, before any release.'),
        },
        'builder': {
            'script': 'tools/build-madina-hafs-pages.py',
            'method': ('Direct read of the PDF page image XObjects. No OCR, no screenshot, no re-render, '
                       'no resampling and no upscaling.'),
            'encoder': 'lossless WebP produced by the WebP encoder inside Chrome, over a canvas',
            'roundTrip': ('Every page was decoded again after encoding and compared with its source pixels '
                          'sample by sample. differingSamples is that count.'),
        },
        'extraction': {
            'pdfPageCount': PDF_PAGE_COUNT,
            'pdfToPrintedOffset': PDF_OFFSET,
            'firstPrintedPage': FIRST_PAGE,
            'lastPrintedPage': LAST_PAGE,
            'offsetProof': ('The PDF\'s own /PageLabels tree numbers the first three leaves with letters and '
                            'restarts as decimal 1 at the fourth leaf, so printed page N is PDF index N + 3. '
                            'Confirmed independently by counting the separate ink marks in each sampled page\'s '
                            'folio band and requiring that count to equal the digit count of the printed number, '
                            'including across the 9/10 and 99/100 boundaries. No glyph was identified and no text '
                            'was read.'),
            'sourcePixelFormat': 'indexed DeviceRGB, FlateDecode, PNG predictor 15',
            'sourcePageSize': '957x1368 px for every page in the package (MediaBox 717.75 x 1026 pt)',
            'upscaled': False,
        },
        'cropTreatment': {
            'rule': ('Anchor the crop on the printed page frame, not on the ink. The central floral frame is '
                     'the largest connected component of printed pixels; the horizontal crop is its bounding '
                     'box plus a safety margin; the vertical crop is the union, across every page sharing that '
                     'frame geometry, of the printed content that remains inside the horizontal envelope.'),
            'kept': ('The complete floral frame and every pixel inside it, the surah cartouche, the top '
                     'surah/juz metadata printed above the frame, and the printed page number below it.'),
            'removed': ('Detached juz/hizb/rub ornaments printed in the outer margin, outside the floral frame, '
                        'on either side of the sheet, together with the exterior white space.'),
            'whiteThreshold': WHITE_THRESHOLD,
            'safetyMarginPx': SAFETY_MARGIN,
            'notCut': ('Every connected printed shape was checked against the crop edge before any pixel was '
                       'written: each one is wholly inside the crop or wholly outside it, so no shape is ever '
                       'bisected. A shape crossing the edge aborts the page.'),
            'verification': ('protectedPixelsDiscarded counts every printed pixel inside the horizontal '
                             'envelope that the crop rectangle does not keep. It is 0 on every page, which is '
                             'what proves the frame, the metadata and the page number all survived intact.'),
            'uniformGeometry': ('Pages sharing a frame geometry share an output height and an output width to '
                                'within the 1px difference between the odd and even printed frames, so the '
                                'floral frame occupies the same percentage of every output image. The reader '
                                'stretches each page into the whole reading viewport, so this is what stops a '
                                'page that once carried a side ornament from rendering smaller than its '
                                'neighbours.'),
            'reason': ('Session 80. Keeping the detached side ornaments made 252 sheets 853px wide against 747 '
                       'for the rest, so on a phone those pages rendered visibly smaller. The owner reviewed '
                       'the printed design on a real device, approved the frame, text and quality, and rejected '
                       'the size difference.'),
        },
        'totals': {
            'pages': len(pages),
            'totalAssetBytes': total,
            'sideMarkerPages': sum(1 for p in pages if p['sideMarkerPresent']),
            'pagesWithoutSideMarker': sum(1 for p in pages if not p['sideMarkerPresent']),
            'sideMarkerPixelsRemoved': sum(p['sideMarkerPixelsRemoved'] for p in pages),
            'protectedPixelsDiscarded': sum(p['protectedPixelsDiscarded'] for p in pages),
            'differingSamples': sum(p['differingSamples'] for p in pages),
            'losslessPages': sum(1 for p in pages if p['lossless']),
            'cropGroups': sorted(set(p['cropGroup'] for p in pages)),
            'outputSizes': sorted(set('%dx%d' % (p['width'], p['height']) for p in pages)),
        },
        'approvedPrototypeHashes': dict((str(k), v) for k, v in sorted(APPROVED.items())),
        'supersededPrototypeHashes': {
            'note': ('Approved by eye in session 79 and deliberately replaced in session 80: this page carries '
                     'a detached side ornament, so the correction is required to change it. Pinning these bytes '
                     'would pin the defect.'),
            'hashes': dict((str(k), v) for k, v in sorted(SUPERSEDED.items())),
        },
        'pages': pages,
        'requiredFollowup': [
            'automatic last-page save',
            'manual page bookmark preservation',
            'daily-wird target and progress',
            'bottom progress strip',
            'local-only state, never sent to AI',
        ],
    }
    with open(manifest_path, 'w', encoding='ascii', newline='\n') as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=True)
        fh.write('\n')
    return doc


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument('--pdf', default=os.path.join(tempfile.gettempdir(), 'madina-proto', 'mushaf.pdf'))
    ap.add_argument('--work', default=os.path.join(tempfile.gettempdir(), 'madina-hafs-build'))
    ap.add_argument('--chrome', default=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    ap.add_argument('--pages', default='%d-%d' % (FIRST_PAGE, LAST_PAGE))
    ap.add_argument('--batch', type=int, default=8)
    ap.add_argument('--resume', action='store_true')
    ap.add_argument('--verify-mapping', action='store_true')
    ap.add_argument('--analyse', '--analyze', dest='analyse', action='store_true')
    ap.add_argument('--build', action='store_true')
    ap.add_argument('--expect-side-marker-pages', type=int, default=EXPECTED_SIDE_MARKER_PAGES)
    args = ap.parse_args()
    if not args.verify_mapping and not args.build and not args.analyse:
        args.verify_mapping = args.build = True

    log('SOURCE ' + args.pdf)
    if not os.path.exists(args.pdf):
        log('  [FAIL] the authorised source PDF is not present')
        return 1
    size = os.path.getsize(args.pdf)
    h = hashlib.sha256()
    with open(args.pdf, 'rb') as fh:
        for block in iter(lambda: fh.read(1 << 20), b''):
            h.update(block)
    digest = h.hexdigest()
    log('  bytes  %d %s' % (size, 'OK' if size == SOURCE_BYTES else 'MISMATCH'))
    log('  sha256 %s %s' % (digest, 'OK' if digest == SOURCE_SHA256 else 'MISMATCH'))
    if size != SOURCE_BYTES or digest != SOURCE_SHA256:
        log('  [FAIL] this is not the authorised source package')
        return 1

    pdf = Pdf(args.pdf)

    if args.verify_mapping:
        samples = [1, 2, 3, 9, 10, 76, 77, 78, 99, 100, 302, 303, 304, 602, 603, 604]
        if not verify_mapping(pdf, samples):
            log('STOP: the page mapping is inconsistent. Nothing was written.')
            return 1
    if not args.build and not args.analyse:
        return 0

    m = re.match(r'^(\d+)-(\d+)$', args.pages)
    lo, hi = (int(m.group(1)), int(m.group(2))) if m else (FIRST_PAGE, LAST_PAGE)
    pages = list(range(max(FIRST_PAGE, lo), min(LAST_PAGE, hi) + 1))

    # ---- pass one: measure, and write nothing at all -----------------------
    measures = survey(pdf, pages)
    plans, groups = plan_crops(measures)
    marked, clean, shape_errors = report_survey(measures, plans, groups)

    # ---- THE GATE ----------------------------------------------------------
    # 604 approved binaries are about to be overwritten on the strength of one
    # detector. If that detector does not find the number of side ornaments it
    # was told to expect, then either the detector or the expectation is wrong,
    # and neither is a thing to discover afterwards. So: stop, having written
    # nothing, and let a person look at the survey above.
    if shape_errors:
        log('STOP: the planned crops are not uniform. Nothing was written.')
        return 1
    if marked != args.expect_side_marker_pages:
        log('STOP: %d sheet(s) carry a detached side ornament, but %d were expected.'
            % (marked, args.expect_side_marker_pages))
        log('      No asset was touched and no manifest was written.')
        log('      Review the survey above. If %d is right, re-run with '
            '--expect-side-marker-pages %d.' % (marked, marked))
        return 1
    log('  [PASS] the detached-ornament count matches the expected %d' % args.expect_side_marker_pages)

    if not args.build:
        log('ANALYSE ONLY: nothing was written.')
        return 0

    # The vertical crop is a union taken ACROSS the run, so a partial run would
    # settle on a different height from the full one and quietly write pages
    # that do not match their neighbours. Partial runs may measure, not write.
    if len(pages) != LAST_PAGE - FIRST_PAGE + 1:
        log('STOP: --build needs the whole range %d-%d, because the crop height is a union '
            'across all pages. Use --analyse for a subset.' % (FIRST_PAGE, LAST_PAGE))
        return 1

    log('BUILD printed pages %d-%d (%d pages), batch %d' % (pages[0], pages[-1], len(pages), args.batch))
    records, failures = build(pdf, args, pages, plans)

    for n, want in sorted(APPROVED.items()):
        got = records.get(n, {}).get('sha256')
        if got is None:
            log('  [INFO] approved page %d was not part of this run' % n)
        elif got == want:
            log('  [PASS] approved page %d reproduced byte-identically' % n)
        else:
            failures.append('page %d does not reproduce the approved asset: %s' % (n, got))

    if failures:
        log('BUILD FAILED')
        for f in failures[:40]:
            log('  [FAIL] ' + f)
        log('  %d failure(s). The manifest was not written.' % len(failures))
        return 1

    if len(records) == LAST_PAGE:
        doc = write_manifest(records)
        log('MANIFEST data/madina-hafs-pages.json  pages=%d  bytes=%d'
            % (doc['totals']['pages'], doc['totals']['totalAssetBytes']))
        old = os.path.join(ROOT, 'data', 'madina-hafs-prototype.json')
        if os.path.exists(old):
            os.remove(old)
            log('  removed the superseded data/madina-hafs-prototype.json')
    else:
        log('PARTIAL RUN (%d pages): the manifest is only written for a full 1-604 build' % len(records))
    log('BUILD OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
