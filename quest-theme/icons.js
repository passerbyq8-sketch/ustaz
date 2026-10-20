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
};let uid=0;function icon(k){let id=++uid;return `<svg viewBox="0 0 100 100" width="100%" height="100%" fill="none"><defs><linearGradient id="g${id}" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="#fff4bd"/><stop offset=".55" stop-color="#ffcd73"/><stop offset="1" stop-color="#dba044"/></linearGradient><linearGradient id="p${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffd1ac"/><stop offset=".6" stop-color="#ed956f"/><stop offset="1" stop-color="#a64a61"/></linearGradient></defs>${(paths[k]||paths.compass).replaceAll('url(#g)',`url(#g${id})`).replaceAll('url(#p)',`url(#p${id})`)}</svg>`}

const shapes = [
 '<path d="M50 4 95 50 50 96 5 50Z"/>',
 '<path d="M50 5 96 91H4Z"/>',
 '<circle cx="50" cy="50" r="42"/>',
 '<rect x="9" y="9" width="82" height="82" rx="8"/>',
 '<path d="m50 3 14 30 33 5-24 23 6 34-29-16-29 16 6-34L3 38l33-5Z"/>',
 '<path d="M35 4h30v31h31v30H65v31H35V65H4V35h31Z"/>'
];
function symbol(i) { return '<svg viewBox="0 0 100 100" aria-hidden="true">' + shapes[i % shapes.length] + '</svg>'; }
const categoryKinds = ['book','medal','book','book','book','medal','cards','medal','medal','compass','map','compass','book','bolt','flask','flask','compass','book','medal','cards','medal','compass','cards','medal','map','compass','flask','book','cards','medal','book','cards','wave','home','wave','planet','sun','flask','compass','bolt','flask','medal','medal','medal','compass','bolt','home','book','book','cards','book','sun','book'];
function category(slug, index) {
 const kind = categoryKinds[index] || (/map|places/.test(slug)?'map':/calendar/.test(slug)?'sun':/chemistry|physics/.test(slug)?'flask':/books|calligraphy|letter|proverb/.test(slug)?'book':/pattern|sequence|connection/.test(slug)?'cards':'compass');
 // A separate geometric seal for every category; all shapes are inanimate.
 const bits = (index + 1).toString(2).padStart(7,'0');
 const seal = '<g stroke="#fff1c3" stroke-width="2.5" fill="#dba044">' + Array.from(bits,(b,i)=> b==='1'?'<path d="M'+(13+i*11)+' 94v-7"/>':'<circle cx="'+(13+i*11)+'" cy="91" r="1.8"/>').join('') + '</g>';
 return icon(kind).replace('</svg>',seal+'</svg>');
}
global.KunuzIcons = Object.freeze({ icon, symbol, category });

})(window);
