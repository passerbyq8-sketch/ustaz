'use strict';
const assert = require('node:assert/strict');
module.exports = async function boardRoomsBrowser(h) {
  const {browser,base,check,shot,click,record} = h;
  const live = process.argv.includes('--live-board-room');
  const api = process.env.KUNUZ_BOARD_TEST_API || 'http://127.0.0.1:8815';
  if (!live) assert.match(api,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Local UI tests must use a simulated worker');
  else assert.equal(api,'https://hanna-laha.hl-worker.workers.dev');
  const widths = live ? [390] : [390,1280];
  record.boardRooms = {api,live,widths,rounds:0,contexts:0,unexpectedProtocolErrors:[],normalRoomClosures:0,simulated:!live};
  const current = page => page.evaluate(()=>KunuzJourney.boardRooms?.snapshot);
  const at = (page,stage) => page.waitForFunction(s=>KunuzJourney.state.stage===s,stage);
  const phase = (page,name) => page.waitForFunction(s=>KunuzJourney.boardRooms?.snapshot?.phase===s,name);
  async function open(width,suffix='') {
    const context=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:'block',reducedMotion:'reduce'});
    record.boardRooms.contexts++;
    await context.route('**/*',route=>{const request=route.request(),origin=new URL(request.url()).origin;if(origin===base||origin===api)return route.continue();record.blockedExternal.push(origin);return route.abort();});
    await context.addInitScript(origin=>{
      window.KUNUZ_BOARD_API_ORIGIN=origin;localStorage.setItem('kunuz_journey_muted_v1','1');
      window.__boardConnections=0;
      const Native=window.WebSocket;
      window.WebSocket=class extends Native {constructor(...args){super(...args);if(String(args[0]).includes('/ws/board/')){window.__boardSocket=this;window.__boardConnections++;}}};
    },api);
    const page=await context.newPage(),tracker={closing:false};page.on('pageerror',error=>record.errors.push(error.message));
    page.on('websocket',socket=>socket.on('framereceived',frame=>{if(typeof frame.payload!=='string'||frame.payload==='pong')return;let message;try{message=JSON.parse(frame.payload);}catch{return;}if(message.t==='error'){if(tracker.closing&&message.code==='ROOM_CLOSED')record.boardRooms.normalRoomClosures++;else record.boardRooms.unexpectedProtocolErrors.push(message.code);}}));
    await page.goto(base+'/quest-board.html'+suffix);await page.waitForFunction(()=>KunuzJourney?.state.ready&&!document.documentElement.classList.contains('kunuz-theme-pending'));
    await page.evaluate(()=>document.fonts.ready);
    return {page,context,tracker};
  }
  async function cleanup(x) {
    await x.context.close();
  }
  async function selectCats(page) {for(const cat of [0,53,69])await click(page,'[data-action="cat"][data-cat="'+cat+'"]');await click(page,'[data-action="next-setup"]');}
  for(const width of widths) {
    const host=await open(width),p=host.page;
    check('Board fresh visit starts with play-mode choice '+width,await p.evaluate(()=>KunuzJourney.state.stage),'room-entry');
    check('Board choice has exactly three paths '+width,await p.locator('.j-room-entry-choice').count(),3);
    await shot(p,'board-room-entry-'+width);
    await click(p,'[data-action="create-room"]');await at(p,'categories');
    check('Board Create selects categories before setup '+width,await p.locator('[data-board-number]').count(),0);
    await selectCats(p);
    check('Board setup places the room card first '+width,await p.locator('#journey-main > section').first().getAttribute('class'),'j-form-card j-board-room-card');
    await click(p,'[data-action="br-random"]');
    check('Board random code is four digits '+width,/^\d{4}$/.test(await p.locator('[data-board-number]').inputValue()));
    await p.locator('[data-board-number]').fill(live?'':'٠٠٤٢');
    const codeDraft=await p.locator('[data-board-number]').inputValue();
    await p.locator('[data-team-name="0"]').fill('فريق اللؤلؤ');
    await click(p,'[data-field="time"][data-value="0"]');
    const hidden = !live && width === 1280;
    if(hidden)await click(p,'[data-field="options"][data-value="hidden"]');
    await p.goBack();await at(p,'categories');await p.goForward();await at(p,'settings');
    check('Board setup Back/Forward keeps its number '+width,await p.locator('[data-board-number]').inputValue(),codeDraft);
    check('Board setup Back/Forward keeps its team '+width,await p.locator('[data-team-name="0"]').inputValue(),'فريق اللؤلؤ');
    await shot(p,'board-room-setup-'+width);
    await click(p,'[data-action="start"]');await phase(p,'lobby');
    const created=await current(p),code=created.code;
    check('Board room is genuinely created '+width,/^\d{4,6}$/.test(code));
    if(!live)check('Custom code keeps leading zeros '+width,code,'0042');
    check('Host has the host role '+width,created.self.role,'host');
    await shot(p,'board-room-host-lobby-'+width);
    const phone=await open(width),q=phone.page;
    await click(q,'[data-action="join-room"]');await at(q,'room-join');
    check('Join reaches the room-number screen without categories '+width,await q.locator('[data-action="cat"]').count(),0);
    await click(q,'[data-action="join-submit"]');check('Empty room code has inline error '+width,await q.locator('#j-room-entry-error').innerText(),'اكتب رقم الغرفة');
    await q.locator('[data-join-draft]').fill('123');await click(q,'[data-action="join-submit"]');check('Short board room code rejected '+width,await q.locator('#j-room-entry-error').innerText(),'رقم الغرفة من ٤ إلى ٦ خانات');
    await q.locator('[data-join-draft]').fill(code);await click(q,'[data-action="join-submit"]');await phase(q,'lobby');
    check('Join never shows categories '+width,await q.locator('[data-action="cat"]').count(),0);
    await click(q,'[data-action="br-seat"][data-slot="0"]');await q.locator('[data-board-name]').fill('فريق اللؤلؤ');await click(q,'[data-action="br-join-team"]');await q.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.self.role==='team');
    await p.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.teams[0]?.claimed);
    check('Joined phone has the chosen team '+width,(await current(q)).self.slot,0);
    let extra;
    if(!live){
      const direct=await open(width,'?board='+code);await phase(direct.page,'lobby');check('Direct join link bypasses entry and categories '+width,await direct.page.locator('[data-action="cat"],.j-room-entry-choice').count(),0);await cleanup(direct);
      extra=await open(width,'?board='+code);await phase(extra.page,'lobby');await click(extra.page,'[data-action="br-seat"][data-slot="-1"]');await extra.page.locator('[data-board-name]').fill('فريق المرجان');await click(extra.page,'[data-action="br-join-team"]');await extra.page.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.self.role==='team');await p.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.teams.length===3);check('A phone can add a new team '+width,(await current(extra.page)).self.slot,2);
    }
    await click(p,'[data-action="br-start"]');await phase(p,'board');await phase(q,'board');
    const teams=(await current(p)).teams.length;
    const chosen=[];
    for(let i=0;i<3;i++){
      const slot=i*7;
      if(i===0){check('Turn phone may pick the category and value '+width,await q.locator('[data-action="tile"][data-slot="0"]').isEnabled());await click(q,'[data-action="tile"][data-slot="0"]');}
      else await click(p,'[data-action="tile"][data-slot="'+slot+'"]');
      await phase(p,'question');await phase(q,'question');const question=(await current(p)).question;chosen.push(question.index);
      check('All screens see the same question '+width+':'+i,(await current(q)).question.index,question.index);
      const right=await q.evaluate(()=>DATA.qs[KunuzJourney.state.question.index][5]);
      if(hidden&&i===1)await q.locator('[data-board-answer]').fill('جواب فريق اللؤلؤ');
      else { if(hidden)await click(q,'[data-action="br-show-options"]');await click(q,'[data-action="br-answer-pick"][data-answer="'+right+'"]'); }
      await click(q,'[data-action="br-answer-lock"]');
      await p.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.question?.submissions.length>0);
      check('Host sees the submitted team answer '+width+':'+i,await p.locator('[data-board-response="0"]').innerText(),hidden&&i===1?'فريق اللؤلؤ · جواب فريق اللؤلؤ':await q.evaluate(pos=>'فريق اللؤلؤ · '+DATA.qs[KunuzJourney.state.question.index][4][pos],right));
      if(hidden&&i===0&&extra){await phase(extra.page,'question');check('Showing choices does not expose them to another phone',await extra.page.locator('[data-action="br-answer-pick"]').count(),0);}
      if(i===0)await shot(q,'board-room-phone-question-'+width);
      if(i===0)await shot(p,'board-room-host-question-'+width);
      await click(p,'[data-action="reveal-answer"]');await p.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.question?.revealed);
      await click(p,'[data-action="award"][data-team="0"]');await phase(p,'board');await phase(q,'board');
      const s=await current(p);check('Fixed card points and advancing turn '+width+':'+i,{score:s.teams[0].score,turn:s.turn,owner:s.slots[slot].by},{score:[200,600,1200][i],turn:(i+1)%teams,owner:0});check('Phone score agrees '+width+':'+i,(await current(q)).teams[0].score,s.teams[0].score);record.boardRooms.rounds++;
      if(i===1){await q.reload();await q.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.self.role==='team');check('Reload restores room, role, score and board '+width,{code:(await current(q)).code,score:(await current(q)).teams[0].score,phase:(await current(q)).phase},{code,score:600,phase:'board'});}
    }
    check('Room questions do not repeat '+width,new Set(chosen).size,3);
    if(hidden)check('Hidden-mode phone spends only its own two shows', (await current(q)).teams[0].shows, 0);
    await click(q,'[data-action="br-leave"]');await click(q,'[data-action="dialog-yes"]');await at(q,'room-entry');await q.reload();await at(q,'room-entry');
    check('An explicit exit stays at the entry screen after reload '+width,await q.evaluate(()=>KunuzJourney.state.stage),'room-entry');
    await click(q,'[data-action="join-room"]');await q.locator('[data-join-draft]').fill(code);await click(q,'[data-action="join-submit"]');await q.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.self.role==='team');
    check('Rejoining after exit restores the original team and score '+width,{slot:(await current(q)).self.slot,score:(await current(q)).teams[0].score},{slot:0,score:1200});
    if(!live){
      const count=await q.evaluate(()=>window.__boardConnections);await q.evaluate(()=>window.__boardSocket.close());await q.waitForFunction(n=>window.__boardConnections>n&&KunuzJourney.boardRooms?.connected,count);check('Disconnect and reconnect retain the score '+width,(await current(q)).teams[0].score,1200);
      for(let guard=0;guard<18;guard++){const s=await current(p);if(s.phase==='results')break;const slot=s.slots.findIndex(t=>!t.used);await click(p,'[data-action="tile"][data-slot="'+slot+'"]');await phase(p,'question');await click(p,'[data-action="reveal-answer"]');await p.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.question?.revealed);await click(p,'[data-action="award"][data-team="-1"]');await p.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.phase!=='question');}
      await phase(p,'results');await phase(q,'results');check('Finishing every card preserves the exact awarded score '+width,(await current(p)).teams[0].score,1200);await shot(p,'board-room-results-'+width);await click(p,'[data-action="br-rematch"]');await phase(p,'board');check('Rematch resets points and advances the game number '+width,{score:(await current(p)).teams[0].score,gameNumber:(await current(p)).gameNumber},{score:0,gameNumber:2});
    }
    if(!live){await host.context.setOffline(true);await p.evaluate(()=>window.__boardSocket.close());await p.waitForFunction(()=>KunuzJourney.boardRooms?.connected===false);check('Offline host exit has an honest temporary-exit label '+width,await p.locator('[data-action="br-leave"]').innerText(),'الخروج مؤقتًا');await click(p,'[data-action="br-leave"]');await click(p,'[data-action="dialog-yes"]');await at(p,'room-entry');await host.context.setOffline(false);await p.reload();await at(p,'room-entry');await click(p,'[data-action="join-room"]');await p.locator('[data-join-draft]').fill(code);await click(p,'[data-action="join-submit"]');await p.waitForFunction(()=>KunuzJourney.boardRooms?.snapshot?.self.role==='host');check('Host ownership survives a temporary offline exit '+width,(await current(p)).self.role,'host');}
    host.tracker.closing=true;phone.tracker.closing=true;if(extra)extra.tracker.closing=true;
    await click(p,'[data-action="br-leave"]');await click(p,'[data-action="dialog-yes"]');await at(p,'room-entry');await at(q,'room-entry');if(extra)await at(extra.page,'room-entry');
    await cleanup(host,true);await cleanup(phone,true);if(extra)await cleanup(extra,true);
    if(!live){const local=await open(width);await click(local.page,'[data-action="single-device"]');await selectCats(local.page);await click(local.page,'[data-field="time"][data-value="0"]');await click(local.page,'[data-action="start"]');await at(local.page,'board');check('Without room uses the original local board '+width,await local.page.evaluate(()=>({stage:KunuzJourney.state.stage,room:KunuzJourney.state.settings.room,snapshot:KunuzJourney.boardRooms.snapshot})),{stage:'board',room:false,snapshot:null});await cleanup(local);}
  }
  check('No unexpected room-protocol errors',record.boardRooms.unexpectedProtocolErrors,[]);
};
