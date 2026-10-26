/* Icons from the supplied Treasure Journey reference; distinct gradient IDs per render. */
(function(global){
const paths={
 compass:`<circle cx="50" cy="51" r="38" fill="#6044a2"/><circle cx="50" cy="47" r="38" fill="url(#g)" stroke="#fff1c3" stroke-width="3"/><circle cx="50" cy="47" r="28" fill="#6059a5" stroke="#fff1c3" stroke-width="2"/><path d="M65 28L56 56L34 68L43 39Z" fill="#fff1d4"/><path d="M65 28L56 56L43 39Z" fill="#f48d6c"/><circle cx="50" cy="47" r="5" fill="#ffcf6d"/>`,
 cards:`<rect x="21" y="23" width="52" height="66" rx="13" transform="rotate(-16 40 50)" fill="#7c3d43" stroke="#faab81" stroke-width="3"/><rect x="32" y="10" width="52" height="70" rx="13" transform="rotate(10 60 40)" fill="url(#g)" stroke="#fff1c3" stroke-width="3"/><path d="M44 31H70M44 44H64M44 57H59" stroke="#a76e43" stroke-width="5" stroke-linecap="round"/>`,
 bolt:`<path d="M53 9L22 56H45L40 92L81 40H56L65 9Z" fill="#9b6225" transform="translate(0 5)"/><path d="M53 9L22 56H45L40 92L81 40H56L65 9Z" fill="url(#g)" stroke="#fff2bb" stroke-width="3"/>`,
 medal:`<path d="M24 52L20 94L46 77L65 94L72 51Z" fill="#39aaab"/><circle cx="48" cy="40" r="32" fill="url(#g)" stroke="#fff0bd" stroke-width="3"/><path d="M48 20L54 32L68 34L58 44L60 58L48 51L35 58L38 44L28 34L42 32Z" fill="#b27b31"/>`,
 map:`<path d="M12 25L37 15L65 26L89 16V77L64 88L37 77L12 88Z" fill="#84d9ca" stroke="currentColor" stroke-width="5"/><path d="M37 15V77M65 26V88" stroke="#278c90" stroke-width="3"/><path d="M27 55Q54 30 76 59" stroke="#fff4c7" stroke-width="4" stroke-dasharray="6 6" fill="none"/>`,
 home:`<path d="M13 46L50 14L87 46V87H60V61H40V87H15Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>`,
 planet:`<circle cx="50" cy="49" r="30" fill="url(#p)"/><ellipse cx="50" cy="50" rx="47" ry="12" transform="rotate(-25 50 50)" fill="none" stroke="#ffeab4" stroke-width="6"/><circle cx="39" cy="35" r="7" fill="#e6846d"/><circle cx="60" cy="53" r="8" fill="#c9615c"/><circle cx="51" cy="67" r="4" fill="#efb29b"/>`,
 book:`<path d="M12 22Q33 14 50 26Q68 14 88 22V79Q66 70 50 82Q32 70 12 79Z" fill="#fff1bd" stroke="#e3bb65" stroke-width="4"/><path d="M50 26V82M23 36H39M62 36H78M23 49H39M62 49H78" stroke="#9b8054" stroke-width="3"/>`,
 flask:`<path d="M35 12H65M40 14V43L17 78Q12 90 28 90H73Q88 90 81 78L59 43V14" fill="none" stroke="#b8ffe9" stroke-width="7" stroke-linecap="round"/><path d="M30 61H70L82 82Q83 86 73 86H28Q18 86 21 81Z" fill="#58d3ba"/><circle cx="49" cy="70" r="5" fill="#eeffe2"/>`,
 wave:`<path d="M8 62Q30 80 45 54Q62 14 83 36Q64 30 65 48Q74 60 92 54Q89 82 58 84Q30 88 8 73Z" fill="#a7f3ed" stroke="#d8fff6" stroke-width="3"/>`,
 sun:`<circle cx="50" cy="50" r="24" fill="#ffe9a7"/><path d="M50 5V16M50 84V95M5 50H16M84 50H95M18 18L26 26M74 74L82 82M18 82L26 74M74 26L82 18" stroke="#ffe9a7" stroke-width="7" stroke-linecap="round"/>`
};let uid=0;function icon(k){let id=++uid;return `<svg viewBox="0 0 100 100" width="100%" height="100%" fill="none"><defs><linearGradient id="kunuz-icon-g${id}" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="#fff4bd"/><stop offset=".55" stop-color="#ffcd73"/><stop offset="1" stop-color="#dba044"/></linearGradient><linearGradient id="kunuz-icon-p${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffd1ac"/><stop offset=".6" stop-color="#ed956f"/><stop offset="1" stop-color="#a64a61"/></linearGradient></defs>${(paths[k]||paths.compass).replaceAll('url(#g)',`url(#kunuz-icon-g${id})`).replaceAll('url(#p)',`url(#kunuz-icon-p${id})`)}</svg>`}

const shapes = [
 '<path d="M50 4 95 50 50 96 5 50Z"/>',
 '<path d="M50 5 96 91H4Z"/>',
 '<circle cx="50" cy="50" r="42"/>',
 '<rect x="9" y="9" width="82" height="82" rx="8"/>',
 '<path d="m50 3 14 30 33 5-24 23 6 34-29-16-29 16 6-34L3 38l33-5Z"/>',
 '<path d="M35 4h30v31h31v30H65v31H35V65H4V35h31Z"/>'
];
function symbol(i) { return '<svg viewBox="0 0 100 100" aria-hidden="true">' + shapes[i % shapes.length] + '</svg>'; }
// Every category has a different main silhouette tied to its meaning. Objects,
// buildings and abstract marks only: no people, animals, faces or plants.
const categoryArt = {
 deen: '<path d="M18 85V43l15-12 15 12v42M52 85V55q15-27 30 0v30M12 85h78M24 48h18M26 59h14M60 70h14"/><path d="M66 13a12 12 0 1 0 15 15 16 16 0 0 1-15-15Z"/>',
 prayer: '<path d="M22 14h56v72H22Z"/><path d="M30 70V45l20-21 20 21v25ZM30 77h40M22 8v6m14-6v6m14-6v6m14-6v6m14-6v6M22 86v6m14-6v6m14-6v6m14-6v6m14-6v6"/>',
 quran: '<path d="M12 28q20-12 38 0 18-12 38 0v35q-20-10-38 1-18-11-38-1ZM50 28v36M24 79l51-10M25 69l51 12M33 83l17-19 17 19"/><path d="m29 35 6 7-6 7-6-7ZM65 34v17m-6-8h12"/>',
 'juz-amma': '<path d="M22 13h43l13 14v60H22ZM65 13v17h13M33 42h28M33 53h18M33 66h28"/><path d="m42 13 0 22 8-6 8 6V13"/>',
 'juz-tabarak': '<path d="M20 21h42v64H20ZM38 13h42v63H62M29 33h24M29 44h19M70 24v23"/><circle cx="41" cy="65" r="10"/>',
 adhkar: '<circle cx="50" cy="18" r="7"/><circle cx="72" cy="26" r="7"/><circle cx="80" cy="48" r="7"/><circle cx="72" cy="70" r="7"/><circle cx="50" cy="78" r="7"/><circle cx="28" cy="70" r="7"/><circle cx="20" cy="48" r="7"/><circle cx="28" cy="26" r="7"/><path d="M50 85v9m-6-5 6-4 6 4"/>',
 prophets: '<path d="M20 17h54q14 0 14 12H32Q18 29 18 17q-7 2-7 12v43h57q14 0 14 12H25q-14 0-14-12M32 29v43M82 29v44"/><path d="M44 61q24 1 12-15t15-7M42 38h7"/>',
 seerah: '<path d="M34 29h32l8 49H26ZM30 78h40v9H30ZM34 29l16-15 16 15M43 12V6h14v6M44 42h12v23H44Z"/><path d="M8 80h7m65-30h9M15 43h8"/>',
 manners: '<path d="M50 17v62M30 87h40M24 29h52M20 29 9 58h22ZM80 29 69 58h22Z"/><circle cx="50" cy="21" r="8"/><path d="M9 58q11 18 22 0M69 58q11 18 22 0"/>',
 'islamic-history': '<path d="M12 80h76M17 78V56h18V43h30v13h18v22M40 43q10-27 20 0M24 21v26m0-26h24l-7 7 7 7H24"/><path d="M18 88h8m12 0h8m12 0h8m12 0h8"/>',
 geography: '<circle cx="50" cy="47" r="33"/><ellipse cx="50" cy="47" rx="14" ry="33"/><path d="M17 47h66M23 30h54M23 64h54M50 80v10M32 91h36"/>',
 'world-history': '<path d="M24 12h52M24 88h52M30 12v16q0 10 20 22-20 12-20 22v16M70 12v16q0 10-20 22 20 12 20 22v16M33 25h34M35 77l15-14 15 14Z"/>',
 animals: '<path d="M14 83V34l10-12 10 12v49M40 83V34l10-12 10 12v49M66 83V34l10-12 10 12v49M10 44h80M10 69h80"/>',
 physics: '<path d="M17 18h66M25 18l25 48M75 18 50 66"/><circle cx="50" cy="71" r="12"/><path d="M10 65q-1-20 10-31M9 35l11-1 2 11M80 34q12 12 11 31"/>',
 biology: '<path d="m37 17 12-8 22 33-12 8ZM48 45l-9 7M61 48q29 4 17 27M31 76h48M23 89h62M40 76V56H27M64 76v13"/><path d="m27 57 9-7 9 13-9 7Z"/>',
 chemistry: '<path d="M34 11h32M40 12v29L18 78q-8 12 9 12h46q17 0 9-12L60 41V12M29 64h43"/><circle cx="44" cy="75" r="4"/><circle cx="58" cy="56" r="3"/>',
 math: '<path d="M15 82 15 17 80 82ZM28 69V47l22 22ZM44 15h40v17H44ZM54 15v8m10-8v6m10-6v8M10 90h80"/>',
 hadith: '<path d="M14 18h48v31H33L21 61V49h-7ZM39 58h47v27H69L57 95V85H39M23 28h29M23 38h18M49 68h26M49 77h17"/>',
 rashidun: '<path d="M10 83h80M16 79V36h13v43M35 79V27h13v52M54 79V27h13v52M73 79V36h13v43M12 36h21M31 27h21M50 27h21M69 36h21M15 19 50 8 85 19Z"/>',
 umayyad: '<path d="M12 85h76M19 85V37h18v48M63 85V37h18v48M14 37h28L28 16ZM58 37h28L72 16ZM37 85V56q13-24 26 0v29M24 48h8M68 48h8"/>',
 abbasid: '<circle cx="50" cy="50" r="36"/><circle cx="50" cy="50" r="23"/><path d="M50 14v13M50 73v13M14 50h13M73 50h13M25 25l9 9M66 66l9 9M25 75l9-9M66 34l9-9M42 60V44h16v16Z"/>',
 ayyubid: '<path d="M13 85V34h10v10h10V28h10v16h14V28h10v16h10V34h10v51ZM37 85V66q13-22 26 0v19M13 58h20M67 58h20"/>',
 mamluk: '<path d="M36 87h28M40 87V63h20v24M34 63v-9h32v9M42 54V35h16v19M37 35v-8h26v8M45 27V15l5-8 5 8v12M40 75h20"/>',
 ottoman: '<path d="M23 74 33 26h40l8 48q-29 19-58 0ZM33 26q20-12 40 0M25 67q28 16 55 0M56 22q-3 18 17 26M72 46v17m-5-5 5 5 5-5"/>',
 'arab-world': '<path d="M9 76q18-26 39-4 23-28 43-2M9 85h82M17 60l25-27 20 27M52 47l17-22 22 35M66 14l5-6 5 6-5 6Z"/>',
 'kuwait-history': '<path d="M10 67h79L75 84H28ZM48 15v52M46 20 17 59h29ZM54 30l24 29H54ZM9 92q11-8 22 0 11-8 22 0 11-8 22 0 11-8 18 0"/>',
 cuisine: '<path d="M23 37h54v35q0 13-14 13H37q-14 0-14-13ZM16 37h68M39 27h22M44 20h12v7M23 46H10v15h13M77 46h13v15H77"/>',
 'poetry-fusha': '<path d="M18 69h31v19H18ZM22 61h23v8H22M37 59 65 14l13 9-31 43ZM62 19l10 7M51 74q20-17 31-9t-6 20"/>',
 'poetry-nabati': '<path d="M10 75 50 16 90 75ZM50 16v59M38 75l12-27 12 27M16 85h68M25 91h50"/><path d="m26 49 9 5m30 0 9-5"/>',
 'fitness-health': '<path d="M9 35h12v30H9ZM21 27h13v46H21ZM34 44h32v12H34ZM66 27h13v46H66ZM79 35h12v30H79Z"/>',
 'arabic-language': '<path d="M18 75h55q12 0 12-13V36M28 62l-9-11 24-13M43 38l6-16M57 56h15M33 84h8m9 0h8"/>',
 proverbs: '<path d="M46 10h9v80M13 22h54l16 14-16 14H13ZM84 57H32L17 70l15 13h52Z"/>',
 'kuwait-sea-heritage': '<circle cx="50" cy="19" r="10"/><path d="M50 29v54M29 43h42M15 63q1 26 35 22 34 4 35-22M9 69l6-9 10 5M75 65l10-5 6 9"/>',
 'kuwait-old-life': '<path d="M22 91V32q0-22 28-22t28 22v59ZM50 14v77M31 27v55M69 27v55M22 42h56M22 68h56"/><circle cx="43" cy="55" r="3"/><circle cx="57" cy="55" r="3"/>',
 'marine-life': '<path d="M32 11h36v14H32ZM36 25v13L23 49v38h54V49L64 38V25M23 59q13-9 27 0 13-9 27 0M23 72q13-9 27 0 13-9 27 0"/><circle cx="45" cy="45" r="3"/>',
 astronomy: '<path d="m17 29 56-17 10 29-56 17ZM67 14l9 29M21 27l10 31M51 52v15M51 67 29 91M51 67l22 24M51 67v24M13 68h8m-4-4v8"/>',
 'earth-weather': '<path d="M27 63q-26 0-20-19 4-11 18-8 4-28 29-18 13 5 13 18 24-2 25 14t-22 14ZM25 75l-5 13M47 75l-5 13M69 75l-5 13"/>',
 'human-body': '<rect x="14" y="16" width="72" height="56" rx="6"/><path d="M22 46h12l7-17 12 32 9-20 6 5h10M50 72v14M32 87h36"/>',
 'muslim-scientists': '<circle cx="50" cy="51" r="33"/><circle cx="50" cy="51" r="23"/><path d="M50 18V8M44 8h12M18 51h64M50 18v66M29 74l42-46M31 31l38 39"/><circle cx="50" cy="51" r="6"/>',
 inventions: '<path d="M35 65q-17-14-13-31 5-24 28-24t28 24q4 17-13 31v11H35ZM36 82h28M41 89h18M41 37l9 12 9-12M50 49v16"/>',
 'palm-plants': '<path d="M26 40h45v42H26ZM26 54 12 44 5 51 26 72M69 42q21-27 21 3T71 64M34 40V22h27v18M40 16V8m15 8V8"/>',
 'horses-camels-falcons': '<path d="M31 15h13v16q-18 4-18 23 0 31 24 31t24-31q0-19-18-23V15h13q20 12 20 39 0 43-39 43T11 54q0-27 20-39Z"/><path d="M24 42h7M20 58h7M27 76h7M69 42h7M73 58h7M66 76h7"/>',
 'first-aid': '<rect x="12" y="31" width="76" height="55" rx="8"/><path d="M35 31V17h30v14M43 43h14v12h12v14H57v12H43V69H31V55h12Z"/>',
 'money-economy': '<ellipse cx="28" cy="69" rx="17" ry="7"/><path d="M11 69v16q17 13 34 0V69M11 77q17 13 34 0M55 85V56h12v29M75 85V38h12v47M14 48l23-17 16 10 29-26M69 15h13v13"/>',
 'riddles-logic': '<path d="M15 22h25q-6-16 10-16t10 16h25v25q-16-6-16 10t16 10v20H60q6-16-10-16T40 87H15V65q16 6 16-10T15 45Z"/>',
 'tech-computing': '<path d="M18 18h64v49H18ZM10 76h80l-8 11H18ZM24 25h52v34H24M39 76h22M37 36l-8 7 8 7M63 36l8 7-8 7M55 31 45 55"/>',
 'islamic-architecture': '<path d="M16 89V14h68v75M29 89V53q0-15 21-25 21 10 21 25v36M10 89h80M16 21h68M16 79h13m42 0h13M40 60l10-10 10 10-10 10Z"/>',
 sahaba: '<circle cx="35" cy="35" r="21"/><circle cx="65" cy="35" r="21"/><circle cx="35" cy="65" r="21"/><circle cx="65" cy="65" r="21"/>',
 'mothers-ahlulbayt': '<path d="M12 43 50 11 88 43M22 37v48h56V37M34 85V55h32v30M40 30l10-8 10 8-10 8Z"/>',
 ghazawat: '<path d="M50 12 77 24v31q0 21-27 36-27-15-27-36V24ZM10 18l30 32M7 28l15-14M60 50l30-32M79 14l15 14M38 70l24-28M38 42l24 28"/>',
 tajweed: '<path d="M14 20h38v64H14ZM24 32h18M24 44h12M24 56h18M24 68h12M62 39q14 11 0 22M71 28q28 22 0 44M80 17q41 33 0 66"/>',
 'asmaa-husna': '<path d="m50 8 12 15 20-5-3 22 14 10-14 12 3 20-22-3-10 14-12-14-20 3 3-22L7 50l14-12-3-20 22 3Z"/><path d="m50 29 21 21-21 21-21-21Z"/><circle cx="50" cy="50" r="8"/>',
 'easy-fiqh': '<path d="M36 24h27v12q18 9 18 30 0 23-31 23T19 66q0-21 17-30ZM36 24v-9h27v9M21 52 8 35l-4 7 15 29M75 43q20-9 18 10T81 72M38 10h22M42 48h17"/>',
 'map-quiz': '<path d="m10 26 25-10 29 11 26-11v61L64 88 35 77 10 88ZM35 16v61M64 27v61"/><path d="M65 43q0 13-15 26-15-13-15-26a15 15 0 0 1 30 0Z"/><circle cx="50" cy="43" r="5"/>',
 'emoji-quiz': '<path d="M12 16h76v57H49L29 90V73H12Z"/><path d="m33 28 8 13-8 13-8-13ZM57 32h18v18H57ZM33 62h40"/>',
 'landmark-draw': '<path d="M15 84V32h15v52M70 84V32h15v52M10 32l13-19 12 19M65 32l13-19 12 19M30 62q20-28 40 0M10 84h80M38 72h24M10 9v12M10 9h12M90 9H78M90 9v12"/>',
 silhouette: '<path d="M58 69 31 42a18 18 0 1 1 14-14l27 27-5 5 9 9-9 9-9-9Z" fill="#143b45"/><circle cx="26" cy="23" r="6"/><path d="m43 86 32-5 17 7-32 5Z" fill="#dba044"/>',
 'pattern-iq': '<rect x="12" y="12" width="25" height="25" rx="3"/><circle cx="70" cy="24" r="14"/><path d="m24 53 15 30H9ZM55 57h30v30H55ZM45 17v66M13 46h72"/>',
 'kuwait-places': '<path d="M27 90V20M59 90V13M81 90V37M10 90h81M22 15l5-9 5 9M54 8l5-7 5 7"/><circle cx="27" cy="48" r="13"/><circle cx="59" cy="36" r="15"/><circle cx="59" cy="65" r="9"/>',
 'gulf-cuisine': '<path d="M39 29h25v12q12 17 9 34-10 17-37 8-10-6-6-24L14 35l-7 5 20 32M64 35q27-9 22 13T73 66M40 29l12-15 11 15M45 12h12M48 8h6"/><path d="M6 77h13v14H6Z"/>',
 'occasions-calendar': '<rect x="14" y="20" width="72" height="67" rx="7"/><path d="M14 38h72M31 10v21M69 10v21M25 50h10M25 64h10M25 77h10M60 48a15 15 0 1 0 15 17 19 19 0 0 1-15-17Z"/>',
 'ancient-civilizations': '<path d="M9 86 43 31 77 86ZM43 31v55M25 78h42M20 68h49M62 18h25v9H62ZM68 27h13v51H68M63 78h24v8H63M73 18V9"/>',
 'calligraphy-arts': '<path d="m49 17 23 13-15 35-21 12-3-25ZM49 17l9-13 23 13-9 13M36 77l17-33M33 85q-23 11-20-7 1-13 19-9M54 85q17 12 32-1"/>',
 'books-authors': '<path d="M18 22h60v17H18q-9-9 0-17ZM25 43h60v17H25q-9-9 0-17ZM14 64h60v20H14q-9-10 0-20ZM56 22v29l8-7 8 7V22M25 72h34M38 51h11"/>',
 'physics-chemistry': '<path d="M18 13h24M24 13v27L9 70q-5 10 7 10h29q11 0 6-10L36 40V13M16 60h29M55 30h12V15h20v15M55 30v37h32V54M63 67v18M78 67v18M59 85h23"/><path d="m76 35-9 11h9l-3 10 12-14h-9Z"/>',
 etiquette: '<path d="M8 69h84M14 75h72l-8 11H22ZM25 62V27h23v35ZM23 27h28M55 62V16h19v30q16-1 15 8t-15 8M55 28h19M58 10h14"/>',
 'gulf-history': '<path d="M12 85V41h20v44M68 85V41h20v44M32 85V56h36v29M9 41v-9h8v9h9v-9h8v9M66 41v-9h8v9h9v-9h8v9M43 85V70h14v15M50 56V13h25l-8 8 8 8H50"/>',
 'historical-events': '<image href="/quest-theme/assets/tile-historical-events.svg?v=20261026-kfix5" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/>',
 'landmark-photos': '<image href="/quest-theme/assets/tile-landmark-photos.svg?v=20261026-kfix5" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/>',
 'fmt-proverb-cloze': '<path d="M12 22h76v24H12ZM12 59h27v24H12ZM49 59h39v24H49M22 33h45M22 71h8M60 71h16M74 53v-3"/><path d="m46 48 4 7 4-7"/>',
 'fmt-missing-letter': '<rect x="8" y="27" width="23" height="42" rx="3"/><rect x="69" y="27" width="23" height="42" rx="3"/><path d="M40 27h20M40 69h20M40 35v8m20-8v8M40 53v8m20-8v8M15 40h9M76 55h9M42 87l5-13h9l5 13Z"/>',
 'fmt-scramble': '<path d="m12 22 23-8 8 23-23 8ZM64 14l23 8-8 23-23-8ZM20 59h24v24H20ZM60 60l24-6 6 24-24 6ZM14 50q30 11 70-2M74 42l10 6-7 9"/>',
 'fmt-connection': '<rect x="8" y="10" width="28" height="23" rx="4"/><rect x="64" y="10" width="28" height="23" rx="4"/><rect x="36" y="69" width="28" height="23" rx="4"/><path d="m23 33 20 20M77 33 57 53M50 58v11M16 20h12M72 20h12M43 80h14"/><circle cx="50" cy="52" r="10"/>',
 'fmt-sequence': '<path d="M10 87V69h22V49h22V29h22V11h14M10 87h80M17 58l12-13 18-5 20-23M57 17h10v10"/>'
};
for (const [slug, art] of Object.entries(categoryArt)) paths['category:' + slug] = '<g stroke="#fff1c3" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="url(#g)">' + art + '</g>';
function category(slug) {
 if (!Object.hasOwn(categoryArt, slug)) throw new Error('Missing category icon: ' + slug);
 return icon('category:' + slug);
}
global.KunuzIcons = Object.freeze({ icon, symbol, category });

})(window);
