/* The unchanged Kunuz history and group schema, also used by Hanna local play. */
var SEEN_KEY="kunuz_seen_v1";
var SEEN={stamp:"",bits:[],mem:false};
var B64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function seenStamp(n){
  var h=2166136261;n=n||DATA.qs.length;
  for(var i=0;i<n;i++){var q=DATA.qs[i],s=String(q.length>8?q[8]:q[3])+"\n";
    for(var j=0;j<s.length;j++)h=Math.imul(h^s.charCodeAt(j),16777619)>>>0}
  return n+"-"+("0000000"+h.toString(16)).slice(-8);
}
function b64e(a){var s="";for(var i=0;i<a.length;i+=3){var n=(a[i]<<16)|((a[i+1]||0)<<8)|(a[i+2]||0);
  s+=B64.charAt(n>>18&63)+B64.charAt(n>>12&63)+(i+1<a.length?B64.charAt(n>>6&63):"=")+(i+2<a.length?B64.charAt(n&63):"=")}return s}
function b64d(s){if(typeof s!=="string"||s.length%4)return null;var a=[];
  for(var i=0;i<s.length;i+=4){var c=[],p=0;
    for(var k=0;k<4;k++){var ch=s.charAt(i+k);if(ch==="="){c.push(0);p++}else{var v=B64.indexOf(ch);if(v<0||p)return null;c.push(v)}}
    var n=(c[0]<<18)|(c[1]<<12)|(c[2]<<6)|c[3];a.push(n>>16&255);if(p<2)a.push(n>>8&255);if(p<1)a.push(n&255)}
  return a}
function seenEmpty(){var a=[];for(var i=0;i<Math.ceil(DATA.qs.length/8);i++)a.push(0);return a}
function seenWrite(){
  if(SEEN.mem)return;
  try{window.localStorage.setItem(SEEN_KEY,JSON.stringify({v:1,s:SEEN.stamp,b:b64e(SEEN.bits)}))}catch(e){SEEN.mem=true}
}
function seenRead(){
  if(SEEN.mem)return;
  var raw=null,bits=null;
  try{raw=window.localStorage.getItem(SEEN_KEY)}catch(e){SEEN.mem=true;return}
  var carried=false;
  try{var o=JSON.parse(raw);if(o&&o.v===1){if(o.s===SEEN.stamp)bits=b64d(o.b);else{bits=seenCarry(o);carried=!!bits}}}catch(e){}
  if(bits&&bits.length===SEEN.bits.length){SEEN.bits=bits;if(carried)seenWrite()}
  else{SEEN.bits=seenEmpty();if(raw!==null&&raw!==undefined)seenWrite()}
}
/* الإضافة في آخر القائمة لا تحرّك فهرس سؤال قديم: سجلّ ختمه ختم بادئةٍ من معرّفات اليوم يُرحَّل بدل أن يُطرح */
function seenCarry(o){
  var m=/^(\d+)-[0-9a-f]{8}$/.exec(o&&o.s);if(!m)return null;
  var n=+m[1];if(n<1||n>=DATA.qs.length||seenStamp(n)!==o.s)return null;
  var b=b64d(o.b);if(!b||b.length!==Math.ceil(n/8))return null;
  while(b.length<SEEN.bits.length)b.push(0);return b}
function seenHas(i){return (SEEN.bits[i>>3]>>(i&7)&1)===1}
/* سؤال سُحب من البنك يبقى صفّه بمعرّفه (فلا يتغيّر الختم ولا يُطرح سجلّ أحد)، وحقله الثالث صفر: لا يُسحب ولا يُعدّ */
function kzLive(i){return DATA.qs[i][2]!==0}
function kzLiveN(){var n=0;for(var i=0;i<DATA.qs.length;i++)if(kzLive(i))n++;return n}
/* المستوى التجريبيّ (quest-levels.js): إن غاب أو أُطفئ أو رُفض ملفّه فكلّ سؤال على المستوى المختار، ولا يتغيّر شيء */
function kzLv(i){return typeof KZL==="undefined"||KZL.ok(i)}
function kzLvAt(i,l){return typeof KZL==="undefined"||KZL.at(i,l)}
function seenMark(i){seenRead();SEEN.bits[i>>3]|=1<<(i&7);seenWrite()}
/* any: كلّ المستويات، لزرّ التصفير وحده (يتبع السجلّ لا الاختيار) */
function seenByCat(any){seenRead();var a=DATA.cats.map(function(){return 0});
  for(var i=0;i<DATA.qs.length;i++)if(kzLive(i)&&(any||kzLv(i))&&!seenHas(i))a[DATA.qs[i][0]]++;return a}
function seenLeft(cats,any){var a=seenByCat(any),n=0;a.forEach(function(v,c){if(!cats||cats.indexOf(c)>-1)n+=v});return n}
function seenReset(){SEEN.bits=seenEmpty();if(SEEN.mem)return;
  try{window.localStorage.removeItem(SEEN_KEY)}catch(e){SEEN.mem=true}}
function spentText(){var lv=typeof KZL==="undefined"?null:KZL.spent();if(lv)return lv;
  return seenLeft(null)?["انتهت أسئلة فئاتك","اختر فئات غيرها، أو صفّر السجلّ من شاشة الإعداد"]:
  ["انتهت الأسئلة كلّها","رأيتَها جميعًا — التصفير بيدك في شاشة الإعداد"]}
function seenCard(after){
  var b=$("seenReset");
  $("seenMem").classList.toggle("hidden",!SEEN.mem);
  b.disabled=(seenLeft(null,1)===kzLiveN());b.textContent="صفّر السجلّ";b.dataset.arm="";
  b.onclick=function(){
    if(b.dataset.arm!=="1"){b.dataset.arm="1";b.textContent="متأكّد؟ اضغط ثانيةً للتصفير";return}
    seenReset();seenCard(after);if(after)after()};
}
SEEN.stamp=seenStamp();SEEN.bits=seenEmpty();seenRead();

/* ───── اختيار الفئات: المجموعات الثماني (الكتلة نفسها في الغوص والحرب) ───── */
var KZC_GROUPS=[
 ["القرآن وعلومه",1,["quran","juz-amma","juz-tabarak","tajweed"]],
 ["العقيدة والعبادة",1,["deen","asmaa-husna","prayer","easy-fiqh","adhkar","manners"]],
 ["السنّة والسيرة",1,["hadith","seerah","ghazawat","sahaba","mothers-ahlulbayt","prophets"]],
 ["التاريخ الإسلامي",1,["islamic-history","rashidun","umayyad","abbasid","ayyubid","mamluk","ottoman","muslim-scientists","islamic-architecture"]],
 ["الكويت والخليج",0,["kuwait-history","kuwait-sea-heritage","kuwait-old-life","horses-camels-falcons","palm-plants"]],
 ["اللغة والأدب",0,["arabic-language","poetry-fusha","poetry-nabati","proverbs","riddles-logic"]],
 ["العلوم",0,["physics","chemistry","biology","math","human-body","astronomy","earth-weather","inventions","tech-computing"]],
 ["العالم والحياة",0,["geography","world-history","arab-world","animals","marine-life","fitness-health","first-aid","money-economy","cuisine"]]
];
var KZC={open:-1,g:null};
function kzcGroups(){
  if(KZC.g)return KZC.g;
  var at={},g=KZC_GROUPS.map(function(x){return {n:x[0],r:x[1]===1,c:[]}});
  DATA.cats.forEach(function(c,i){at[c[0]]=i});
  KZC_GROUPS.forEach(function(x,k){x[2].forEach(function(s){if(s in at){g[k].c.push(at[s]);at[s]=-1}})});
  DATA.cats.forEach(function(c,i){if(at[c[0]]!==-1)g[c[2]==="religious"?3:7].c.push(i)});
  return (KZC.g=g);
}

function drawCats(){}
