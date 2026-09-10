# The interface faces -- source, rights and attribution

This notice covers every font file in `fonts/`:

    Amiri
        fonts/J7aRnpd8CGxBHpUrtLMA7w.woff2                 108560  arabic, weight 400
        fonts/J7aRnpd8CGxBHpUgtLMA7w.woff2                  10444  latin-ext, weight 400
        fonts/J7aRnpd8CGxBHpUutLM.woff2                     19544  latin, weight 400
        fonts/J7acnpd8CGxBHp2VkaY6zp5yGw.woff2              99968  arabic, weight 700
        fonts/J7acnpd8CGxBHp2VkaYxzp5yGw.woff2              10860  latin-ext, weight 700
        fonts/J7acnpd8CGxBHp2VkaY_zp4.woff2                 20300  latin, weight 700
    Amiri Quran
        fonts/_Xmo-Hk0rD6DbUL4_vH8Zp5v5i2ssg.woff2          45680  arabic, weight 400
        fonts/_Xmo-Hk0rD6DbUL4_vH8Zp5q5i0.woff2             12276  latin, weight 400
    Noto Naskh Arabic
        fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2  94032  arabic, weight 400/500/700
        fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN36HV20Lg.woff2  14284  math, weight 400/500/700
        fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN3oHV20Lg.woff2   9408  symbols, weight 400/500/700
        fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2IHV20Lg.woff2  10392  latin-ext, weight 400/500/700
        fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2GHV0.woff2     19696  latin, weight 400/500/700
    Tajawal
        fonts/Iura6YBj_oCad4k1nzSBC45I.woff2                 8932  arabic, weight 400
        fonts/Iura6YBj_oCad4k1nzGBCw.woff2                  10256  latin, weight 400
        fonts/Iurf6YBj_oCad4k1l8KiHrRpiYlJ.woff2             8940  arabic, weight 500
        fonts/Iurf6YBj_oCad4k1l8KiHrFpiQ.woff2               9900  latin, weight 500
        fonts/Iurf6YBj_oCad4k1l4qkHrRpiYlJ.woff2             9024  arabic, weight 700
        fonts/Iurf6YBj_oCad4k1l4qkHrFpiQ.woff2               9996  latin, weight 700
        fonts/Iurf6YBj_oCad4k1l5anHrRpiYlJ.woff2             9448  arabic, weight 800
        fonts/Iurf6YBj_oCad4k1l5anHrFpiQ.woff2              10584  latin, weight 800

That is 21 files, 552,524 bytes, and nothing else in this repository comes from
this source. They are declared by 31 `@font-face` rules inside the inline `<style>` of
`index.html`, and two of them -- the Noto Naskh Arabic arabic and latin subsets, the pair the
first screen cannot paint without -- are named in the `CORE` array of `sw.js`, so that a reader
who has visited once meets the right type offline.

## Work

Four typefaces, in the exact cuts and subsets that `fonts.googleapis.com` served to a current
desktop Chrome for the stylesheet URL `index.html` used to link. The rows below are read from
the files OWN `name` table (name IDs 1, 5, 0 and 14) with node -- the woff2 table directory
walked and the Brotli stream decompressed with `zlib`, no font library involved:

| family | version | copyright (name ID 0) | licence URL (name ID 14) |
|---|---|---|---|
| Amiri | Version 1.002 | `Copyright 2010-2022 The Amiri Project Authors (https://github.com/aliftype/amiri).` | https://openfontlicense.org |
| Amiri Quran | Version 1.003 | `Copyright 2010-2022 The Amiri Project Authors (https://github.com/aliftype/amiri).` | https://openfontlicense.org |
| Noto Naskh Arabic | Version 2.021 | `Copyright 2022 The Noto Project Authors (https://github.com/notofonts/arabic)` | https://openfontlicense.org |
| Tajawal | Version 1.700 | `(c) 2017 by Boutros International. All rights reserved.` | http://scripts.sil.org/OFL |

## Publisher and rights holder

Each family names its own copyright holder above: the Amiri Project authors for Amiri and
Amiri Quran, the Noto Project authors for Noto Naskh Arabic, and Boutros International for
Tajawal. Google serves and subsets them; it does not own them. This repository takes them from
Google's own delivery host exactly as a browser would, and under the same licence.

## How these files were obtained

Acquisition date: 2026-09-10.

    stylesheet   https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800
                 &family=Amiri:wght@400;700&family=Amiri+Quran
                 &family=Noto+Kufi+Arabic:wght@400;500;700
                 &family=Noto+Naskh+Arabic:wght@400;500;700&display=swap
    user agent   Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like
                 Gecko) Chrome/139.0.0.0 Safari/537.36
    served       38124 bytes, 46 @font-face blocks, 26 distinct .woff2 files, five families

That is the exact URL the page linked, fetched with a current desktop Chrome user agent --
Google tailors the CSS by user agent, and a different agent is served different file names.
Every `.woff2` the CSS references was then fetched from `fonts.gstatic.com` with the same
agent and written to `fonts/` under Google's own file name. Nothing was converted,
re-subsetted, renamed or edited: these are the vendor's bytes.

**The five Noto Kufi Arabic files (207,272 bytes) were deliberately not brought in.** That
family is the `--vt-font` of the `qibla_13` visual identity, and no reader can reach that
identity: `readEzikVisualTheme` normalises every stored value to `istana_33`, the boot script
in `index.html` normalises it again before React exists, and Settings offers no control that
can produce it. The CSS token that names the family stays exactly where it is -- gate
`themecoverage` reads it -- but the bytes nobody would download are not carried.

Every file was recorded on arrival:

| file | bytes | sha256 |
|---|---|---|
| `J7aRnpd8CGxBHpUrtLMA7w.woff2` | 108560 | `9abf8a10b4a2f27b698740522c9beec9ded7728aeef0738ac0d6e175bf6249d7` |
| `J7aRnpd8CGxBHpUgtLMA7w.woff2` | 10444 | `199be132b6fbb2fef143b30bae2eb04c63268758d29c03ff057b52cbee91636e` |
| `J7aRnpd8CGxBHpUutLM.woff2` | 19544 | `d600850a2b0f3d862559d0bb040bca877e0f75cf9ee71a893bbd5089a224e3cd` |
| `J7acnpd8CGxBHp2VkaY6zp5yGw.woff2` | 99968 | `c775d9f8c3a7cf0d0c2bb5246dd699e8c09bf6f8758e1be0b98939331b18bcce` |
| `J7acnpd8CGxBHp2VkaYxzp5yGw.woff2` | 10860 | `caca5182eb8536799ec861cbf33c14ed6f5213f3abcd99fffd61adadbc9c66d0` |
| `J7acnpd8CGxBHp2VkaY_zp4.woff2` | 20300 | `f53eb332acb23ec7e09e2487909c56cf841d649c970084d6a74d82aa9534f737` |
| `_Xmo-Hk0rD6DbUL4_vH8Zp5v5i2ssg.woff2` | 45680 | `35f4f02bbde81b20118a788f8b212bff385eb499df0746d277b5b478f32e733e` |
| `_Xmo-Hk0rD6DbUL4_vH8Zp5q5i0.woff2` | 12276 | `d35dc66f21420352ccda516cec951144d624bdb6ac17ec7088e2dc06df51f602` |
| `RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2` | 94032 | `2a10d33e1f7129ab2b6ec76666e82ac5b509fbcfa7b4a3a1289bff42d2d64cd7` |
| `RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN36HV20Lg.woff2` | 14284 | `8e60f95fdb5e14d50f2571de500b312a96831e4fc7ecc6f30c54b54e4d5f4e48` |
| `RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN3oHV20Lg.woff2` | 9408 | `ab68a53d846a9683111a565632e34ec0d5869f95ee28868035f72ad394dcfa38` |
| `RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2IHV20Lg.woff2` | 10392 | `3d7795251bdfdecb545a745ae027a05fbcd60c824b2a374fe3921881fbe4279b` |
| `RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2GHV0.woff2` | 19696 | `2a30d48ddf0a75254b40b236fcfe789aed180526224ccb5089fd0b49999e0ec0` |
| `Iura6YBj_oCad4k1nzSBC45I.woff2` | 8932 | `6c9081fd00db08800850fa7d214593aa94992be5159e97557aa60197252cb95a` |
| `Iura6YBj_oCad4k1nzGBCw.woff2` | 10256 | `b081f7bf790678b56a2c0502651d6873cbabc09e78fe40655df15f918b1e369b` |
| `Iurf6YBj_oCad4k1l8KiHrRpiYlJ.woff2` | 8940 | `4255019c1cd986f7cda7869df69baf72730d61304ae14baba4acfeb13085da54` |
| `Iurf6YBj_oCad4k1l8KiHrFpiQ.woff2` | 9900 | `9986de5db80ec050300f1cea25d651a5779ae62b91a39b5667ac23d0c7668cbb` |
| `Iurf6YBj_oCad4k1l4qkHrRpiYlJ.woff2` | 9024 | `fa5e72326681abee3a4952be582e1c2c2abb27932ef262610c078ce89541f919` |
| `Iurf6YBj_oCad4k1l4qkHrFpiQ.woff2` | 9996 | `de8f431c146ab1feb612cb7ced0842ae5c4e2f12067d13db0badeca73977200b` |
| `Iurf6YBj_oCad4k1l5anHrRpiYlJ.woff2` | 9448 | `5fa525682b4805d95c59943bc4405b993dc9e028fd93cb96f4b50911f3b428b7` |
| `Iurf6YBj_oCad4k1l5anHrFpiQ.woff2` | 10584 | `00241262004f96088a827ad4c5d423dbbc0648224e1cd990e5e5ff8e912157c9` |

## Licence status

    OFL_1_1_BUNDLED

All four families carry a SIL Open Font License pointer in the binary (name ID 14, quoted
above). The OFL permits bundling and redistribution as part of a larger work; it requires the
copyright notice and the licence to travel with the fonts, and it forbids selling the fonts on
their own. Neither is at issue here: the files ship inside the app, the notice above travels
with them, and the licence text sits beside them.

    fonts/OFL.txt   4599 bytes, LF, no BOM
                    sha256 1d361a8f8e8ce6e68457dcd93fb56e162e6baa3bbb7e7573a290d44399f6b57e
                    fetched 2026-09-10 from https://openfontlicense.org/documents/OFL.txt,
                    the plain-text official text linked from the licence page that name ID 14
                    names (http://scripts.sil.org/OFL redirects to the same site). Saved
                    unmodified -- not reflowed, not re-encoded, not renamed.

Before this commit this repository recorded no font licence at all, while fetching and
rendering all five families on every boot. Bringing the files home is what added the record.

## Attribution

Interface and Quran typefaces: Amiri and Amiri Quran by the Amiri Project authors; Noto Naskh
Arabic by the Noto Project authors; Tajawal by Boutros International. All four are used under
the SIL Open Font License 1.1; the full text is in `fonts/OFL.txt`.
