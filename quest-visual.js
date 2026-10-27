/* Local supplemental packs and the shared question renderer. No bank bytes change.
   Pack files are JSON inside KZV.register(...); they are parsed, never executed. */
var PACKS_ENABLED=true;
var KZV=(function(){
  "use strict";
  var NS="http://www.w3.org/2000/svg",baseN=DATA.qs.length,baseC=DATA.cats.length;
  var installed=false,slugs=Object.create(null),ids=Object.create(null),historyIds=Object.create(null),volatile=false;
  var HISTORY="kunuz_pack_seen_v1",active=null,serial=0,renderSerial=0,geoPromise=null,photoObserver=null,photoCache=new Map(),photoQueue=[],photoQueueKeys=new Set(),photoQueueBusy=false;
  var SHAPES=["circle","square","triangle","diamond","pentagon","hexagon","star","cross"];
  var SHAPE_NAMES=["دائرة","مربع","مثلث","معين","خماسي","سداسي","نجمة","صليب هندسي"];
  var TURNS=["بلا تدوير","مدار ثمن دورة","مدار ربع دورة","مدار ثلاثة أثمان دورة","مدار نصف دورة","مدار خمسة أثمان دورة","مدار ثلاثة أرباع دورة","مدار سبعة أثمان دورة"];
  var COUNTS=["","شكل واحد","شكلان","ثلاثة أشكال","أربعة أشكال"];
  var OBJECTS=Array.from("🗻🍣🏔🧀⌚🍫🕰🎡🚇☔🧮📐📖🔑🗝🏠🏡🏢🏣🏤🏥🏦🏨🏪🏫🏬🏭🏯🏰🕌🕍⛩⛪🕋⛲⛺🌁🌃🌄🌅🌆🌇🌉🌌🌋🗺🧭🏖🏜🏝🏞🌍🌎🌏🌐🌑🌒🌓🌔🌕🌖🌗🌘🌙☀⭐🌟🌠☁⛅⛈🌤🌥🌦🌧🌨🌩🌪🌫🌈☂❄☃⛄🔥💧🌊🌱🌲🌳🌴🌵🌾🌿🍀🍁🍂🍃🍄🌷🌹🌺🌻🌼🌸💐🍇🍈🍉🍊🍋🍌🍍🍎🍏🍐🍑🍒🍓🥝🍅🥑🍆🥔🥕🌽🌶🥒🥦🧄🧅🥬🥜🌰🍞🥐🥖🥨🥯🥞🧇🧈🍔🍟🍕🌭🥪🌮🌯🥙🍳🥘🍲🥣🥗🍿🍱🍘🍙🍚🍛🍜🍝🍠🍢🍡🍧🍨🍦🥧🍰🎂🍮🍭🍬🍯🥛☕🍵🫖🥤🧃🧊🍽🍴🥄🔪🏺🚗🚕🚙🚌🚎🏎🚓🚑🚒🚐🚚🚛🚜🚲🛴🛵🏍🛺🚨🚔🚍🚘🚖🚡🚠🚟🚃🚋🚞🚝🚄🚅🚈🚂🚆🚊🚉✈🛫🛬🛩💺🚁🚟🚀🛰🛸⛵🛶🚤🛳⛴🚢⚓🚧⛽🚏🚦🚥🛑🎢🎠🎪🗽🗼🏛🧱🪨🪵🛖🛤🛣🛞🧳⌛⏳⏰⏱⏲🕯💡🔦🏮📔📕📗📘📙📚📓📒📃📜📄📰🗞📑🔖🏷💰🪙💴💵💶💷💳💎⚖🔧🔨⚒🛠⛏🔩⚙🧰🧲🪜🧪🧫🔬🔭📡💉💊🩹🩺🚪🛏🛋🪑🚽🚿🛁🧴🧷🧹🧺🧻🪣🧼🫧🧽🧯🛒🎁🎈🎉🎊🎀🎗🎟🎫🏆🏅🥇🥈🥉⚽🏀🏐🏈🏉🎾🥏🎳🏏🏑🏒🥍🏓🏸🥅⛳🎯🎱🎮🕹🎲🧩🪁🪀🪄♟♠♥♦♣🎼🎵🎶🎹🥁🎷🎺🎸🪕🎻📻🎙🎚🎛🎤🎧📱☎📞📟📠🔋🔌💻🖥🖨⌨🖱🖲💽💾💿📀🧾📷📸📹🎥📽🎞📺🔍🔎🕳🪞🪟📦📫📪📬📭📮✉📧📨📩📤📥📝✏✒🖋🖊🖌🖍📁📂🗂📅📆🗒🗓📇📈📉📊📋📌📍📎🖇📏✂🗃🗄🗑🔒🔓🔏🔐");
  // Additional nonliving objects/symbols present in the reviewed NEW20 inputs.
  OBJECTS=OBJECTS.concat(Array.from("🧂⚡☢🧆☄🧬🥭🥥🍪♨🏙⚪🆕🟤⛰🛢☘👕🧣👗👢👒🎩🧢🎓🪓⚗🥢🍼🧵🧶⛸👓🌂🦽🛹🛎🌡🪐🤿🎿🛷🎨👟💍🛡🗜🦯🪒📣🔔"));
  function text(s,max){return typeof s==="string"&&s.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)}
  function integer(n,a,b){return typeof n==="number"&&Number.isInteger(n)&&n>=a&&n<=b}
  function bytes(s){return typeof TextEncoder!=="undefined"?new TextEncoder().encode(s).length:unescape(encodeURIComponent(s)).length}
  function own(o,k){return Object.prototype.hasOwnProperty.call(o,k)}
  function object(o){return o&&typeof o==="object"&&!Array.isArray(o)}
  function normalized(s){return s.normalize("NFKC").replace(/[\u064b-\u065f\u0670\s\p{P}]/gu,"").toLowerCase()}
  function emoji(s,max){
    if(!text(s,80))return false;
    var chars=Array.from(s).filter(function(c){return c!=="\ufe0f"&&c!=="\ufe0e"&&c!==" "});
    return chars.length>0&&chars.length<=max&&chars.every(function(c){return OBJECTS.indexOf(c)>-1});
  }
  function cell(c){return object(c)&&SHAPES.indexOf(c.shape)>-1&&integer(c.rot,0,315)&&c.rot%45===0&&["solid","outline","half"].indexOf(c.fill)>-1&&integer(c.size,1,3)&&integer(c.count,1,4)}
  function cellName(c){return SHAPE_NAMES[SHAPES.indexOf(c.shape)]+"، "+({solid:"مملوء",outline:"مفرغ",half:"نصف مملوء"})[c.fill]+"، "+TURNS[c.rot/45]+"، "+["","صغير","متوسط","كبير"][c.size]+"، "+COUNTS[c.count]}
  function svgEl(tag,attrs){var n=document.createElementNS(NS,tag);Object.keys(attrs||{}).forEach(function(k){n.setAttribute(k,String(attrs[k]))});return n}
  function sanitizeSvg(s){
    try{
      if(!text(s,4096)||bytes(s)>4096||/<!|<\?|&/.test(s))return null;
      var d=new DOMParser().parseFromString(s,"image/svg+xml"),root=d.documentElement;
      if(!root||root.localName!=="svg"||d.querySelector("parsererror")||d.childNodes.length!==1)return null;
      var tags=["svg","g","path","line","polyline","polygon","circle","ellipse","rect","defs","clipPath"];
      var nums=["x","y","x1","x2","y1","y2","cx","cy","r","rx","ry","width","height","stroke-width","stroke-miterlimit","opacity","fill-opacity","stroke-opacity"];
      var n=0,clips=Object.create(null),refs=[],prefix="kzvClip"+(++serial)+"-";
      function copy(src,inClip){
        if(++n>100||tags.indexOf(src.localName)<0||src.prefix||(src.namespaceURI&&src.namespaceURI!==NS))throw Error("element");
        if(src.localName==="defs"&&(inClip||src.parentNode!==root&&src.parentNode.localName!=="g")||src.localName==="clipPath"&&src.parentNode.localName!=="defs")throw Error("definition");
        inClip=inClip||src.localName==="clipPath";
        var dst=svgEl(src.localName,{});
        Array.from(src.attributes).forEach(function(a){
          var k=a.name,v=a.value;
          if(k==="xmlns"&&src===root&&v===NS)return;
          if(k==="id"){
            if(src.localName!=="clipPath"||!/^[a-z][a-z0-9-]{0,31}$/i.test(v)||own(clips,v))throw Error("clip id");
            clips[v]=true;dst.setAttribute(k,prefix+v);return;
          }
          if(k==="clip-path"){
            var ref=/^url\(#([a-z][a-z0-9-]{0,31})\)$/i.exec(v);
            if(!ref||inClip||src===root||src.localName==="defs")throw Error("clip reference");
            refs.push(ref[1]);dst.setAttribute(k,"url(#"+prefix+ref[1]+")");return;
          }
          if(k.indexOf(":")>-1||/^on/i.test(k)||/url|https?:|javascript:|data:|\\/i.test(v))throw Error("attribute");
          if(nums.indexOf(k)>-1){if(!/^-?(?:\d+\.?\d*|\.\d+)$/.test(v)||!isFinite(+v)||Math.abs(+v)>10000)throw Error("number")}
          else if(k==="viewBox"){var a=v.trim().split(/[ ,]+/).map(Number);if(src!==root||a.length!==4||!a.every(function(x){return isFinite(x)&&Math.abs(x)<=10000})||a[2]<=0||a[3]<=0)throw Error("viewbox")}
          else if(k==="d"){if(!/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\s-]+$/.test(v))throw Error("path")}
          else if(k==="points"){if(!/^[0-9eE.,+\s-]+$/.test(v))throw Error("points")}
          else if(k==="transform"){if(!/^(?:(?:matrix|translate|scale|rotate)\(\s*[-+\d.eE,\s]+\)\s*)+$/.test(v))throw Error("transform")}
          else if(k==="fill"||k==="stroke"){if(!/^(?:none|currentColor|#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)$/.test(v))throw Error("paint");if(v!=="none")v="currentColor"}
          else if(k==="fill-rule"||k==="clip-rule"){if(v!=="evenodd"&&v!=="nonzero")throw Error("rule")}
          else if(k==="stroke-linecap"){if(!/^(butt|round|square)$/.test(v))throw Error("cap")}
          else if(k==="stroke-linejoin"){if(!/^(miter|round|bevel)$/.test(v))throw Error("join")}
          else throw Error("attribute");
          dst.setAttribute(k,v);
        });
        Array.from(src.childNodes).forEach(function(c){if(c.nodeType===1)dst.appendChild(copy(c,inClip));else if(c.nodeType!==3||c.textContent.trim())throw Error("node")});
        return dst;
      }
      var clean=copy(root,false);
      if(!refs.every(function(id){return own(clips,id)}))return null;
      return clean;
    }catch(e){return null}
  }
  function validVis(v,q){
    if(v===undefined)return true;
    if(!object(v))return false;
    if(v.kind==="svg")return !!sanitizeSvg(v.svg);
    if(v.kind==="emoji"){
      if(!emoji(v.seq,8)||!Array.isArray(v.basis)||!v.basis.length||v.basis.length>8||!v.basis.every(function(s){return text(s,80)&&s.trim()}))return false;
      var correct=normalized(q.choices[q.answer]);
      return !correct||normalized(v.basis.join(" ")).indexOf(correct)<0;
    }
    if(v.kind==="silhouette")return emoji(v.emoji,1);
    if(v.kind==="pattern")return Array.isArray(v.seq)&&v.seq.length===4&&v.seq.every(cell)&&Array.isArray(v.opts)&&v.opts.length===4&&v.opts.every(cell);
    if(v.kind==="photo"){
      if(!/^(?:quest-data\/signs\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp|quest-img\/landmarks\/landmark-photos-\d{4}\.webp)$/.test(v.src))return false;
      if(v.mask===undefined)return true;
      var m=v.mask;return object(m)&&[m.x,m.y,m.w,m.h].every(function(n){return typeof n==="number"&&isFinite(n)})&&m.x>=0&&m.y>=0&&m.w>0&&m.h>0&&m.x+m.w<=100&&m.y+m.h<=100;
    }
    if(v.kind==="map"){
      if(typeof KUNUZ_GEO_INDEX==="undefined"||!own(KUNUZ_GEO_INDEX.views,v.view)||!Array.isArray(v.hit)||!v.hit.length)return false;
      var b=KUNUZ_GEO_INDEX.views[v.view];
      return v.hit.every(function(n,i){var a=KUNUZ_GEO_INDEX.names[n];return own(KUNUZ_GEO_INDEX.names,n)&&v.hit.indexOf(n)===i&&a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1]});
    }
    return false;
  }
  function stamp(qs){var h=2166136261;qs.forEach(function(q){var s=q.id+"\n";for(var j=0;j<s.length;j++)h=Math.imul(h^s.charCodeAt(j),16777619)>>>0});return qs.length+"-"+("0000000"+h.toString(16)).slice(-8)}
  function pack(i){return i>=baseN&&DATA.qs[i]&&DATA.qs[i].kzPack}
  function readHistory(){
    if(volatile)return;
    try{var o=JSON.parse(window.localStorage.getItem(HISTORY));if(o&&o.v===1&&Array.isArray(o.ids))o.ids.forEach(function(id){if(typeof id==="string"&&/^[a-z0-9-]+-\d{4,}$/.test(id))historyIds[id]=true})}catch(e){volatile=true}
  }
  function has(i){return !!historyIds[DATA.qs[i][8]]}
  function mark(i){readHistory();historyIds[DATA.qs[i][8]]=true;if(!volatile)try{window.localStorage.setItem(HISTORY,JSON.stringify({v:1,ids:Object.keys(historyIds)}))}catch(e){volatile=true}}
  function install(){
    if(installed)return;installed=true;
    var oldStamp=seenStamp,oldRead=seenRead,oldHas=seenHas,oldMark=seenMark,oldReset=seenReset,oldLive=kzLive,oldGroups=kzcGroups;
    seenStamp=function(n){return oldStamp(n||baseN)};
    seenEmpty=function(){return Array(Math.ceil(baseN/8)).fill(0)};
    seenRead=function(){oldRead();readHistory()};
    seenHas=function(i){return pack(i)?has(i):oldHas(i)};
    seenMark=function(i){if(pack(i))mark(i);else oldMark(i)};
    seenReset=function(){historyIds=Object.create(null);if(!volatile)try{window.localStorage.removeItem(HISTORY)}catch(e){volatile=true}oldReset()};
    kzLive=function(i){return pack(i)?!(typeof RM!=="undefined"&&RM.on||typeof G!=="undefined"&&G&&G.roomCfg):oldLive(i)};
    kzcGroups=function(){var groups=oldGroups();if(typeof G!=="undefined"&&G&&G.roomCfg)return groups.map(function(g){return {n:g.n,r:g.r,c:g.c.filter(function(i){return i<baseC})}});return groups};
    var oldDraw=drawCats;drawCats=function(){if(typeof G!=="undefined"&&G&&G.roomCfg)for(var i=G.cats.length-1;i>=0;i--)if(G.cats[i]>=baseC)G.cats.splice(i,1);return oldDraw.apply(this,arguments)};
    // Room payloads belong to their unchanged server bank. Clear a previous local drawing.
    if(typeof roomQuestion==="function"){var room=roomQuestion;roomQuestion=function(){show(null);return room.apply(this,arguments)}}
    readHistory();
  }
  function register(p){
    try{
      if(!PACKS_ENABLED||!object(p)||!/^([a-z][a-z0-9]*)(-[a-z0-9]+)*$/.test(p.slug)||slugs[p.slug]||!Array.isArray(p.qs)||!p.qs.length||p.qs.length>20000||!Array.isArray(p.cats)||p.cats.length>100||p.stamp!==stamp(p.qs))return false;
      var names=Object.create(null),newCats=Object.create(null),localIds=Object.create(null),rows=[];
      DATA.cats.forEach(function(c,i){names[c[0]]=i});
      for(var c of p.cats){if(!object(c)||!text(c.name,120)||!c.name.trim()||/[<>&"'`]/.test(c.name)||!/^[a-z][a-z0-9-]*$/.test(c.id)||own(names,c.id)||own(newCats,c.id)||["general","religious"].indexOf(c.kind)<0||c.group!==undefined&&["visual","quran","belief","sunnah","islamic-history","gulf","language","science","world"].indexOf(c.group)<0)return false;newCats[c.id]=c}
      var re=new RegExp("^"+p.slug+"-\\d{4,}$");
      for(var q of p.qs){
        if(!object(q)||!re.test(q.id)||own(ids,q.id)||own(localIds,q.id))return false;
        localIds[q.id]=true;
        if((!own(names,q.cat)&&!own(newCats,q.cat))||q.type!=="mcq"||q.status!=="approved"||!text(q.fmt,40)||!text(q.q,3500)||!q.q.trim()||!Array.isArray(q.choices)||q.choices.length!==4||!q.choices.every(function(s){return text(s,500)&&s.trim()})||!integer(q.answer,0,3)||!text(q.why,5000)||!Array.isArray(q.src)||!q.src.every(function(s){return text(s,1000)})||!integer(q.level,1,3)||q.flags!==undefined&&(!Array.isArray(q.flags)||!q.flags.every(function(s){return text(s,120)}))||!validVis(q.vis,q))continue;
        rows.push(q);
      }
      if(!rows.length)return false;
      install();
      var groups={quran:0,belief:1,sunnah:2,"islamic-history":3,gulf:4,language:5,science:6,world:7};
      rows.forEach(function(q){
        if(!own(names,q.cat)){
          var c=newCats[q.cat],g=c.group||(q.vis?"visual":c.kind==="religious"?"islamic-history":"world"),gi;
          if(g==="visual"){
            gi=KZC_GROUPS.findIndex(function(x){return x[0]==="بصريات وألغاز"});
            if(gi<0){gi=KZC_GROUPS.length;KZC_GROUPS.push(["بصريات وألغاز",0,[]])}
          }else gi=own(groups,g)?groups[g]:c.kind==="religious"?3:7;
          names[q.cat]=DATA.cats.length;DATA.cats.push([c.id,c.name,c.kind]);KZC_GROUPS[gi][2].push(c.id);
        }
        var choices=q.vis&&q.vis.kind==="pattern"?q.vis.opts.map(cellName):q.choices.slice();
        var r=[names[q.cat],0,1,q.q,choices,q.answer,q.why,q.src.join(" · "),q.id];
        r.kzPack={slug:p.slug,level:q.level,vis:q.vis};DATA.qs.push(r);ids[q.id]=true;
      });
      slugs[p.slug]=true;KZC.g=null;
      if(typeof KZL!=="undefined"&&KZL.extend)KZL.extend();
      if(typeof drawCats==="function")drawCats();
      return true;
    }catch(e){return false}
  }
  // Bank IDs are reserved even if a question has been withdrawn.
  DATA.qs.forEach(function(q){ids[q[8]]=true});
  function shape(c){
    var svg=svgEl("svg",{viewBox:"0 0 100 100","aria-hidden":"true",focusable:"false"});
    var def=svgEl("defs"),key="kzvHalf"+(++serial),cp=svgEl("clipPath",{id:key});cp.appendChild(svgEl("rect",{x:0,y:0,width:50,height:100}));def.appendChild(cp);svg.appendChild(def);
    for(var i=0;i<c.count;i++){
      var g=svgEl("g",{transform:"translate("+(c.count===1?50:30+(i%2)*40)+" "+(c.count===1?50:c.count===2?50:30+Math.floor(i/2)*40)+") scale("+((c.count===1?.8:.38)*[0,.55,.78,1][c.size])+") rotate("+c.rot+") translate(-50 -50)"});
      var tag="path",attrs={},points={triangle:"50,7 93,87 7,87",diamond:"50,4 96,50 50,96 4,50",pentagon:"50,4 94,36 77,89 23,89 6,36",hexagon:"25,7 75,7 99,50 75,93 25,93 1,50",star:"50,3 61,36 96,36 68,57 79,92 50,71 21,92 32,57 4,36 39,36"};
      if(c.shape==="circle"){tag="circle";attrs={cx:50,cy:50,r:42}}
      else if(c.shape==="square"){tag="rect";attrs={x:9,y:9,width:82,height:82}}
      else if(c.shape==="cross")attrs={d:"M34 5H66V34H95V66H66V95H34V66H5V34H34Z"};
      else{tag="polygon";attrs={points:points[c.shape]}}
      attrs.fill=c.fill==="solid"?"currentColor":"none";attrs.stroke="currentColor";attrs["stroke-width"]=5;
      g.appendChild(svgEl(tag,attrs));
      if(c.fill==="half"){attrs.fill="currentColor";attrs["clip-path"]="url(#"+key+")";g.appendChild(svgEl(tag,attrs))}
      svg.appendChild(g);
    }
    return svg;
  }
  function loadGeo(){
    if(geoPromise)return geoPromise;
    geoPromise=new Promise(function(resolve){
      if(typeof KUNUZ_GEO!=="undefined"){resolve(KUNUZ_GEO);return}
      var s=document.createElement("script");s.src="/quest-data/kunuz-geo.js";s.async=true;
      s.onload=function(){resolve(typeof KUNUZ_GEO!=="undefined"?KUNUZ_GEO:null)};s.onerror=function(){resolve(null)};document.head.appendChild(s);
    });return geoPromise;
  }
  function map(v,data){
    var b=data.views[v.view],svg=svgEl("svg",{viewBox:[(b[0]+180)*10,(90-b[3])*10,(b[2]-b[0])*10,(b[3]-b[1])*10].join(" "),"aria-hidden":"true",focusable:"false"});
    data.countries.forEach(function(c){svg.appendChild(svgEl("path",{d:c[1],class:v.hit.indexOf(c[0])>-1?"kzv-hit":"kzv-land","fill-rule":"evenodd","vector-effect":"non-scaling-stroke"}))});
    data.neutral.forEach(function(d){svg.appendChild(svgEl("path",{d:d,class:"kzv-neutral","fill-rule":"evenodd","vector-effect":"non-scaling-stroke"}))});return svg;
  }
  function photoUrl(v){
    if(!v||v.kind!=="photo"||typeof v.src!=="string"||!/^(?:quest-data\/signs\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp|quest-img\/landmarks\/landmark-photos-\d{4}\.webp)$/.test(v.src))return null;
    return "/"+v.src;
  }
  function photoImage(v,high){
    var url=photoUrl(v);if(!url)return null;
    var img=photoCache.get(url);
    if(img){photoCache.delete(url);photoCache.set(url,img)}
    else{img=new Image();img.decoding="async";if("fetchPriority" in img)img.fetchPriority=high?"high":"low";photoCache.set(url,img);img.src=url}
    if("fetchPriority" in img)img.fetchPriority=high?"high":"low";
    while(photoCache.size>6)photoCache.delete(photoCache.keys().next().value);
    return img;
  }
  function drainPhotoQueue(){
    if(photoQueueBusy)return;
    while(photoQueue.length){
      var item=photoQueue.shift();photoQueueKeys.delete(item.url);
      var img=photoImage(item.v,false);if(!img||img.complete)continue;
      photoQueueBusy=true;
      var done=function(){if(!photoQueueBusy)return;photoQueueBusy=false;drainPhotoQueue()};
      img.addEventListener("load",done,{once:true});img.addEventListener("error",done,{once:true});
      if(img.complete)done();
      return;
    }
  }
  function prefetch(questions,limit){
    if(!Array.isArray(questions))return 0;
    var cap=Number.isInteger(limit)?Math.min(6,Math.max(0,limit)):6,seen=Object.create(null),items=[];
    for(var q of questions){if(items.length>=cap)break;var v=q&&q.kzPack&&q.kzPack.vis,url=photoUrl(v);if(!url||seen[url])continue;seen[url]=true;items.push({v:v,url:url})}
    if(!items.length)return 0;
    var first=items.shift(),img=photoImage(first.v,true);
    items.forEach(function(item){if(photoCache.has(item.url)||photoQueueKeys.has(item.url))return;photoQueueKeys.add(item.url);photoQueue.push(item)});
    if(!photoQueueBusy&&img){
      if(img.complete)drainPhotoQueue();
      else{
        photoQueueBusy=true;
        var done=function(){if(!photoQueueBusy)return;photoQueueBusy=false;drainPhotoQueue()};
        img.addEventListener("load",done,{once:true});img.addEventListener("error",done,{once:true});
        if(img.complete)done();
      }
    }
    var count=seen.length||Object.keys(seen).length;
    return count;
  }
  function show(q,onPaint,onError){
    var host=document.getElementById("qvis");if(!host)return;
    if(photoObserver){photoObserver.disconnect();photoObserver=null}
    if(typeof RM!=="undefined"&&RM.on||typeof G!=="undefined"&&G&&G.roomCfg)q=null;
    var render=++renderSerial;active=q;host.textContent="";host.hidden=true;host.className="kzv";
    document.body.classList.remove("kzv-question");
    var v=q&&q.kzPack&&q.kzPack.vis;if(!v)return;
    host.hidden=false;host.classList.add("kzv-"+v.kind);document.body.classList.add("kzv-question");
    host.setAttribute("role","img");
    var labels={map:"خريطة فيها بلد مظلل",svg:"رسم خطي لمعلم",emoji:v.basis?v.basis.join("، "):"رموز لأشياء",silhouette:"ظل شيء",pattern:"تسلسل أشكال وخانة مفقودة",photo:"لوحة منطقة فيها اسم محجوب"};
    host.setAttribute("aria-label",labels[v.kind]);
    if(v.kind==="map")loadGeo().then(function(data){if(render!==renderSerial)return;if(data)host.appendChild(map(v,data));else host.textContent="تعذّر عرض الخريطة"});
    else if(v.kind==="svg")host.appendChild(sanitizeSvg(v.svg));
    else if(v.kind==="emoji"||v.kind==="silhouette"){var e=document.createElement("span");e.className="kzv-emoji";e.setAttribute("aria-hidden","true");e.textContent=v.seq||v.emoji;host.appendChild(e)}
    else if(v.kind==="pattern"){
      v.seq.forEach(function(c){var e=document.createElement("span");e.appendChild(shape(c));host.appendChild(e)});
      var missing=document.createElement("span");missing.textContent="؟";missing.setAttribute("aria-hidden","true");host.appendChild(missing);
    }else if(v.kind==="photo"){
      var frame=document.createElement("div");frame.className="kzv-photo-frame";frame.setAttribute("aria-hidden","true");
      var img=photoImage(v,true);if(!img){if(typeof onError==="function")onError();return}img.alt="";img.draggable=false;
      var painted=false,m=v.mask||{x:200/3,y:100/3,w:100/3,h:100/3},cover=document.createElement("span");cover.className="kzv-mask";
      function fit(){if(active!==q||!host.clientWidth)return;var ratio=typeof v.ratio==="number"&&v.ratio>0?v.ratio:img.naturalWidth&&img.naturalHeight?img.naturalWidth/img.naturalHeight:1,paper=host.closest(".j-paper"),scale=paper&&paper.clientHeight?paper.getBoundingClientRect().height/paper.clientHeight:host.clientWidth?host.getBoundingClientRect().width/host.clientWidth:1,viewportHeight=window.visualViewport&&window.visualViewport.height||document.documentElement.clientHeight||window.innerHeight,maxHeight=Math.max(1,viewportHeight*.449/(scale>0?scale:1)),width=host.clientWidth,height=Math.min(width/ratio,maxHeight),contentWidth=Math.min(width,height*ratio),contentHeight=contentWidth/ratio,left=(width-contentWidth)/2,top=(height-contentHeight)/2;frame.style.width=width+"px";frame.style.height=height+"px";cover.style.left=(left+contentWidth*m.x/100)+"px";cover.style.top=(top+contentHeight*m.y/100)+"px";cover.style.width=(contentWidth*m.w/100)+"px";cover.style.height=(contentHeight*m.h/100)+"px"}
      function fail(){if(render!==renderSerial||active!==q||!img.isConnected)return;if(typeof onError==="function"){var callback=onError;onError=null;callback()}}
      function paint(){if(painted||render!==renderSerial||active!==q||!img.isConnected||!img.naturalWidth)return;fit();requestAnimationFrame(function(){if(render!==renderSerial||active!==q||!img.isConnected)return;img.style.opacity="1";requestAnimationFrame(function(){if(painted||render!==renderSerial||active!==q||!img.isConnected)return;painted=true;onError=null;if(typeof onPaint==="function"){var callback=onPaint;onPaint=null;callback()}})})}
      img.onload=paint;img.onerror=fail;frame.appendChild(img);fit();frame.appendChild(cover);host.appendChild(frame);if(img.complete&&img.naturalWidth)paint();else if(img.complete)fail();
      if(typeof ResizeObserver!=="undefined"){photoObserver=new ResizeObserver(fit);photoObserver.observe(host)}
    }
  }
  function reveal(q){if(active!==q)return;var host=document.getElementById("qvis");if(!host)return;host.classList.add("kzv-revealed");if(q.kzPack&&q.kzPack.vis&&q.kzPack.vis.kind==="photo")host.setAttribute("aria-label","لوحة منطقة بعد رفع الغطاء")}
  function choice(node,q,j){
    var v=q&&q.kzPack&&q.kzPack.vis;if(!v||v.kind!=="pattern"||!v.opts)return false;
    node.textContent="";node.classList.add("kzv-choice");var target=node;
    if(node.localName==="li"){
      target=document.createElement("button");target.type="button";target.className="kzv-choice-button";
      target.onclick=function(){var list=node.parentNode;list.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-pressed",b===target?"true":"false")})};node.appendChild(target);
    }
    target.setAttribute("aria-label",cellName(v.opts[j]));target.appendChild(shape(v.opts[j]));return true;
  }
  function explain(node,q){
    if(!q||!q.kzPack)return false;
    node.textContent=q[6];if(q[7]){var s=document.createElement("span");s.className="src";s.textContent=q[7];node.appendChild(s)}return true;
  }
  function parsePack(body){var m=/^\s*KZV\.register\(\s*([\s\S]*)\s*\);?\s*$/.exec(body);if(!m)return null;try{return JSON.parse(m[1])}catch(e){return null}}
  async function boot(){
    if(!PACKS_ENABLED||typeof KUNUZ_PACKS==="undefined"||!Array.isArray(KUNUZ_PACKS))return;
    for(var entry of KUNUZ_PACKS){
      try{
        if(!object(entry)||!/^([a-z][a-z0-9]*)(-[a-z0-9]+)*$/.test(entry.slug)||entry.src!=="quest-data/kunuz-pack-"+entry.slug+".js")continue;
        var r=await fetch("/"+entry.src);if(!r.ok)continue;
        var p=parsePack(await r.text());if(p&&p.slug===entry.slug)register(p);
      }catch(e){}
    }
  }
  var api={register:register,stamp:stamp,validateVisual:validVis,sanitizeSvg:sanitizeSvg,show:show,prefetch:prefetch,reveal:reveal,choice:choice,explain:explain,level:function(i){var p=pack(i);return p?p.level:0},isPack:function(i){return !!pack(i)},cellName:cellName};
  // Defer until the global KZV exists; classic scripts below may start loading levels.
  api.ready=Promise.resolve().then(boot);
  return api;
})();
