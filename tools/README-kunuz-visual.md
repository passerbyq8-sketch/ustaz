# Kunuz visual engine

`node tools/build-geo.mjs` rebuilds `quest-data/kunuz-geo.js`. Raw downloads live
in the operating system temporary directory, outside the deployment and Git.
`polygon-clipping` is a build-only development dependency. All files under
`tools/` and `guards/` are excluded by `.vercelignore`.

Made with Natural Earth. Its raster and vector data are public domain:
https://www.naturalearthdata.com/about/terms-of-use/
Source GeoJSON: https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson

The build uses 110m country boundaries, replacing small or absent countries with
50m boundaries. It unions the two source features into Palestine, removing their
internal border. Disputed features and additional disputed-area polygons are
cut out of target countries and emitted as anonymous, non-targetable land. The
build's metadata records geometry checks without shipping source properties.

The production manifest is deliberately empty. `PACKS_ENABLED` in
`quest-visual.js` is the single pack switch. The bank and its seal remain intact;
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
  unmodified. No photographs or content packs ship with this release.

For a local demonstration, run `node tools/kunuz-visual-browser.cjs --demo`.
It serves test fixtures by interception only; it never changes the production
manifest. `node guards/kunuz-visual-guard.cjs` is the registered regression gate.
