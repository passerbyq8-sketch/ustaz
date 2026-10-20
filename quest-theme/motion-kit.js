/*
 * Ezik Motion Kit — event-driven adaptation of the exact Treasure Journey film.
 * No game state, answering, scoring rules, networking, timers or auto-play.
 * Browser global: EzikMotion. CSS lengths use the reference's logical px units.
 *
 * IMPORTANT: Transform helpers own their target's inline transform while active.
 * Animate a dedicated wrapper if that element already has a layout transform,
 * or if a different animation needs to run simultaneously. No silent composition.
 * Ripple/confetti hosts must be positioned (position: relative/absolute/fixed),
 * with overflow:hidden when the effect should stay within the screen.
 * Coordinates are host-local CSS pixels, not viewport/client pixels.
 *
 * Every call returns { cancel(), finish(), finished }.
 * cancel restores owned styles/removes temporary nodes; finish reaches the final
 * visual value. finished resolves {reason} and never changes gameplay state.
 * Hidden pages/reduced-motion: finite effects settle instantly; loops stop and
 * restore styles. Call loops again explicitly on the application's own resume.
 * Call dispose() at root unmount; it cancels effects and removes listeners.
 */
(function (global) {
  'use strict';
  if (Object.prototype.hasOwnProperty.call(global, 'EzikMotion')) {
    throw new Error('EzikMotion already exists; load motion-kit.js only once.');
  }
  const doc = global.document;
  const media = global.matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set();
  let disposed = false;
  const clamp = n => Math.max(0, Math.min(1, n));
  const cubicOut = n => 1 - Math.pow(1 - clamp(n), 3);
  const arabic = n => String(Math.round(n)).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const colors = Object.freeze(['#ffe299', '#6be7c4', '#fba48b', '#cbb4ff']);

  function requireElement(el) {
    if (disposed) throw new Error('EzikMotion has been disposed.');
    if (!el || el.nodeType !== 1 || !el.style) throw new TypeError('Expected a DOM element.');
    return el;
  }
  function number(n, fallback) {
    if (n === undefined) return fallback;
    if (!Number.isFinite(n)) throw new TypeError('Motion values must be finite numbers.');
    return n;
  }
  function saveStyles(el, names) {
    const saved = names.map(name => [name, el.style.getPropertyValue(name), el.style.getPropertyPriority(name)]);
    return () => saved.forEach(([name, value, priority]) => {
      if (value) el.style.setProperty(name, value, priority);
      else el.style.removeProperty(name);
    });
  }
  function animate({ duration, step, cleanup = () => {}, loop = false }) {
    if (disposed) throw new Error('EzikMotion has been disposed. Reload the module to create a new instance.');
    let frame = 0, ended = false, resolve;
    const started = global.performance.now();
    const finished = new Promise(r => { resolve = r; });
    function settle(reason, end) {
      if (ended) return;
      ended = true;
      global.cancelAnimationFrame(frame);
      active.delete(handle);
      try {
        if (end && !loop) step(duration);
      } finally {
        cleanup(reason);
        resolve({ reason });
      }
    }
    const handle = Object.freeze({
      cancel: () => settle('cancelled', false),
      finish: () => settle('finished', true),
      finished,
      _settle: reason => settle(reason, !loop),
      _loop: loop
    });
    active.add(handle);
    if (media.matches || doc.hidden) {
      settle(media.matches ? 'reduced-motion' : 'hidden', !loop);
      return handle;
    }
    function tick(now) {
      if (ended) return;
      const elapsed = Math.max(0, (now - started) / 1000);
      if (!loop && elapsed >= duration) { settle('completed', true); return; }
      step(elapsed);
      frame = global.requestAnimationFrame(tick);
    }
    step(0);
    frame = global.requestAnimationFrame(tick);
    return handle;
  }
  function shouldRestore(reason) {
    return reason === 'cancelled';
  }
  function positioned(host) {
    requireElement(host);
    if (global.getComputedStyle(host).position === 'static') {
      throw new Error('Effect host must have position: relative, absolute, fixed, or sticky.');
    }
  }

  function enterScreen(element, options = {}) {
    const el = requireElement(element);
    const duration = Math.max(0, number(options.duration, .65));
    const opacityDuration = Math.max(.001, number(options.opacityDuration, .38));
    const distance = number(options.distance, 22);
    const initialScale = number(options.initialScale, 1.018);
    const restore = saveStyles(el, ['opacity', 'transform']);
    return animate({ duration,
      step(t) {
        const p = cubicOut(duration === 0 ? 1 : t / duration);
        el.style.opacity = String(cubicOut(t >= duration ? 1 : t / opacityDuration));
        el.style.transform = `translateY(${(1-p)*distance}px) scale(${1+(1-p)*(initialScale-1)})`;
      },
      cleanup(reason) { if (shouldRestore(reason)) restore(); }
    });
  }

  function staggerCards(elements, options = {}) {
    const nodes = Array.from(elements, requireElement);
    const delay = Math.max(0, number(options.delay, .25));
    const stagger = Math.max(0, number(options.stagger, .12));
    const itemDuration = Math.max(.001, number(options.duration, .6));
    const distance = number(options.distance, 24);
    const restores = nodes.map(el => saveStyles(el, ['opacity', 'transform']));
    const duration = delay + Math.max(0, nodes.length-1)*stagger + itemDuration;
    return animate({ duration,
      step(t) { nodes.forEach((el, i) => {
        const p = cubicOut((t-delay-i*stagger)/itemDuration);
        el.style.opacity = String(p);
        el.style.transform = `translateY(${(1-p)*distance}px)`;
      }); },
      cleanup(reason) { if (shouldRestore(reason)) restores.forEach(restore => restore()); }
    });
  }

  function tapRipple(host, options = {}) {
    positioned(host);
    const x = number(options.x, host.clientWidth/2);
    const y = number(options.y, host.clientHeight/2);
    const circle = doc.createElement('span');
    const dot = doc.createElement('span');
    circle.setAttribute('aria-hidden', 'true');
    Object.assign(circle.style, {
      position:'absolute', left:`${x-29}px`, top:`${y-29}px`, width:'58px', height:'58px',
      boxSizing:'border-box', border:'3px solid white', borderRadius:'100%',
      background:'#ffffff25', boxShadow:'0 0 0 12px #ffffff20',
      pointerEvents:'none', zIndex:'50', opacity:'0'
    });
    Object.assign(dot.style, {
      position:'absolute', width:'14px', height:'14px', borderRadius:'100%',
      background:'white', left:'19px', top:'19px'
    });
    circle.appendChild(dot); host.appendChild(circle);
    return animate({ duration:.65,
      step(t) { const v=clamp(t/.65); circle.style.opacity=String(Math.sin(v*Math.PI)); circle.style.transform=`scale(${.55+v*.85})`; },
      cleanup() { circle.remove(); }
    });
  }

  function celebrate(host, options = {}) {
    positioned(host);
    const x=number(options.x,host.clientWidth/2);
    const y=number(options.y,host.clientHeight*350/902);
    const layer=doc.createElement('span');
    layer.setAttribute('aria-hidden','true');
    Object.assign(layer.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:'30',overflow:'hidden'});
    const pieces=Array.from({length:42},(_,i)=>{
      const piece=doc.createElement('i');
      Object.assign(piece.style,{position:'absolute',width:'7px',height:'15px',borderRadius:'2px',background:colors[i%4],opacity:'0'});
      layer.appendChild(piece); return piece;
    });
    host.appendChild(layer);
    return animate({duration:2.66,
      step(t){pieces.forEach((el,i)=>{
        const v=t-(i%5)*.04, a=i*2.399, speed=100+(i*47)%230;
        el.style.opacity=v>0&&v<2.5?String(clamp((2.5-v)*1.7)):'0';
        el.style.left=`${x+Math.cos(a)*speed*v}px`;
        el.style.top=`${y+Math.sin(a)*speed*v+145*v*v}px`;
        el.style.transform=`rotate(${i*17+v*200}deg)`;
      });},
      cleanup(){layer.remove();}
    });
  }

  function countUp(element, from, to, options = {}) {
    const el=requireElement(element);
    from=number(from,0); to=number(to,0);
    const duration=Math.max(0,number(options.duration,1.2));
    const format=typeof options.format==='function'?options.format:(options.arabicDigits?arabic:n=>String(Math.round(n)));
    const original=el.textContent;
    return animate({duration,
      step(t){ const p=cubicOut(duration===0?1:t/duration); el.textContent=format(from+(to-from)*p); },
      cleanup(reason){ if(shouldRestore(reason))el.textContent=original; }
    });
  }

  function float(element, options = {}) {
    const el=requireElement(element), restore=saveStyles(el,['transform']);
    const amplitude=number(options.amplitude,3), frequency=number(options.frequency,1.5), phase=number(options.phase,0);
    const rotation=number(options.rotation,0), rotationFrequency=number(options.rotationFrequency,1);
    return animate({duration:0,loop:true,
      step(t){ el.style.transform=`translateY(${Math.sin(t*frequency+phase)*amplitude}px) rotate(${Math.sin(t*rotationFrequency+phase)*rotation}deg)`; },
      cleanup(){restore();}
    });
  }

  function settleForPreference(){
    if(!media.matches&&!doc.hidden)return;
    const reason=media.matches?'reduced-motion':'hidden';
    Array.from(active).forEach(handle=>handle._settle(reason));
  }
  doc.addEventListener('visibilitychange',settleForPreference);
  if(media.addEventListener)media.addEventListener('change',settleForPreference);
  else media.addListener(settleForPreference);
  function cancelAll(){Array.from(active).forEach(handle=>handle.cancel());}
  function dispose(){
    if(disposed)return;
    cancelAll();disposed=true;
    doc.removeEventListener('visibilitychange',settleForPreference);
    if(media.removeEventListener)media.removeEventListener('change',settleForPreference);
    else media.removeListener(settleForPreference);
  }
  global.EzikMotion=Object.freeze({
    version:'1.0.0', enterScreen, staggerCards, tapRipple, celebrate, countUp, float,
    cancelAll, dispose, cubicOut, arabicDigits:arabic,
    get reducedMotion(){return media.matches;},
    get activeCount(){return active.size;}
  });
})(window);
