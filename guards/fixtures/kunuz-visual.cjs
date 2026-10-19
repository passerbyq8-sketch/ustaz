// Test-only calibration questions. Never deployed (guards/ is excluded).
'use strict';
const cell=(shape,rot=0,fill='solid',size=2,count=1)=>({shape,rot,fill,size,count});
const kinds=['map','emoji','svg','silhouette','pattern','photo'];
function stamp(qs){let h=2166136261;for(const q of qs)for(const c of q.id+'\n')h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return qs.length+'-'+h.toString(16).padStart(8,'0')}
function fixture(){
  const cats=[0,1,2].map(i=>({id:'visual-demo-'+i,name:['بصريات تجريبية','ألغاز تجريبية','رسوم تجريبية'][i],kind:'general',group:'visual'}));
  const qs=[];
  for(let i=0;i<3;i++)for(const kind of kinds){
    const vis={
      map:{kind,view:'mena',hit:[['Egypt','Palestine','Bahrain'][i]]},
      emoji:{kind,seq:['🗻🍣','🏔️🧀','🕰️☔'][i],basis:[['جبل','سوشي'],['جبال','جبن'],['ساعة','مظلة']][i]},
      svg:{kind,svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 90H90M20 90L50 10L80 90M30 60H70M35 45H65" fill="none" stroke="currentColor" stroke-width="4"/></svg>'},
      silhouette:{kind,emoji:['🔑','☂️','⌚'][i]},
      pattern:{kind,seq:[cell('square',0),cell('square',45),cell('square',90),cell('square',135)],opts:[cell('square',180),cell('triangle',0,'outline',3,2),cell('circle',45,'half',1,3),cell('star',315,'solid',2,4)]},
      photo:{kind,src:'quest-data/signs/calibration.webp',...(i===1?{}:{mask:{x:60,y:30,w:35,h:35}})}
    }[kind];
    qs.push({id:'visual-demo-'+String(qs.length+1).padStart(4,'0'),cat:cats[i].id,type:'mcq',fmt:kind,q:{map:'أي بلد مظلل؟',emoji:'أي مكان تدل عليه الرموز؟',svg:'أي معلم يشبه هذا الرسم؟',silhouette:'ما الشيء الذي يظهر ظله؟',pattern:'ما الشكل الذي يكمل التسلسل؟',photo:'أي منطقة تدل عليها اللوحة المحجوبة؟'}[kind],vis,choices:kind==='map'?[["مصر","المغرب","عمان","الكويت"],["فلسطين","لبنان","سوريا","الأردن"],["البحرين","قطر","الكويت","عمان"]][i]:kind==='emoji'?[['اليابان','النمسا','الصين','فرنسا'],['سويسرا','اليونان','مصر','إيطاليا'],['لندن','مدريد','روما','القاهرة']][i]:kind==='silhouette'?[['مفتاح','قلم','كوب','كتاب'],['مظلة','صندوق','قفل','ساعة'],['ساعة','هاتف','باب','قطار']][i]:['اختيار أول','اختيار آخر','اختيار مختلف','اختيار بديل'],answer:0,why:'تفسير للتجربة المحلية.',src:['عينة اختبار محلية، بلا محتوى منشور'],level:1+Math.floor(kinds.indexOf(kind)/2),status:'approved'});
  }
  return {slug:'visual-demo',stamp:stamp(qs),cats,qs};
}
module.exports={fixture,stamp,cell,kinds};
