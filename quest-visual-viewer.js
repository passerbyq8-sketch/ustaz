/* Local fullscreen viewer. It copies only the pixels/geometry already shown. */
(function(){
  'use strict';
  var modal=null,stage=null,content=null,returnFocus=null,points=new Map(),start=null;
  var scale=1,x=0,y=0,serial=0,ownsHistory=false,pendingBack=false,lastTap=0,tapPoint=null;
  var sourceHost=null,sourceObserver=null,snapshotFrame=0;
  var reduced=function(){return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches};
  function fitPhoto(){
    if(!content||!stage)return;
    var frame=content.querySelector('.kzv-photo-frame');
    if(!frame||frame.classList.contains('kzv-photo-full'))return;
    var img=frame.querySelector('img'),box=stage.getBoundingClientRect();
    if(img&&img.naturalWidth){var fit=Math.min(box.width/img.naturalWidth,box.height/img.naturalHeight);frame.style.width=img.naturalWidth*fit+'px';frame.style.height=img.naturalHeight*fit+'px'}
  }
  function copyPixels(){
    if(!content||!sourceHost)return;
    var originals=sourceHost.querySelectorAll('canvas');
    content.querySelectorAll('canvas').forEach(function(c,i){if(originals[i]){c.width=originals[i].width;c.height=originals[i].height;c.getContext('2d').drawImage(originals[i],0,0)}});
  }
  function snapshot(){
    snapshotFrame=0;if(!content||!sourceHost)return;
    var clone=sourceHost.cloneNode(true);
    clone.querySelectorAll('.kzv-enlarge,.kzv-credit').forEach(function(n){n.remove()});
    content.className=sourceHost.className+' kzv-view-content';
    content.replaceChildren.apply(content,Array.from(clone.childNodes));copyPixels();
    var frame=content.querySelector('.kzv-photo-frame');if(frame){frame.style.width='';frame.style.height=''}
    content.querySelectorAll('img').forEach(function(img){img.addEventListener('load',fitPhoto,{once:true})});
    fitPhoto();paint();
  }
  function scheduleSnapshot(){if(!snapshotFrame)snapshotFrame=requestAnimationFrame(snapshot)}
  function paint(){
    if(!content||!stage)return;
    var box=stage.getBoundingClientRect(),mx=box.width*(scale-1)/2,my=box.height*(scale-1)/2;
    x=Math.max(-mx,Math.min(mx,x));y=Math.max(-my,Math.min(my,y));
    content.style.transform='translate3d('+x+'px,'+y+'px,0) scale('+scale+')';
  }
  function resetGesture(){
    var p=Array.from(points.values());
    start={scale:scale,x:x,y:y,mid:p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}:p[0],distance:p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0};
  }
  function zoom(clientX,clientY){
    if(!stage||!content)return;
    var box=stage.getBoundingClientRect(),old=scale;
    scale=scale>1.1?1:2.5;
    x=scale===1?0:(x-(clientX-box.left-box.width/2))*(scale/old-1)+x;
    y=scale===1?0:(y-(clientY-box.top-box.height/2))*(scale/old-1)+y;
    content.classList.toggle('kzv-view-ease',!reduced());paint();
  }
  function remove(){
    if(!modal)return;
    if(sourceObserver)sourceObserver.disconnect();sourceObserver=null;
    if(sourceHost)sourceHost.removeEventListener('kzvvisualchange',copyPixels);sourceHost=null;
    if(snapshotFrame)cancelAnimationFrame(snapshotFrame);snapshotFrame=0;
    modal.remove();modal=stage=content=null;points.clear();start=null;
    document.body.classList.remove('kzv-view-open');
    if(returnFocus&&document.contains(returnFocus))returnFocus.focus({preventScroll:true});
    returnFocus=null;
  }
  function close(){
    if(!modal)return;
    remove();
    if(ownsHistory){ownsHistory=false;pendingBack=true;history.back()}
  }
  function open(host){
    if(modal||pendingBack||!host||host.hidden)return;
    scale=1;x=y=0;lastTap=0;tapPoint=null;points.clear();returnFocus=document.activeElement;
    modal=document.createElement('div');modal.className='kzv-view';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','تكبير الصورة');
    var closeButton=document.createElement('button');closeButton.type='button';closeButton.className='kzv-view-close';closeButton.textContent='إغلاق';closeButton.onclick=close;
    stage=document.createElement('div');stage.className='kzv-view-stage';
    content=document.createElement('div');content.setAttribute('role','img');content.setAttribute('aria-label','الصورة المكبرة');
    stage.appendChild(content);modal.appendChild(stage);modal.appendChild(closeButton);document.body.appendChild(modal);document.body.classList.add('kzv-view-open');
    sourceHost=host;snapshot();
    sourceObserver=new MutationObserver(scheduleSnapshot);sourceObserver.observe(host,{childList:true,subtree:true,attributes:true,characterData:true});
    // Async maps/images and animated canvases stay in sync with the visible question.
    sourceHost.addEventListener('kzvvisualchange',copyPixels);
    try{var state=Object.assign({},history.state||{});state.kzVisualViewer=++serial;history.pushState(state,'');ownsHistory=true}catch(e){ownsHistory=false}
    modal.addEventListener('click',function(e){if(e.target===modal||e.target===stage)close()});
    content.addEventListener('pointerdown',function(e){
      if(e.button!==undefined&&e.button!==0)return;e.preventDefault();
      content.classList.remove('kzv-view-ease');content.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      tapPoint={x:e.clientX,y:e.clientY,time:performance.now(),moved:points.size>1};resetGesture();
    });
    content.addEventListener('pointermove',function(e){
      if(!points.has(e.pointerId)||!start)return;e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      var p=Array.from(points.values());if(tapPoint&&Math.hypot(e.clientX-tapPoint.x,e.clientY-tapPoint.y)>8)tapPoint.moved=true;
      if(p.length>1&&start.distance){
        var mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},box=stage.getBoundingClientRect();
        scale=Math.max(1,Math.min(6,start.scale*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/start.distance));
        x=mid.x-box.left-box.width/2-(start.mid.x-box.left-box.width/2-start.x)*(scale/start.scale);
        y=mid.y-box.top-box.height/2-(start.mid.y-box.top-box.height/2-start.y)*(scale/start.scale);
      }else if(p.length===1){x=start.x+p[0].x-start.mid.x;y=start.y+p[0].y-start.mid.y}
      paint();
    });
    function up(e){
      if(!points.has(e.pointerId))return;
      var tapped=e.type==='pointerup'&&points.size===1&&tapPoint&&!tapPoint.moved&&performance.now()-tapPoint.time<300;
      points.delete(e.pointerId);
      if(tapped){var now=performance.now();if(lastTap&&now-lastTap<320){zoom(e.clientX,e.clientY);lastTap=0}else lastTap=now}
      else lastTap=0;
      if(points.size)resetGesture();else start=null;
    }
    content.addEventListener('pointerup',up);content.addEventListener('pointercancel',up);
    content.addEventListener('wheel',function(e){e.preventDefault();var old=scale;scale=Math.max(1,Math.min(6,scale*(e.deltaY<0?1.15:1/1.15)));var b=stage.getBoundingClientRect();x=(x-(e.clientX-b.left-b.width/2))*scale/old+(e.clientX-b.left-b.width/2);y=(y-(e.clientY-b.top-b.height/2))*scale/old+(e.clientY-b.top-b.height/2);paint()},{passive:false});
    closeButton.focus();paint();
  }
  function consumeBack(e){if(!modal&&!pendingBack)return false;e.stopImmediatePropagation();ownsHistory=false;pendingBack=false;remove();return true}
  window.addEventListener('popstate',consumeBack,true);
  window.addEventListener('backbutton',function(e){if(modal){e.preventDefault();e.stopImmediatePropagation();close()}},true);
  window.addEventListener('keydown',function(e){
    if(!modal)return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close()}
    if(e.key==='Tab'){e.preventDefault();modal.querySelector('button').focus()}
    if(e.key==='+'||e.key==='='||e.key==='-'){e.preventDefault();scale=e.key==='-'?Math.max(1,scale/1.25):Math.min(6,scale*1.25);paint()}
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();x+=e.key==='ArrowLeft'?40:-40;paint()}
    if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();y+=e.key==='ArrowUp'?40:-40;paint()}
  },true);
  window.addEventListener('resize',function(){fitPhoto();paint()});
  window.KZVViewer={open:open,close:close,consumeBack:consumeBack};
})();
