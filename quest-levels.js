/* quest-levels.js -- المستويات التجريبيّة لأسئلة الكنوز: سهل · متوسط · صعب (KUNUZ-LEVELS-POETRY-ORDER-2026-10-19، المرحلة ج).
   تحمّله الألعاب الأربع في آخرها. السطر الذي يليه وحده يطفئ التجربة كلّها: false ⟹ لا يُطلب ملف المستويات، ولا يُرسم حقل
   «المستوى» ولا كلمة «تجريبي»، وKZL.ok صادقة لكلّ سؤال، فتعمل كلّ لعبة كما كانت قبلها. وإن تعذّر الملف أو لم يطابق ختمُه
   ختمَ بنك الصفحة (تغيّر البنك بعد التصنيف) بقي الحقل غائبًا بلا خطأ. الاختيار في الذاكرة وحدها: لا يُحفظ، ولا يمسّ سجلّ
   عدم التكرار ولا الإعداد. والصفحة تسأل عنه بـ typeof، فإن غاب هذا الملف نفسه عملت كما كانت. */
var LEVELS_EXPERIMENT=true;
var KZL=(function(){
  var NAMES=["","سهل","متوسط","صعب"],BY_PTS={200:1,400:2,600:3};
  var lv=null,want=0;
  /* want: 0 «كلّ المستويات» (و«عشوائي» في تحدّي الفئات) · 1..3 مستوى واحد · -1 «حسب النقاط» في تحدّي الفئات */
  function ok(i){return !lv||want<1||lv[i]===want}
  function at(i,l){return !lv||!l||lv[i]===l}
  function forPts(p){return lv&&want===-1?(BY_PTS[p]||0):0}
  function name(){return lv&&want>0?NAMES[want]:""}
  /* ما تقوله الصفحة إذا لم يكفِ المستوى المختار (بلا رقم)؛ null إن لم يُختر مستوى، فتقول الصفحة ما كانت تقول */
  function spent(){return lv&&want>0?["مستوى «"+NAMES[want]+"» في فئاتكم لا يكفي","اختاروا فئات أخرى أو مستوى آخر أو صفّروا السجلّ"]:null}
  function boardShort(cat){return "فئة «"+cat+"» لا يكفيها «حسب النقاط» — اختاروا غيرها أو «عشوائي» أو صفّروا السجلّ."}
  function take(L){
    if(!L||typeof L!=="object"||!L.levels||typeof DATA==="undefined"||typeof seenStamp!=="function"||L.stamp!==seenStamp())return;
    var a=[];
    for(var i=0;i<DATA.qs.length;i++){var q=DATA.qs[i];if(q[2]===0){a.push(0);continue}
      var v=L.levels[q[8]];if(v!==1&&v!==2&&v!==3)return;a.push(v)}
    lv=a;paint();
  }
  function css(){
    if(document.getElementById("kzlCss"))return;
    var s=document.createElement("style");s.id="kzlCss";
    s.textContent=".kzl-exp{display:inline-block;margin-inline-start:8px;padding:2px 9px;border-radius:999px;background:#FFF1D6;color:#6B4400;"+
      "border:1px solid #E9C98A;font-size:.78rem;font-weight:600;vertical-align:middle}"+
      ".kzl-chips{display:flex;flex-wrap:wrap;gap:7px}"+
      ".kzl-chip{min-height:44px;min-width:44px;background:var(--sea0,#EAF6FB);border:1px solid var(--line,#BCDFEF);border-radius:999px;"+
      "padding:6px 14px;color:var(--ink,#0B3B54);font:inherit;cursor:pointer}"+
      ".kzl-chip.on{background:var(--azraq,#1B6E9C);border-color:var(--azraq,#1B6E9C);color:#fff}";
    (document.head||document.body).appendChild(s);
  }
  function paint(){
    var slot=document.getElementById("lvSlot");if(!slot)return;
    slot.innerHTML="";if(!lv)return;
    css();
    var board=slot.getAttribute("data-kind")==="board";
    var opts=board?[[0,"عشوائي"],[-1,"حسب النقاط"]]:[[0,"كلّ المستويات"],[1,"سهل"],[2,"متوسط"],[3,"صعب"]];
    var card=document.createElement("div");card.className="card kzl";
    var h=document.createElement("p");h.className="lbl";h.id="kzlLbl";
    var t=document.createElement("span");t.textContent="المستوى";h.appendChild(t);
    var b=document.createElement("span");b.className="kzl-exp";b.textContent="تجريبي";h.appendChild(b);
    card.appendChild(h);
    var sub=document.createElement("p");sub.className="sub";
    sub.textContent=board?"«حسب النقاط»: الخانة الصغرى سهلة، والوسطى متوسطة، والكبرى صعبة — تصنيف أوّليّ قد يخطئ":"تصنيف أوّليّ لسهولة الأسئلة، وقد يخطئ";
    card.appendChild(sub);
    var w=document.createElement("div");w.className="kzl-chips";w.setAttribute("role","group");w.setAttribute("aria-labelledby","kzlLbl");
    opts.forEach(function(o){
      var c=document.createElement("button");c.type="button";c.className="kzl-chip"+(want===o[0]?" on":"");c.textContent=o[1];
      c.setAttribute("aria-pressed",want===o[0]?"true":"false");c.dataset.lv=String(o[0]);
      c.onclick=function(){want=o[0];paint();if(typeof kzlChanged==="function")kzlChanged()};
      w.appendChild(c)});
    card.appendChild(w);slot.appendChild(card);
  }
  function reset(){want=0;paint()}
  function load(){
    if(typeof DATA==="undefined"||typeof seenStamp!=="function")return;
    var s=document.createElement("script");s.src="/quest-data/kunuz-levels-3147.js";s.async=true;
    s.onload=function(){try{take(window.KUNUZ_LEVELS)}catch(e){lv=null}};
    s.onerror=function(){};
    (document.head||document.body).appendChild(s);
  }
  if(LEVELS_EXPERIMENT){try{load()}catch(e){}}
  return {ok:ok,at:at,forPts:forPts,name:name,spent:spent,boardShort:boardShort,paint:paint,reset:reset,on:function(){return !!lv}};
})();
