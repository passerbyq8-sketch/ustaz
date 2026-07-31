# Madina Mushaf page images -- source, rights and attribution

This notice covers the printed-page images used by the image reader:

    assets/madina-hafs/page-001.webp    printed page 1
    ...                                 printed pages 2 to 603
    assets/madina-hafs/page-604.webp    printed page 604

That is 604 files, one per printed page of the Mushaf, and nothing else in this
repository comes from this source. The machine-readable record of the same facts --
per-page hashes, crop geometry, byte counts and the lossless proof -- is
`data/madina-hafs-pages.json`, and the program that produced every one of them is
`tools/build-madina-hafs-pages.py`. Neither file contains any Quran text.

## Work

Mushaf al-Madinah al-Nabawiyyah, riwayat Hafs an Asim -- standard size, green cover,
1441 AH printing (2020).

## Publisher and rights holder

King Fahd Glorious Quran Printing Complex, Madinah, Saudi Arabia
(Majma al-Malik Fahd li-Tibaat al-Mushaf al-Sharif).

The Complex publishes the digital Mushaf and its terms of use at:

    official site   https://dm.qurancomplex.gov.sa/
    rights page     https://dm.qurancomplex.gov.sa/rights/

The preserved copy used here names the Complex's own rights notice at:

    https://dm.qurancomplex.gov.sa/copyright/

## How these pages were obtained

Acquisition date: 2026-07-31.

The official server `dm.qurancomplex.gov.sa` was unreachable on that date -- it returned
TCP/connection timeouts -- so the official package could not be downloaded. The owner of
this repository inspected and approved one preserved mirror of the same edition and
authorised it as the source for these page images:

    item      https://archive.org/details/MushafMadinaHafsGreen1441
    file      https://archive.org/download/MushafMadinaHafsGreen1441/MushafMadinaHafsGreen1441.pdf
    bytes     65008727
    sha256    2f0b03925568fca326f47a5ec756df2c3eecc8b29f75471f3a0815a5a3e58d28

The preserved item records the publisher and the rights holder as the King Fahd Glorious
Quran Printing Complex and the edition as the green 1441 AH Hafs Mushaf. The downloaded
bytes match the item's own manifest (sha1 ef96a54eddd479cbf7a97b2d0bef977925106d33,
md5 2304666c85648b1a9e3f0175d066acf5).

The PDF was downloaded to a temporary directory outside this repository and is not
committed. The builder verifies that file's byte count and SHA-256 before it reads a
single page, and refuses to run on anything else.

Printed page N is PDF page N + 3. That mapping is not assumed: the PDF's own page label
tree numbers its first three leaves with letters and restarts as decimal 1 at the fourth,
and the mapping was confirmed independently by counting the separate ink marks in the
folio band of sampled pages -- across the 9/10 and 99/100 boundaries, where the count has
to step from one mark to two and from two to three -- and requiring that count to match
the printed number the mapping predicts. No glyph was identified and no text was read.

Each page was read directly out of the PDF's page image object -- no OCR, no screenshot,
no re-render, no resampling, no upscaling, no sharpening and no recolouring. Only exterior
near-white margin was trimmed, and only after the union bounding box of every printed
element was measured and expanded by a 6-pixel safety margin, so the complete printed page
is preserved: floral frame, surah cartouche, top metadata, corner ornament, side juz/hizb/
rub marker, printed text and printed page number. The build counts the printed pixels that
fall outside each crop rectangle; that count is 0 on all 604 pages, and a page whose count
were not 0 would keep its original margins instead of being trimmed.

Every page is stored as lossless WebP and was round-tripped before it was accepted: the
encoded file was decoded again and compared with the source pixels sample by sample. All
604 pages report 0 differing samples.

## Licence status

    PROVISIONAL_OFFICIAL_PUBLIC_NOTICE

The Complex's public rights notice could not be read on 2026-07-31 because its server
timed out. When that server is reachable again, the rights page must be re-read and the
source must be replaced by, or hash-compared against, the official package before any
release. Until then these images ship behind a flag that is off by default.

## Attribution

Quran page images: Mushaf al-Madinah al-Nabawiyyah, Hafs an Asim, 1441 AH edition,
published by the King Fahd Glorious Quran Printing Complex, Madinah, Saudi Arabia.
Used under the Complex's public terms; see https://dm.qurancomplex.gov.sa/rights/.
