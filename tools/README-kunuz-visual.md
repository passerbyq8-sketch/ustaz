# Kunuz visual engine

`node tools/build-geo.mjs` rebuilds `quest-data/kunuz-geo.js`. Raw downloads live
in the operating system temporary directory, outside the deployment and Git.
The vendored `polygon-clipping` 0.15.7 UMD bundle is build-only, with its MIT
license and the bundled robust-predicates license in `tools/vendor/`.
Its bundled splaytree attribution is retained in the bundle header. No npm
dependency is added to the application. All files under
`tools/` and `guards/` are excluded by `.vercelignore`.

Made with Natural Earth. Its raster and vector data are public domain:
https://www.naturalearthdata.com/about/terms-of-use/
Source GeoJSON: https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson

The build uses 110m country boundaries, replacing small or absent countries with
50m boundaries. It unions the two source features into Palestine, removing their
internal border. Disputed features and additional disputed-area polygons are
cut out of target countries and emitted as anonymous, non-targetable land. The
build's metadata records geometry checks without shipping source properties.

The manifest lists the enabled supplemental packs. Drawn landmarks and silhouettes
remain on disk but are disabled in this preview; the reviewed `landmark-photo`
and `object-pixel` packs use local photographs.
`PACKS_ENABLED` in `quest-visual.js` is the single pack switch. The bank and its seal remain intact;
pack history uses `kunuz_pack_seen_v1`, keyed by question ID, alongside the
unchanged `kunuz_seen_v1` record. Clearing history explicitly clears both.

Pack contract (classic local JavaScript, not an ES module):

```js
KZV.register({
  "slug": "example",
  "stamp": "<count>-<eight lowercase hex digits>",
  "cats": [{"id":"example-category","name":"اسم الفئة","kind":"general","group":"visual"}],
  "qs": [{"id":"example-0001","cat":"example-category","type":"mcq","fmt":"text",
        "q":"نص السؤال","choices":["أ","ب","ج","د"],"answer":0,
        "why":"التفسير","src":[],"level":1,"status":"approved"}]
});
```

The body inside `KZV.register(...)` must be strict JSON (quoted keys, no comments,
functions or trailing commas). No part of a pack is evaluated as JavaScript.
`answer` is zero based; `level` is 1, 2, or 3. `status` must be `approved`.
`flags`, if present, is an array of plain strings. `src` is an array of plain
strings. Text is never interpreted as HTML. `fmt` is a descriptive string;
rendering depends on optional `vis.kind`. Question IDs must be the pack slug,
a hyphen, and at least four decimal digits. Categories must have unique IDs;
existing bank category IDs may be referenced but never redefined. `kind` is
`general` or `religious`; category labels must contain no markup delimiters or
quotes. `group` is `visual` (بصريات وألغاز) or one of
`quran`, `belief`, `sunnah`, `islamic-history`, `gulf`, `language`, `science`,
`world`. Without a group, visual categories use `visual`; other categories use
`world` or `islamic-history` according to `kind`.

The stamp uses the IDs of **all rows in order**, each followed by LF, with
JavaScript UTF-16 code units: start at 2166136261, apply
`h = Math.imul(h ^ codeUnit, 16777619) >>> 0`, format as eight hex digits,
and prefix the row count and a hyphen. A malformed envelope, duplicate ID,
collision, or bad stamp rejects the whole pack atomically. Invalid questions
(including unsafe visuals) are skipped before categories are made available.
Only categories with accepted questions are added. No counts appear in the UI.

Visual fields:

* `map`: `{kind:"map",view:"mena",hit:["Egypt"]}`. Views: `mena`, `europe`,
  `asia`, `africa`, `americas`, `world`. English canonical names come from
  `KUNUZ_GEO_INDEX` in the renderer; matching is exact. No country name is
  placed in accessible labels or DOM attributes of the drawing.
* `emoji`: `{kind:"emoji",seq:"🗻🍣",basis:["جبل","سوشي"]}`. Objects only;
  figures, animals, body parts, flags, and non-emoji markup are rejected.
* `svg`: `{kind:"svg",svg:'<svg viewBox="0 0 100 100"><path d="M10 90L50 10L90 90Z" fill="none" stroke="currentColor"/></svg>'}`.
  Maximum 4096 UTF-8 bytes; only geometry and currentColor/none paint.
  Local `defs`/`clipPath` geometry is supported. Clip IDs are unique and renamed
  per render; only same-SVG `url(#id)` references are accepted, with no external
  references or clipping inside a clip definition.
* `silhouette`: `{kind:"silhouette",emoji:"🔑"}`. Objects only. Black until reveal.
* `pattern`: `{kind:"pattern",seq:[cell,cell,cell,cell],opts:[cell,cell,cell,cell]}`.
  Cell: `{shape:"square",rot:90,fill:"solid",size:2,count:1}`. Shapes:
  `circle`, `square`, `triangle`, `diamond`, `pentagon`, `hexagon`, `star`,
  `cross`. Rotation is a multiple of 45 from 0 to 315, fill is `solid`,
  `outline`, or `half`, size is 1–3, count is 1–4. Options are drawn from
  `opts` in their original index order; accessible names describe geometry.
* `photo`: `{kind:"photo",src:"quest-data/signs/area.webp",mask:{x:67,y:33,w:33,h:34}}`.
  Percent values must be finite, positive in size, and inside the image.
  The default mask covers the middle right third. Source photographs remain
  unmodified. NEW20 contains no photo questions.
* Photo landmarks use `{kind:"photo",effect:"plain",src:"quest-data/photos/landmarks/l0001.jpg",credit:{author:"…",license:"CC BY-SA 4.0"}}`.
  Their credits list, including source and license links, is
  `quest-data/photos/landmarks/credits.json`. JPEGs have a long side of 800 px
  and are at most 90,000 bytes. Paths contain neutral IDs.
* The enabled object-photo pack uses the same contract with `effect:"pixel"` and
  an `objects/` path. Its 167 questions passed visual, source-license and blind
  checks; 50 show traditional object types used in Gulf/Kuwaiti culture. That
  classification does not claim every photographed artifact originated there.
  `quest-data/photos/objects/credits.json` records the source, author, license,
  final-image hash, regional basis and blind review for each photo. Commons,
  The Met Open Access (CC0) and Pexels License photos are self-hosted; provider
  credit appears after reveal. The 121 landmark questions are unchanged.
  The renderer decodes an off-DOM image into a canvas, using 20/14/9 blocks
  across at levels 1/2/3. Reveal resolves to clear over 620 ms, immediately
  with reduced motion. Credit text appears only after reveal.

Every visual has a corner enlarge control and supports Enter/Space. The lazy
local fullscreen viewer copies the displayed geometry or canvas pixels,
including asynchronous loading; it never reads a pixel question's clear source.
Pointer pinch/pan, double tap (2.5×), keyboard controls, backdrop, Escape, close
button and a consumed browser/device-back entry preserve the active question.
The next eligible photo is prefetched per category (per level in the board's
points mode);
all four draw adapters consume that prepared question if it is still eligible.
The published Journey theme supplies its own local KunuzPlex fonts on all five
game pages. Its question card hosts the same renderer; the viewer consumes Back
before Journey handles navigation. The earlier Noto font bundle is removed.

For a local demonstration, run `node tools/kunuz-visual-browser.cjs --demo`.
It prints a loopback URL without opening a browser and serves the actual NEW20
manifest. The server enables packs in the served copy of the renderer only;
the on-disk switch stays false. Browser measurements without `--demo` continue
to use the isolated calibration fixtures.
`node guards/kunuz-visual-guard.cjs` is the registered regression gate.

Run `node tools/kunuz-new20-convert.cjs` to regenerate from the sibling
`quest-review/kunuz-new-2026-10-19` directory, or pass `--input DIR`.
`--check` validates the inputs and every generated byte without writing.
The converter checks the assembly fingerprint, each group's agreement with
`ALL-NEW20.json`, the unchanged live bank, unique IDs, stamps, choices, answers,
levels, sources, and acceptance of every row by the actual renderer.

The engine's loader requires `quest-data/kunuz-pack-<slug>.js`, so generated
packs use those paths. Source `{title,url}` records become plain strings,
`proposed` becomes the engine-required `approved` status, absent flags become
an empty array, and text questions omit `vis`. Source question text, choices,
answer order, explanations, IDs, and assigned levels remain intact.
Map aliases become the index's canonical names; targets outside their source
view use the supported world view. Two answer-revealing accessible labels are
replaced with descriptions of the visible clues, and invisible empty SVG paths
are removed. The renderer also admits the reviewed nonliving glyphs and local
SVG clips needed by the inputs.

Religious-review and bank-overlap questions remain in separate full-record
JSON files under the input directory's `_held/`, with IDs and group names.
Missing or invalid local photo assets also go there. `conversion-audit.json`
records group totals, source and output hashes, stamps, and each visual
adjustment. Empty groups have no pack. All rendering assets are local; source
URLs are explanatory text and are never fetched by the pack renderer.
