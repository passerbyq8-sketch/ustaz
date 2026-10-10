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

## Item 110 -- the identity faces (fonts/110/)

Three more families, for the redesign behind the owner switch (item 110). They are declared ONLY in
`ez110/ez110.css`, which the page loads only when a design part is lit for that reader, and no
file here is precached by `sw.js`: a face downloads only for a reader whose chosen identity draws
with it. Fetched 2026-10-10 from the stylesheet fonts.googleapis.com serves a current desktop
Chrome (arabic, latin and latin-ext subsets only; cyrillic and vietnamese dropped). Each family is
SIL Open Font License 1.1, and its own licence text ships beside the files:

    IBM Plex Sans Arabic   fonts/110/OFL-ibmplexsansarabic.txt   (c) 2017 IBM Corp., Reserved Font Name "Plex"
    El Messiri             fonts/110/OFL-elmessiri.txt           (c) 2015 The El Messiri Project Authors
    Readex Pro             fonts/110/OFL-readexpro.txt           (c) 2018 The Readex Pro Project Authors

    License: https://openfontlicense.org (SIL OFL 1.1)

        fonts/110/K2F0fZBRmr9vQ1pHEey6MoiAAhLz.woff2                    22280  arabic, weight 500  El Messiri  sha256 970b721e9b094fe85c6b9049e0e53ee27cd27ec6d3b7b324c8e731a574343132
        fonts/110/K2F0fZBRmr9vQ1pHEey6MoOAAhLz.woff2                     3156  latin-ext, weight 500  El Messiri  sha256 f6519abb686fba5ce9f15a39b057fb3733f79e05205c025f794e1e052a0e6357
        fonts/110/K2F0fZBRmr9vQ1pHEey6Mo2AAg.woff2                      23632  latin, weight 500  El Messiri  sha256 1a859701b2de3899c0a4bd329cdae9555e2d3548ef389277ec8a55a8c2680c4b
        fonts/110/K2F0fZBRmr9vQ1pHEey6MoiAAhLz.woff2                    22280  arabic, weight 600  El Messiri  sha256 970b721e9b094fe85c6b9049e0e53ee27cd27ec6d3b7b324c8e731a574343132
        fonts/110/K2F0fZBRmr9vQ1pHEey6MoOAAhLz.woff2                     3156  latin-ext, weight 600  El Messiri  sha256 f6519abb686fba5ce9f15a39b057fb3733f79e05205c025f794e1e052a0e6357
        fonts/110/K2F0fZBRmr9vQ1pHEey6Mo2AAg.woff2                      23632  latin, weight 600  El Messiri  sha256 1a859701b2de3899c0a4bd329cdae9555e2d3548ef389277ec8a55a8c2680c4b
        fonts/110/K2F0fZBRmr9vQ1pHEey6MoiAAhLz.woff2                    22280  arabic, weight 700  El Messiri  sha256 970b721e9b094fe85c6b9049e0e53ee27cd27ec6d3b7b324c8e731a574343132
        fonts/110/K2F0fZBRmr9vQ1pHEey6MoOAAhLz.woff2                     3156  latin-ext, weight 700  El Messiri  sha256 f6519abb686fba5ce9f15a39b057fb3733f79e05205c025f794e1e052a0e6357
        fonts/110/K2F0fZBRmr9vQ1pHEey6Mo2AAg.woff2                      23632  latin, weight 700  El Messiri  sha256 1a859701b2de3899c0a4bd329cdae9555e2d3548ef389277ec8a55a8c2680c4b
        fonts/110/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6Ys43PWrfQ.woff2      42848  arabic, weight 400  IBM Plex Sans Arabic  sha256 6010e7fd0dce5d527583951750728cbe3c895efbd16aa0f809ab8c824878c9d8
        fonts/110/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6Ysz3PWrfQ.woff2       6656  latin-ext, weight 400  IBM Plex Sans Arabic  sha256 1935fa1a3326fcd48e20abe864bb30ace43fe58bd572f354c24271ea66208e04
        fonts/110/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6Ys93PU.woff2         19164  latin, weight 400  IBM Plex Sans Arabic  sha256 9ed8dcb02e6c7246de4c120295fafa39a7bb73085f4951a4524a07dc911069f2
        fonts/110/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPO_-CRXMR5Kw.woff2  45296  arabic, weight 500  IBM Plex Sans Arabic  sha256 90aef64fea9794f232332e907d45810ab268d1a11721340025eba2a2cdb36d5c
        fonts/110/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPO_-CaXMR5Kw.woff2   6540  latin-ext, weight 500  IBM Plex Sans Arabic  sha256 ae5c1a58c18d253e20691f00e401319f01fc568d24d0e50165f276d1a99035b5
        fonts/110/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPO_-CUXMQ.woff2     20088  latin, weight 500  IBM Plex Sans Arabic  sha256 be6a3b2e37f3ad67aa822a55ce356d28c416331c97530a1ec076c2118240ca2d
        fonts/110/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPi-OCRXMR5Kw.woff2  45688  arabic, weight 600  IBM Plex Sans Arabic  sha256 16734a5adb27b0f363e566cbbeacec480da0dc0baa19c8f0053251c2e2bc0eac
        fonts/110/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPi-OCaXMR5Kw.woff2   6680  latin-ext, weight 600  IBM Plex Sans Arabic  sha256 0f7c03bb523b8084a84c4b7d95a5c7b294b7318f88b2e51829d5fe7aaef0d0bb
        fonts/110/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPi-OCUXMQ.woff2     20500  latin, weight 600  IBM Plex Sans Arabic  sha256 63f4757271e403f7baec0862f284ffaa4560ea6096ba9fe8bc6e585ca656e724
        fonts/110/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YOG-eCRXMR5Kw.woff2  44280  arabic, weight 700  IBM Plex Sans Arabic  sha256 04c730b4292731ccedadd5bd80756124364ae4923895145d9cd7b1f28e443de1
        fonts/110/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YOG-eCaXMR5Kw.woff2   6564  latin-ext, weight 700  IBM Plex Sans Arabic  sha256 ab0b9584271f492336d9eadcef96f99b0da07e8e7046220aea5084f1644a9c9d
        fonts/110/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YOG-eCUXMQ.woff2     19504  latin, weight 700  IBM Plex Sans Arabic  sha256 ae2d59f91ecf9f7ed279e4a1fc1a9da8170fb0ce5b9152917a8f759033f5777c
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2Iw1ZEzMhQ.woff2  22864  arabic, weight 300  Readex Pro  sha256 b5815b71c48e513b5e65eb281dd53e5d6a556d6dac511a5d2cd00d628850d5c4
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2Iw-ZEzMhQ.woff2  27684  latin-ext, weight 300  Readex Pro  sha256 51456344445b98029b9be92e7cbfbb0232054308b30d8ca771f9671fa861606b
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2IwwZEw.woff2     31428  latin, weight 300  Readex Pro  sha256 7074eeb987a25349069ed5c784e204904b928f4c878e9c3c88d636c01081ae52
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2Iw1ZEzMhQ.woff2  22864  arabic, weight 400  Readex Pro  sha256 b5815b71c48e513b5e65eb281dd53e5d6a556d6dac511a5d2cd00d628850d5c4
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2Iw-ZEzMhQ.woff2  27684  latin-ext, weight 400  Readex Pro  sha256 51456344445b98029b9be92e7cbfbb0232054308b30d8ca771f9671fa861606b
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2IwwZEw.woff2     31428  latin, weight 400  Readex Pro  sha256 7074eeb987a25349069ed5c784e204904b928f4c878e9c3c88d636c01081ae52
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2Iw1ZEzMhQ.woff2  22864  arabic, weight 500  Readex Pro  sha256 b5815b71c48e513b5e65eb281dd53e5d6a556d6dac511a5d2cd00d628850d5c4
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2Iw-ZEzMhQ.woff2  27684  latin-ext, weight 500  Readex Pro  sha256 51456344445b98029b9be92e7cbfbb0232054308b30d8ca771f9671fa861606b
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2IwwZEw.woff2     31428  latin, weight 500  Readex Pro  sha256 7074eeb987a25349069ed5c784e204904b928f4c878e9c3c88d636c01081ae52
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2Iw1ZEzMhQ.woff2  22864  arabic, weight 600  Readex Pro  sha256 b5815b71c48e513b5e65eb281dd53e5d6a556d6dac511a5d2cd00d628850d5c4
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2Iw-ZEzMhQ.woff2  27684  latin-ext, weight 600  Readex Pro  sha256 51456344445b98029b9be92e7cbfbb0232054308b30d8ca771f9671fa861606b
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2IwwZEw.woff2     31428  latin, weight 600  Readex Pro  sha256 7074eeb987a25349069ed5c784e204904b928f4c878e9c3c88d636c01081ae52
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2Iw1ZEzMhQ.woff2  22864  arabic, weight 700  Readex Pro  sha256 b5815b71c48e513b5e65eb281dd53e5d6a556d6dac511a5d2cd00d628850d5c4
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2Iw-ZEzMhQ.woff2  27684  latin-ext, weight 700  Readex Pro  sha256 51456344445b98029b9be92e7cbfbb0232054308b30d8ca771f9671fa861606b
        fonts/110/SLXYc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2IwwZEw.woff2     31428  latin, weight 700  Readex Pro  sha256 7074eeb987a25349069ed5c784e204904b928f4c878e9c3c88d636c01081ae52
