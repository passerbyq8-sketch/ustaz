import argparse, asyncio, json, os, sys, threading, time
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

REPO = r"C:\Users\passe\projects\ustaz-wt-iap-launch"
OUT = r"C:\Users\passe\projects\_iap-orders\shots-iap-signin"
BASE = "http://127.0.0.1:4175"
MOCK_WORKER_CATALOG_URL = "https://hanna-laha.hl-worker.workers.dev/api/board/catalog"
CHROMIUM = r"C:\Users\passe\AppData\Local\ms-playwright\chromium-1248\chrome-win64\chrome.exe"
OWNER = "synthetic-account-owner"
OTHER = "synthetic-account-other"
PASSES = [
    ("ezik_pass_week_1", "أسبوع لعب غير محدود", 7),
    ("ezik_pass_month_1", "شهر لعب غير محدود", 30),
    ("ezik_pass_year_1", "سنة لعب غير محدودة", 365),
]
GAME_PATHS = {
    "dive": "/quest-ghaws.html",
    "islands-war": "/quest-harb.html",
    "test-your-knowledge": "/quest-test.html",
    "category-challenge": "/quest-board.html",
    "hanna-laha": "/hanna-laha/",
}
BANK_STAMP = "local-iap-launch-bank-v1"
SIGNIN_TITLE = "«تسجيل الدخول»"
SIGNIN_COPY = "«ألعاب كنوز المعرفة مجانية للجميع، ويلزم تسجيل الدخول إلى حساب عزك قبل اللعب.»"
SIGNIN_LINE = "«سجّل الدخول، ثم ارجع إلى هذه الصفحة للمتابعة.»"
SIGNIN_HOME_NOTICE = "«ألعاب كنوز المعرفة مجانية للجميع. سجّل الدخول لتبدأ اللعب.»"
SIGNIN_RETURN = "«العودة إلى كنوز المعرفة»"
EXTERNAL_REQUESTS = []
os.makedirs(OUT, exist_ok=True)
os.chdir(REPO)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def translate_path(self, path):
        route_path = path.split("?", 1)[0]
        if route_path == "/hanna-laha" or route_path.startswith("/hanna-laha/") and not route_path.startswith("/hanna-laha/assets/"):
            path = "/hanna-laha/index.html"
        return super().translate_path(path)

server = ThreadingHTTPServer(("127.0.0.1", 4175), QuietHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()

def mobile_settings(platform, native):
    if platform == "ios":
        ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    elif platform == "android":
        ua = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
    else:
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    return ua

def set_routes(page, config, state):
    def route_api(route):
        url = route.request.url
        if not url.startswith(BASE + "/") and url.split("?", 1)[0] != MOCK_WORKER_CATALOG_URL:
            state["external_requests"].append(url)
            EXTERNAL_REQUESTS.append(url)
        path = "/" + url.split("/", 3)[-1].split("?", 1)[0] if "://" in url else url.split("?", 1)[0]
        path = "/" + path.split("/", 1)[-1] if not path.startswith("/api/") and "/api/" in path else path
        if path.endswith("/api/iap-status"):
            status_body = {"mode": config["mode"]}
            if config.get("signin") in ("all", "host"):
                status_body["signin"] = config["signin"]
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(status_body, ensure_ascii=False))
        if path.endswith("/api/iap-balance"):
            state["balance_calls"] += 1
            if config.get("balance_status") == 401:
                return route.fulfill(status=401, content_type="application/json", body='{"ok":false,"error":"unauthenticated"}')
            if config.get("balance_status") == 503:
                return route.fulfill(status=503, content_type="application/json", body='{"ok":false,"error":"unavailable"}')
            role = config["role"]
            enforced = config.get("enforced", False) and role == "owner"
            trial = ({"active": False, "daysLeft": 0} if enforced else None) if config["mode"] == "test" else None
            expires = state.get("subscription_expires")
            body = {
                "appUserId": "acct:v1:synthetic:" + role,
                "enforced": bool(enforced),
                "purchaseEntry": bool(config.get("entry_enabled") and role == "owner" and config["mode"] == "free"),
                "credits": 0,
                "balance": 0,
                "subscriptionExpiresAt": expires,
                "subscriptionActive": bool(expires and expires > int(time.time() * 1000)),
                "trial": trial,
                "freeUsedByGame": {},
            }
            state["balance_responses"].append({"purchaseId": state["purchases"][-1] if state["purchases"] else None, "appUserId": body["appUserId"], "subscriptionExpiresAt": expires, "subscriptionActive": body["subscriptionActive"], "purchaseEntry": body["purchaseEntry"]})
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
        if path.endswith("/api/iap-trial-start"):
            state["trial_calls"] += 1
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "enforced": bool(config.get("enforced") and config["role"] == "owner")}))
        if path.endswith("/api/iap-consume"):
            state["consume_calls"] += 1
            return route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
        if path.endswith("/api/board/catalog"):
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({
                "bankStamp": BANK_STAMP,
                "categories": [{"index": i, "slug": "local-cat-" + str(i)} for i in range(6)]
            }))
        if "/api/" in path:
            state["other_api_calls"].append(path)
            return route.fulfill(status=404, content_type="application/json", body='{"ok":false,"error":"local-test-stub"}')
        return route.continue_()
    def local_only(route):
        if route.request.url.startswith(BASE + "/"):
            return route.continue_()
        state["external_requests"].append(route.request.url)
        EXTERNAL_REQUESTS.append(route.request.url)
        return route.abort()
    page.route("**/*", local_only)
    page.route("**/api/**", route_api)

def add_mock_room_socket(page, state):
    def websocket_handler(ws):
        snapshot = {
            "bankStamp": BANK_STAMP,
            "roomId": "local-room-synthetic",
            "version": 1,
            "phase": "lobby",
            "self": {"role": "candidate", "slot": -1},
            "cats": [0],
            "teams": [{"name": "الفريق ١", "color": 0, "score": 0, "shows": 2, "claimed": False, "online": True}],
            "slots": [],
            "turn": 0,
            "settings": {"options": "shown", "timeMs": 30000, "reveals": 2, "questionOrder": "mixed"},
            "question": None,
            "gameNumber": 0,
            "restartCats": [],
            "serverNow": int(time.time() * 1000),
        }
        def on_message(data):
            if data == "ping":
                ws.send("pong")
                return
            try:
                msg = json.loads(data)
            except Exception:
                return
            state["room_messages"].append(msg.get("t", ""))
            if msg.get("t") == "hello":
                ws.send(json.dumps({"t": "snapshot", "snapshot": snapshot}, ensure_ascii=False))
            elif msg.get("t") == "join":
                ws.send(json.dumps({"t": "joined", "teamToken": "synthetic-local-team-token", "roomId": snapshot["roomId"]}))
                joined = dict(snapshot)
                joined["version"] = 2
                joined["self"] = {"role": "team", "slot": 0}
                joined["teams"] = [{"name": "الفريق ١", "color": 0, "score": 0, "shows": 2, "claimed": True, "online": True}]
                ws.send(json.dumps({"t": "snapshot", "snapshot": joined}, ensure_ascii=False))
        ws.on_message(on_message)
    page.route_web_socket("wss://hanna-laha.hl-worker.workers.dev/ws/board/**", websocket_handler)

def new_page(browser, config):
    state = {
        "balance_calls": 0, "trial_calls": 0, "consume_calls": 0,
        "balance_responses": [], "purchases": [], "other_api_calls": [], "room_messages": [], "external_requests": [], "page_errors": [],
        "subscription_expires": None
    }
    ua = mobile_settings(config.get("platform", "web"), config.get("native", False))
    context = browser.new_context(
        user_agent=ua, viewport={"width": 390, "height": 844},
        device_scale_factor=3, is_mobile=config.get("platform") != "web",
        has_touch=config.get("platform") != "web", locale="ar",
        timezone_id="Asia/Kuwait", service_workers="block"
    )
    def simulated_purchase(source, product_id):
        row = next((p for p in PASSES if p[0] == product_id), None)
        if row is None:
            return {"status": "error", "productId": product_id}
        state["purchases"].append(product_id)
        state["subscription_expires"] = int(time.time() * 1000) + row[2] * 24 * 60 * 60 * 1000
        return {"status": "purchased", "productId": product_id}
    context.expose_binding("__iapSimulatedPurchase", simulated_purchase)
    init = {
        "sessionKey": "ezik_auth_session_v1",
        "session": "synthetic-session-" + config["role"] if config["role"] != "visitor" else None,
        "native": bool(config.get("native")),
    }
    context.add_init_script("(() => { const cfg = " + json.dumps(init) + ";\n" + """
      if (cfg.session) localStorage.setItem(cfg.sessionKey, JSON.stringify({session: cfg.session}));
      window.__iapNativeTypes = [];
      window.__iapNativeProductLists = [];
      window.__iapSimulatedPurchases = [];
      if (cfg.native) {
        const prices = {
          ezik_pass_week_1: {priceString:'$0.99', price:0.99, currencyCode:'USD'},
          ezik_pass_month_1: {priceString:'$2.99', price:2.99, currencyCode:'USD'},
          ezik_pass_year_1: {priceString:'$19.99', price:19.99, currencyCode:'USD'}
        };
        window.ReactNativeWebView = { postMessage(raw) {
          let req; try { req = JSON.parse(raw); } catch (_) { return; }
          window.__iapNativeTypes.push(req.type);
          if (Array.isArray(req.productIds)) window.__iapNativeProductLists.push(req.productIds.slice());
          const reply = {v:1, id:req.id, type:req.type + '.result', ok:true};
          if (req.type === 'iap.prices') reply.prices = prices;
          if (req.type === 'iap.buy') {
            window.__iapSimulatedPurchases.push(req.productId);
            Promise.resolve(window.__iapSimulatedPurchase(req.productId)).then(result => {
              reply.status = result.status; reply.productId = result.productId;
              window.dispatchEvent(new CustomEvent('ezik-iap', {detail:JSON.stringify(reply)}));
            });
            return;
          }
          window.dispatchEvent(new CustomEvent('ezik-iap', {detail:JSON.stringify(reply)}));
        }};
      }
    })();""")
    page = context.new_page()
    page.on("pageerror", lambda exc: state["page_errors"].append(str(exc)))
    set_routes(page, config, state)
    return context, page, state

def save_shot(page, filename):
    page.screenshot(path=os.path.join(OUT, filename), full_page=True, animations="disabled")

def home_snapshot(page):
    return page.evaluate("""() => {
      const visible = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
      const entry = document.querySelector('[data-action="iap-purchase"]');
      const notice = document.querySelector('.j-iap-notice');
      const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map(x => x.innerText || '');
      const text = document.body.innerText || '';
      return {
        entry: visible(entry),
        entryText: entry?.innerText || '',
        notice: visible(notice) ? notice.innerText : '',
        signInRuleNotice: visible(notice) ? (notice.querySelector('.j-note')?.innerText || '') : '',
        signInPrompt: /سجّل الدخول لتبدأ أسبوعك المجاني/.test(text),
        weekEnded: /انتهى أسبوعك المجاني للألعاب/.test(text),
        gameStage: window.KunuzJourney?.state?.stage || '',
        sessionStored: localStorage.getItem("ezik_auth_session_v1"),
        bridgePresent: !!window.ReactNativeWebView,
        nativeTypes: window.__iapNativeTypes || [],
        productLists: window.__iapNativeProductLists || [],
        dialogs,
        question: !!document.querySelector('.j-paper h2')
      };
    }""")

def run_home_cell(browser, config, name):
    context, page, state = new_page(browser, config)
    try:
        home_path = "/quest.html?iap_purchase=1" if config.get("purchase_query") else "/quest.html"
        response = page.goto(BASE + home_path, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("window.KunuzJourney?.state?.ready === true", timeout=60000)
        page.wait_for_timeout(350)
        if config.get("purchase_query"):
            page.locator(".ezik-iap-row").nth(2).wait_for(state="visible", timeout=15000)
        result = home_snapshot(page)
        result.update({"name": name, "http": response.status if response else 0, "mode": config["mode"], "role": config["role"], "platform": config["platform"], "native": bool(config.get("native")), "balanceCalls": state["balance_calls"], "trialCalls": state["trial_calls"], "consumeCalls": state["consume_calls"]})
        if config.get("purchase_query"):
            rows = page.locator(".ezik-iap-row")
            result["purchaseSheetOpen"] = rows.count() == 3
            result["listedProducts"] = [rows.nth(i).locator("h3").inner_text() for i in range(rows.count())]
            result["nativeProductListsAfterQuery"] = page.evaluate("window.__iapNativeProductLists")
        save_shot(page, name + ".png")
        if config.get("do_purchases"):
            assert result["entry"], name + ": owner purchase entry should be visible; debug=" + json.dumps({"result": result, "state": state}, ensure_ascii=False)
            page.locator('[data-action="iap-purchase"]').click()
            page.locator('[role="dialog"] .ezik-iap-row').nth(2).wait_for(state="visible", timeout=15000)
            rows = page.locator('[role="dialog"] .ezik-iap-row')
            result["listedProducts"] = [rows.nth(i).locator("h3").inner_text() for i in range(rows.count())]
            assert len(result["listedProducts"]) == 3, name + ": expected exactly three pass rows"
            result["nativeProductListsAfterOpen"] = page.evaluate("window.__iapNativeProductLists")
            assert result["nativeProductListsAfterOpen"][-1] == [row[0] for row in PASSES], name + ": expected the three pass product ids"
            save_shot(page, name + "-three-passes.png")
            for i, (product_id, _display, _days) in enumerate(PASSES):
                row = rows.nth(i)
                row.locator("input").fill("1")
                row.locator("button").click()
                page.wait_for_function(
                    "(id) => (window.__iapSimulatedPurchases || []).includes(id) && document.querySelector('.ezik-iap-balance')?.innerText.includes('اشتراكك حتى')",
                    arg=product_id, timeout=15000
                )
                result.setdefault("purchases", []).append({
                    "productId": product_id,
                    "simulatedBuySeen": product_id in state["purchases"],
                    "balanceCallCount": state["balance_calls"],
                    "balanceText": page.locator(".ezik-iap-balance").inner_text(),
                    "balanceCallReturning": state["balance_responses"][-1]
                })
                save_shot(page, name + "-purchase-" + str(i + 1) + ".png")
            assert state["purchases"] == [row[0] for row in PASSES], name + ": every pass must be simulated through the native bridge"
        return result
    finally:
        context.close()

def assert_signin_dialog(page, locked, name):
    dialog = page.locator('.ezik-iap-card')
    dialog.wait_for(state="visible", timeout=30000)
    text = dialog.inner_text()
    assert SIGNIN_TITLE in text and SIGNIN_COPY in text and SIGNIN_LINE in text, name + ": sign-in dialog copy mismatch"
    assert page.locator('a[href="/?ezik_iap_signin=1"]').count() == 1, name + ": existing sign-in link missing"
    close_count = page.locator('.ezik-iap-header button').count()
    if locked:
        assert close_count == 0, name + ": locked page dialog has a close button"
        assert page.get_by_role('button', name=SIGNIN_RETURN).count() == 1, name + ": locked page return button missing"
    else:
        assert close_count == 1, name + ": unlocked dialog must keep its close button"
        assert page.get_by_role('button', name=SIGNIN_RETURN).count() == 0, name + ": unlocked dialog has a return button"
    assert not any(word in text.casefold() for word in ('purchase', 'week', 'trial', 'شراء', 'أسبوع', 'تجربة')), name + ": sign-in dialog mentioned a purchase or trial"
    return text

def assert_no_iap_offer(page, state, name, allow_signin_dialog=False):
    assert page.locator('[data-action="iap-purchase"]:visible').count() == 0, name + ": purchase button is visible"
    assert page.locator('.ezik-iap-row:visible').count() == 0, name + ": purchase sheet is visible"
    if allow_signin_dialog:
        assert page.locator('.ezik-iap-backdrop:visible').count() == 1 and page.locator('.ezik-iap-card:visible').count() == 1, name + ": expected only the sign-in dialog"
    else:
        assert page.locator('.ezik-iap-backdrop:visible').count() == 0, name + ": IAP dialog is visible after access"
    for selector in ('.j-iap-notice:visible', '.ezik-iap-card:visible'):
        if page.locator(selector).count():
            copy = page.locator(selector).first.inner_text().casefold()
            assert not any(word in copy for word in ('week', 'trial', 'expired', 'أسبوع', 'تجربة', 'انتهى')), name + ": trial, week or expiry notice is visible"
    assert state["trial_calls"] == 0, name + ": trial-start was called"
    assert state["consume_calls"] == 0, name + ": consume was called"
    assert state["purchases"] == [], name + ": a purchase was simulated"

def entry_page_locked(page):
    return page.evaluate("() => { const nodes=[...document.body.children].filter(node => !node.classList.contains('ezik-iap-backdrop')); return nodes.length > 0 && nodes.every(node => node.inert === true); }")

def entry_page_unlocked(page):
    return page.evaluate("() => [...document.body.children].filter(node => !node.classList.contains('ezik-iap-backdrop')).every(node => node.inert !== true)")

def run_signin_home_cell(browser, rule, platform):
    name = "S-home-" + rule + "-" + platform + "-visitor"
    config = {"mode": "free", "signin": rule, "role": "visitor", "platform": platform,
              "native": platform in ("ios", "android"), "entry_enabled": False}
    context, page, state = new_page(browser, config)
    try:
        response = page.goto(BASE + "/quest.html", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("window.KunuzJourney?.state?.ready === true", timeout=60000)
        page.wait_for_function("document.querySelector('.j-iap-notice .j-note')?.innerText.length > 0", timeout=30000)
        home = home_snapshot(page)
        assert response and response.status == 200, name + ": home did not load"
        assert home["entry"] is False, name + ": purchase entry is visible"
        assert home["signInRuleNotice"] == SIGNIN_HOME_NOTICE, name + ": sign-in notice copy mismatch"
        assert page.locator('.j-iap-notice [data-action="dismiss-home-notice"]').count() == 1, name + ": existing hide button missing"
        assert not any(word in home["signInRuleNotice"].casefold() for word in ('purchase', 'week', 'trial', 'شراء', 'أسبوع', 'تجربة'))
        save_shot(page, name + ".png")
        page.locator('.j-featured').click()
        dialog_text = assert_signin_dialog(page, False, name + "-game-card")
        assert_no_iap_offer(page, state, name, allow_signin_dialog=True)
        save_shot(page, name + "-dialog.png")
        resumed_to_game = False
        if rule == "all" and platform == "web":
            mock_signin(page)
            page.wait_for_url("**/quest-ghaws.html", timeout=30000)
            page.wait_for_function("window.KunuzJourney?.state?.ready === true", timeout=60000)
            assert state["balance_calls"] == 2, name + ": expected one balance check for the resumed card and one for the destination page"
            assert_no_iap_offer(page, state, name + "-resumed")
            resumed_to_game = True
        return {"name": name, "rule": rule, "platform": platform, "http": response.status,
                "notice": home["signInRuleNotice"], "purchaseEntry": home["entry"],
                "dialog": dialog_text, "balanceCalls": state["balance_calls"],
                "trialCalls": state["trial_calls"], "consumeCalls": state["consume_calls"],
                "resumedToGame": resumed_to_game}
    finally:
        context.close()

def run_signin_home_notice_clear(browser):
    name = "S-home-notice-clears-after-signin"
    config = {"mode": "free", "signin": "all", "role": "visitor", "platform": "web",
              "native": False, "entry_enabled": False}
    context, page, state = new_page(browser, config)
    try:
        page.goto(BASE + "/quest.html", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("window.KunuzJourney?.state?.ready === true", timeout=60000)
        page.wait_for_function("document.querySelector('.j-iap-notice .j-note')?.innerText.length > 0", timeout=30000)
        mock_signin(page)
        page.wait_for_function("!document.querySelector('.j-iap-notice')", timeout=30000)
        assert page.locator('[data-action="iap-purchase"]:visible').count() == 0, name + ": purchase entry appeared"
        assert state["balance_calls"] == 0, name + ": home sign-in watch made an unnecessary balance call on web"
        assert_no_iap_offer(page, state, name)
        save_shot(page, name + ".png")
        return {"name": name, "noticeCleared": True, "purchaseEntry": False,
                "balanceCalls": state["balance_calls"], "trialCalls": state["trial_calls"],
                "consumeCalls": state["consume_calls"]}
    finally:
        context.close()

def run_signin_purchase_query(browser, rule, role):
    name = "S-purchase-query-" + rule + "-" + role
    config = {"mode": "free", "signin": rule, "role": role, "platform": "ios",
              "native": True, "entry_enabled": False}
    context, page, state = new_page(browser, config)
    try:
        response = page.goto(BASE + "/quest.html?iap_purchase=1", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("window.KunuzJourney?.state?.ready === true", timeout=60000)
        page.wait_for_timeout(500)
        assert response and response.status == 200, name + ": home did not load"
        assert page.locator('[data-action="iap-purchase"]:visible').count() == 0, name + ": purchase entry is visible"
        assert page.locator('.ezik-iap-row:visible').count() == 0, name + ": purchase sheet opened from query"
        assert page.locator('.ezik-iap-backdrop:visible').count() == 0, name + ": purchase dialog opened from query"
        assert state["balance_calls"] == (1 if role == "owner" else 0), name + ": unexpected balance call count"
        assert_no_iap_offer(page, state, name)
        save_shot(page, name + ".png")
        return {"name": name, "rule": rule, "role": role, "http": response.status,
                "purchaseEntry": False, "purchaseSheet": False, "balanceCalls": state["balance_calls"],
                "trialCalls": state["trial_calls"], "consumeCalls": state["consume_calls"]}
    finally:
        context.close()

def run_signin_access_cell(browser, rule, platform, role):
    name = "S-access-" + rule + "-" + platform + "-" + role
    config = {"mode": "free", "signin": rule, "role": "visitor" if role == "visitor" else "other",
              "platform": platform, "native": platform in ("ios", "android"),
              "entry_enabled": False, "balance_status": 401 if role == "401" else None}
    context, page, state = new_page(browser, config)
    try:
        response = page.goto(BASE + GAME_PATHS["dive"], wait_until="domcontentloaded", timeout=60000)
        if role in ("visitor", "401"):
            text = assert_signin_dialog(page, True, name)
            assert entry_page_locked(page), name + ": locked page is interactive"
            assert state["balance_calls"] == (0 if role == "visitor" else 1), name + ": wrong balance call count"
            save_shot(page, name + ".png")
            if role == "visitor" and rule == "all" and platform == "web":
                assert_no_iap_offer(page, state, name, allow_signin_dialog=True)
                page.get_by_role('button', name=SIGNIN_RETURN).click()
                page.wait_for_url("**/quest.html", timeout=30000)
                assert_no_iap_offer(page, state, name + "-returned-home")
            else:
                assert_no_iap_offer(page, state, name, allow_signin_dialog=True)
            return {"name": name, "rule": rule, "platform": platform, "role": role,
                    "http": response.status if response else 0, "dialog": text,
                    "locked": True, "balanceCalls": state["balance_calls"],
                    "trialCalls": state["trial_calls"], "consumeCalls": state["consume_calls"]}
        page.wait_for_function("window.KunuzJourney?.state?.ready === true", timeout=60000)
        gate = page.evaluate("async () => await window.ezikIapPageGate")
        assert gate is True, name + ": signed-in page gate did not allow entry"
        assert page.locator('.ezik-iap-card:visible').count() == 0, name + ": valid session showed a dialog"
        assert entry_page_unlocked(page), name + ": valid session page stayed locked"
        assert state["balance_calls"] == 1, name + ": expected one online balance check"
        assert_no_iap_offer(page, state, name)
        save_shot(page, name + ".png")
        return {"name": name, "rule": rule, "platform": platform, "role": role,
                "http": response.status if response else 0, "locked": False,
                "balanceCalls": state["balance_calls"], "trialCalls": state["trial_calls"],
                "consumeCalls": state["consume_calls"]}
    finally:
        context.close()

def run_signin_join_cell(browser, rule, path, search, index):
    name = "S-join-" + rule + "-" + str(index)
    config = {"mode": "free", "signin": rule, "role": "visitor", "platform": "web",
              "native": False, "entry_enabled": False}
    context, page, state = new_page(browser, config)
    try:
        page.route_web_socket("wss://hanna-laha.hl-worker.workers.dev/**",
                              lambda socket: socket.close(code=1000, reason="local matrix; no room"))
        response = page.goto(BASE + path + search, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("window.ezikIapPageGate !== undefined", timeout=30000)
        gate = page.evaluate("async () => await window.ezikIapPageGate")
        if rule == "all":
            text = assert_signin_dialog(page, True, name)
            assert gate is False, name + ": rule all allowed a joiner without sign-in"
            assert entry_page_locked(page), name + ": join page is interactive before sign-in"
            save_shot(page, name + ".png")
        else:
            assert gate is True, name + ": host rule blocked a joiner"
            assert page.locator('.ezik-iap-card:visible').count() == 0, name + ": host rule showed a sign-in dialog"
            text = ""
        assert response and response.status == 200, name + ": join page did not load"
        assert state["balance_calls"] == 0, name + ": join gate called balance without a session"
        assert_no_iap_offer(page, state, name, allow_signin_dialog=(rule == "all"))
        assert state["room_messages"] == [], name + ": matrix opened a room"
        if rule == "host": save_shot(page, name + ".png")
        return {"name": name, "rule": rule, "path": path + search, "http": response.status,
                "gate": gate, "dialog": text, "balanceCalls": state["balance_calls"],
                "trialCalls": state["trial_calls"], "consumeCalls": state["consume_calls"],
                "roomMessages": len(state["room_messages"])}
    finally:
        context.close()

def run_signin_matrix(browser):
    results = {"homes": [], "homeNoticeClear": None, "purchaseQuery": [], "access": [], "games": [], "joins": []}
    for rule in ("all", "host"):
        for platform in ("ios", "android", "web"):
            results["homes"].append(run_signin_home_cell(browser, rule, platform))
    results["homeNoticeClear"] = run_signin_home_notice_clear(browser)
    for rule in ("all", "host"):
        for role in ("visitor", "owner"):
            results["purchaseQuery"].append(run_signin_purchase_query(browser, rule, role))
    for rule in ("all", "host"):
        for platform in ("ios", "android", "web"):
            for role in ("visitor", "signed", "401"):
                results["access"].append(run_signin_access_cell(browser, rule, platform, role))
    for game in GAME_PATHS:
        config = {"mode": "free", "signin": "all", "role": "visitor", "platform": "web",
                  "native": False, "entry_enabled": False, "mock_signin": True}
        results["games"].append(smoke_game(browser, config, game, "S-after-signin-" + game))
    join_paths = [
        ("/hanna-laha/join", ""),
        ("/hanna-laha/j/1234", ""),
        ("/quest-board.html", "?board=1234"),
        ("/quest-harb.html", "?iap_join=1"),
        ("/quest-board.html", "?iap_join=1"),
        ("/hanna-laha/", "?iap_join=1"),
    ]
    for rule in ("all", "host"):
        for index, (path, search) in enumerate(join_paths, 1):
            results["joins"].append(run_signin_join_cell(browser, rule, path, search, index))
    assert len(results["homes"]) == 6
    assert sum(bool(row.get("resumedToGame")) for row in results["homes"]) == 1
    assert results["homeNoticeClear"]["noticeCleared"] is True
    assert len(results["purchaseQuery"]) == 4 and all(not row["purchaseEntry"] and not row["purchaseSheet"] for row in results["purchaseQuery"])
    assert len(results["access"]) == 18
    assert len(results["games"]) == 5 and all(row["signInDialogSeen"] for row in results["games"])
    assert all(row["question"] for row in results["games"])
    assert len(results["joins"]) == 12
    assert all(row["gate"] is False for row in results["joins"] if row["rule"] == "all")
    assert all(row["gate"] is True for row in results["joins"] if row["rule"] == "host")
    assert all(row["trialCalls"] == 0 and row["consumeCalls"] == 0 for group in ("homes", "access", "games", "joins") for row in results[group])
    return results

def open_first_dive_question(page):
    stage = page.evaluate("window.KunuzJourney.state.stage")
    if stage == "handover":
        page.locator('[data-action="dive-begin"]').click()
        page.wait_for_function("window.KunuzJourney.state.stage === 'dive'", timeout=15000)
    if page.evaluate("window.KunuzJourney.state.stage") == "dive" and not page.evaluate("!!window.KunuzJourney.state.question"):
        page.locator('[data-action="shell"]').first.click()

def mock_signin(page):
    page.evaluate("""() => {
      localStorage.setItem('ezik_auth_session_v1', JSON.stringify({session:'synthetic-session-after-signin'}));
      window.dispatchEvent(new StorageEvent('storage', {key:'ezik_auth_session_v1'}));
      window.dispatchEvent(new Event('focus'));
    }""")

def smoke_game(browser, config, game, name):
    context, page, state = new_page(browser, config)
    try:
        response = page.goto(BASE + GAME_PATHS[game], wait_until="domcontentloaded", timeout=60000)
        sign_in_dialog_seen = False
        if config.get("mock_signin"):
            dialog = page.locator('.ezik-iap-card')
            dialog.wait_for(state="visible", timeout=30000)
            dialog_text = dialog.inner_text()
            assert SIGNIN_TITLE in dialog_text and SIGNIN_COPY in dialog_text and SIGNIN_LINE in dialog_text, name + ": sign-in copy mismatch"
            assert page.locator('.ezik-iap-header button').count() == 0, name + ": locked page had a close button"
            assert page.get_by_role('button', name=SIGNIN_RETURN).count() == 1, name + ": locked page missed the return button"
            assert not any(word in dialog_text.casefold() for word in ('purchase', 'week', 'trial', 'شراء', 'أسبوع', 'تجربة')), name + ": sign-in dialog mentioned purchases or trial"
            sign_in_dialog_seen = True
            mock_signin(page)
        page.wait_for_function("() => window.KunuzJourney?.state?.ready === true", timeout=60000)
        page.wait_for_function("() => window.KunuzJourney.state.stage !== 'loading'", timeout=60000)
        if page.evaluate("window.KunuzJourney.state.stage") == "room-entry":
            page.locator('[data-action="single-device"]').click()
            page.wait_for_function("() => window.KunuzJourney.state.stage === 'categories'", timeout=10000)
        if page.evaluate("window.KunuzJourney.state.stage") == "categories":
            buttons = page.locator('[data-action="cat"]')
            for i in range(min(3, buttons.count())):
                if buttons.nth(i).get_attribute("aria-pressed") != "true":
                    buttons.nth(i).click()
            page.locator('[data-action="next-setup"]').click()
            page.wait_for_function("() => window.KunuzJourney.state.stage === 'settings'", timeout=15000)
        if game == "test-your-knowledge":
            page.locator('[data-action="quiz-start"]').click()
        else:
            page.locator('[data-action="start"]').click()
        if game == "dive":
            page.wait_for_function("() => window.KunuzJourney.state.stage === 'dive' || window.KunuzJourney.state.stage === 'handover'", timeout=20000)
            open_first_dive_question(page)
        elif game == "islands-war":
            page.wait_for_function("() => window.KunuzJourney.state.stage === 'war'", timeout=20000)
            # Follow the game's legal opening plan so each team can finish its flag deal.
            opening = page.evaluate("""() => {
              const g=window.KunuzJourney.state.g, links=window.WarEngine.LINKS;
              return links.flatMap(([a,b])=>[[a,b],[b,a]]).find(([a,b])=>g.own[a]===0&&g.own[b]!==0);
            }""")
            assert opening, "islands war has no legal opening deployment"
            for _ in range(4):
                game_state = page.evaluate("""() => ({phase:window.KunuzJourney.state.g.phase, turn:window.KunuzJourney.state.g.turn, pool:window.KunuzJourney.state.g.pool, own:window.KunuzJourney.state.g.own})""")
                if game_state["phase"] != "deploy": break
                turn = game_state["turn"]
                island = opening[0] if turn == 0 else page.evaluate(
                    "(target) => Object.keys(window.KunuzJourney.state.g.own).map(Number).find(i => window.KunuzJourney.state.g.own[i] === window.KunuzJourney.state.g.turn && i !== target)",
                    opening[1]
                )
                assert island is not None, "islands war has no legal deployment island"
                while page.evaluate("window.KunuzJourney.state.g.pool") > 0:
                    page.locator('[data-island="' + str(island) + '"]').click()
                page.locator('[data-action="war-next"]').click()
                page.wait_for_function("(turn) => window.KunuzJourney.state.g.phase !== 'deploy' || window.KunuzJourney.state.g.turn !== turn", arg=turn, timeout=10000)
            attack = page.evaluate("""() => {
              const g=window.KunuzJourney.state.g, links=window.WarEngine.LINKS;
              for(const [base,owner] of Object.entries(g.own)) if(owner===g.turn && g.ban[base]>=2 && !window.WarEngine.isDead(g,+base))
                for(const [a,b] of links) { const target=String(a)===base?b:String(b)===base?a:null;
                  if(target!==null && g.own[target]!==g.turn && !window.WarEngine.isDead(g,target)) return [+base,target]; }
              return null;
            }""")
            if not attack: raise AssertionError("islands war has no legal local attack")
            page.locator('[data-island="' + str(attack[0]) + '"]').click()
            page.locator('[data-island="' + str(attack[1]) + '"]').click()
        elif game in ("category-challenge", "hanna-laha"):
            page.wait_for_function("() => window.KunuzJourney.state.stage === 'board'", timeout=20000)
            page.locator('[data-action="tile"]:not([disabled])').first.click()
        page.wait_for_function("() => !!window.KunuzJourney.state.question && !!document.querySelector('.j-paper h2')", timeout=30000)
        text = page.locator(".j-paper h2").first.inner_text()
        assert text.strip(), game + ": empty first question"
        assert page.locator(".ezik-iap-backdrop").count() == 0, game + ": free mode showed a purchase lock"
        if config.get("mock_signin"):
            assert state["balance_calls"] >= 1, name + ": expected a balance check after mocked sign-in"
            assert page.locator('[data-action="iap-purchase"]:visible').count() == 0, name + ": purchase button is visible"
            assert page.locator(".ezik-iap-row:visible").count() == 0, name + ": purchase sheet is visible"
            assert not state["purchases"], name + ": a purchase was simulated"
        result = {
            "name": name, "game": game, "status": response.status if response else 0,
            "stage": page.evaluate("window.KunuzJourney.state.stage"),
            "question": text, "balanceCalls": state["balance_calls"],
            "signInDialogSeen": sign_in_dialog_seen,
            "trialCalls": state["trial_calls"], "consumeCalls": state["consume_calls"]
        }
        prefix = "S-game-" if config.get("mock_signin") else "A-game-"
        save_shot(page, prefix + name + "-" + game + "-first-question.png")
        assert state["trial_calls"] == 0, game + ": free mode must not start trial"
        assert state["consume_calls"] == 0, game + ": free mode must not consume"
        return result
    finally:
        context.close()

def free_join_by_code(browser):
    config = {"mode": "free", "role": "visitor", "platform": "web", "native": False, "entry_enabled": False}
    context, page, state = new_page(browser, config)
    try:
        page.route_web_socket("wss://hanna-laha.hl-worker.workers.dev/ws/board/**", lambda ws: mock_socket_route(ws, state))
        response = page.goto(BASE + "/quest-board.html", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("window.KunuzJourney?.state?.ready === true", timeout=60000)
        page.wait_for_function("window.KunuzJourney.state.stage === 'room-entry'", timeout=30000)
        page.locator('[data-action="join-room"]').click()
        page.locator('#j-room-entry-code').fill("1234")
        save_shot(page, "A-free-room-join-code-entry.png")
        page.locator('[data-action="join-submit"]').click()
        page.wait_for_function("window.KunuzJourney.state.stage === 'board-room' && document.querySelector('.j-board-room-code')", timeout=30000)
        page.locator('[data-action="br-seat"]').first.click()
        page.locator('[data-board-name]').fill("Synthetic local team")
        page.locator('[data-action="br-join-team"]').click()
        page.wait_for_function("window.KunuzJourney.boardRooms?.snapshot?.self?.role === 'team'", timeout=20000)
        assert page.locator(".ezik-iap-backdrop").count() == 0, "free room join showed an IAP lock"
        assert state["trial_calls"] == 0 and state["consume_calls"] == 0, "free room join touched trial/consume endpoints"
        save_shot(page, "A-free-room-join-connected-local-simulation.png")
        return {"status": response.status if response else 0, "joined": True, "code": "1234 synthetic local code", "roomMessages": state["room_messages"], "trialCalls": state["trial_calls"], "consumeCalls": state["consume_calls"]}
    finally:
        context.close()

def mock_socket_route(ws, state):
    snapshot = {
        "bankStamp": BANK_STAMP, "roomId": "local-room-synthetic", "version": 1, "phase": "lobby",
        "self": {"role": "candidate", "slot": -1}, "cats": [0],
        "teams": [{"name": "الفريق ١", "color": 0, "score": 0, "shows": 2, "claimed": False, "online": True}],
        "slots": [], "turn": 0,
        "settings": {"options": "shown", "timeMs": 30000, "reveals": 2, "questionOrder": "mixed"},
        "question": None, "gameNumber": 0, "restartCats": [], "serverNow": int(time.time() * 1000)
    }
    def on_message(data):
        if data == "ping":
            ws.send("pong"); return
        try: msg = json.loads(data)
        except Exception: return
        state["room_messages"].append(msg.get("t", ""))
        if msg.get("t") == "hello":
            ws.send(json.dumps({"t": "snapshot", "snapshot": snapshot}, ensure_ascii=False))
        elif msg.get("t") == "join":
            ws.send(json.dumps({"t": "joined", "teamToken": "synthetic-local-team-token", "roomId": snapshot["roomId"]}))
            joined = dict(snapshot); joined["version"] = 2; joined["self"] = {"role": "team", "slot": 0}
            joined["teams"] = [{"name": "Synthetic local team", "color": 0, "score": 0, "shows": 2, "claimed": True, "online": True}]
            ws.send(json.dumps({"t": "snapshot", "snapshot": joined}, ensure_ascii=False))
    ws.on_message(on_message)

def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--existing-only", action="store_true", help="run the existing A-D matrix")
    group.add_argument("--existing-setup-only", action="store_true", help="run the existing A-D home and lock cells")
    group.add_argument("--existing-games", metavar="START:END", help="run a zero-based slice of the 70 existing first-question cells")
    group.add_argument("--signin-only", action="store_true", help="run matrix S for the sign-in rule")
    args = parser.parse_args()
    game_slice = None
    if args.existing_games:
        try:
            start, end = (int(value) for value in args.existing_games.split(":"))
        except (TypeError, ValueError):
            parser.error("--existing-games must be START:END")
        if not (0 <= start < end <= 70):
            parser.error("--existing-games must be a non-empty slice within 0:70")
        game_slice = (start, end)
    preflight_existing = game_slice is None
    run_existing_games = not args.existing_setup_only
    if args.signin_only:
        results = {"startedAt": datetime.now(timezone.utc).isoformat(), "simulatedOnly": True,
                   "productionRequests": None, "matrix": None}
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, executable_path=CHROMIUM)
                try:
                    results["matrix"] = run_signin_matrix(browser)
                finally:
                    browser.close()
            results["finishedAt"] = datetime.now(timezone.utc).isoformat()
            results["productionRequests"] = len(EXTERNAL_REQUESTS)
            results["externalRequestUrls"] = EXTERNAL_REQUESTS
            assert not EXTERNAL_REQUESTS, "browser attempted external requests: " + repr(EXTERNAL_REQUESTS)
            results["ok"] = True
            with open(os.path.join(OUT, "iap-signin-browser-evidence.json"), "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
                f.write("\n")
            matrix = results["matrix"]
            print("S_HOME_CELLS=" + str(len(matrix["homes"])) + " S_ACCESS_CELLS=" + str(len(matrix["access"])) +
                  " S_GAMES=" + str(len(matrix["games"])) + " S_JOIN_CELLS=" + str(len(matrix["joins"])))
            print("S_FIRST_QUESTIONS=" + str(sum(bool(row["question"]) for row in matrix["games"])) + "/5 " +
                  "PRODUCTION_REQUESTS=0 TRIAL_START=0 CONSUME=0")
            print("BROWSER_SIGNIN_MATRIX=PASS")
        finally:
            server.shutdown()
        return
    results = {"startedAt": datetime.now(timezone.utc).isoformat(), "simulatedOnly": True, "productionRequests": None, "matrices": {"A": [], "B": [], "C": [], "D": []}, "games": [], "roomJoin": None}
    if args.existing_setup_only: results["phase"] = "existing-setup"
    elif game_slice: results["phase"] = "existing-games-" + str(game_slice[0]) + "-" + str(game_slice[1])
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROMIUM)
        try:
            for platform in (("ios", "android", "web") if preflight_existing else ()):
                for role in ("owner", "other", "visitor"):
                    config = {"mode": "free", "role": role, "platform": platform, "native": platform in ("ios", "android"), "entry_enabled": True, "do_purchases": role == "owner" and platform in ("ios", "android")}
                    name = "A-" + platform + "-" + role
                    results["matrices"]["A"].append(run_home_cell(browser, config, name))
            if preflight_existing:
                config = {"mode": "free", "role": "owner", "platform": "ios", "native": False, "entry_enabled": True}
                results["matrices"]["A"].append(run_home_cell(browser, config, "A-ios-owner-no-bridge"))

            for platform in (("ios", "android") if preflight_existing else ()):
                for role in ("owner", "other"):
                    config = {"mode": "free", "role": role, "platform": platform, "native": True, "entry_enabled": False}
                    results["matrices"]["B"].append(run_home_cell(browser, config, "B-" + platform + "-" + role))

            for platform in (("ios", "android") if preflight_existing else ()):
                for role in ("owner", "other", "visitor"):
                    config = {"mode": "test", "role": role, "platform": platform, "native": True, "entry_enabled": False, "enforced": True}
                    results["matrices"]["C"].append(run_home_cell(browser, config, "C-" + platform + "-" + role))
            # D: paid mode must expose the store entry and open the native sheet from the purchase return URL on both shells.
            for platform in (("ios", "android") if preflight_existing else ()):
                config = {"mode": "all", "role": "owner", "platform": platform, "native": True, "entry_enabled": False, "enforced": True, "purchase_query": True}
                results["matrices"]["D"].append(run_home_cell(browser, config, "D-all-" + platform + "-purchase-query"))
            # T4 lock behavior on game start: an expired listed synthetic account is locked, while an unlisted account and visitor enter.
            for platform, role, enforced in ((("ios", "owner", True), ("android", "owner", True), ("ios", "other", False), ("android", "other", False), ("ios", "visitor", False), ("android", "visitor", False)) if preflight_existing else ()):
                config = {"mode": "test", "role": role, "platform": platform, "native": platform in ("ios", "android"), "entry_enabled": False, "enforced": enforced}
                context, page, state = new_page(browser, config)
                try:
                    page.goto(BASE + GAME_PATHS["dive"], wait_until="domcontentloaded", timeout=60000)
                    visible_gate = "(() => { const d=document.querySelector('.ezik-iap-card'); return !!d && getComputedStyle(d).display !== 'none' && getComputedStyle(d).visibility !== 'hidden'; })()"
                    ready = "window.KunuzJourney?.state?.ready === true && window.KunuzJourney.state.stage !== 'loading'"
                    try:
                        page.wait_for_function(visible_gate + " || (" + ready + ")", timeout=30000)
                    except PlaywrightTimeoutError:
                        debug = page.evaluate("""async () => {
                          const gate=window.ezikIapPageGate;
                          const gateResult=await Promise.race([Promise.resolve(gate).then(v=>({settled:true,value:v})),new Promise(r=>setTimeout(()=>r({settled:false}),100))]);
                          return {url:location.href,session:localStorage.getItem('ezik_auth_session_v1'),stage:window.KunuzJourney?.state?.stage,ready:window.KunuzJourney?.state?.ready,gate:gateResult,dialogs:[...document.querySelectorAll('[role="dialog"]')].map(d=>({className:d.className,text:d.innerText,display:getComputedStyle(d).display})),body:(document.body.innerText||'').slice(0,1200)};
                        }""")
                        save_shot(page, "C-game-lock-debug-" + platform + "-" + role + ".png")
                        print("C_LOCK_DEBUG=" + json.dumps({"platform": platform, "role": role, "page": debug, "state": state, "pageErrors": state["page_errors"]}, ensure_ascii=True))
                        raise
                    locked = page.evaluate(visible_gate)
                    if not locked:
                        if page.evaluate("window.KunuzJourney.state.stage") == "room-entry":
                            page.locator('[data-action="single-device"]').click()
                            page.wait_for_function("window.KunuzJourney.state.stage === 'categories'", timeout=10000)
                        if page.evaluate("window.KunuzJourney.state.stage") == "categories":
                            buttons = page.locator('[data-action="cat"]')
                            for i in range(min(3, buttons.count())):
                                if buttons.nth(i).get_attribute("aria-pressed") != "true":
                                    buttons.nth(i).click()
                            page.locator('[data-action="next-setup"]').click()
                            page.wait_for_function("window.KunuzJourney.state.stage === 'settings'", timeout=15000)
                        page.locator('[data-action="start"]').click()
                        page.wait_for_function(
                            visible_gate + " || window.KunuzJourney.state.stage === 'dive' || window.KunuzJourney.state.stage === 'handover'",
                            timeout=30000
                        )
                        if not page.evaluate(visible_gate) and page.evaluate("window.KunuzJourney.state.stage") in ("dive", "handover"):
                            open_first_dive_question(page)
                        try:
                            page.wait_for_function(visible_gate + " || !!window.KunuzJourney.state.question", timeout=20000)
                        except PlaywrightTimeoutError:
                            debug = page.evaluate("""() => ({stage:window.KunuzJourney?.state?.stage,ready:window.KunuzJourney?.state?.ready,dialogs:[...document.querySelectorAll('[role="dialog"]')].map(d=>({className:d.className,text:d.innerText}))})""")
                            save_shot(page, "C-game-start-debug-" + platform + "-" + role + ".png")
                            print("C_START_DEBUG=" + json.dumps({"platform": platform, "role": role, "page": debug, "state": state, "pageErrors": state["page_errors"]}, ensure_ascii=True))
                            raise
                        locked = page.evaluate(visible_gate)
                    expected_locked = role == "owner"
                    assert locked == expected_locked, "C-game-lock-" + platform + "-" + role + ": lock mismatch"
                    save_shot(page, "C-game-lock-" + platform + "-" + role + ".png")
                    results["matrices"]["C"].append({"gameLock": {"platform": platform, "role": role, "locked": locked, "balanceCalls": state["balance_calls"]}})
                finally:
                    context.close()

            # A: each account/client cell reaches the first question in all five games.
            a_game_cells = [(platform, role, platform in ("ios", "android")) for platform in ("ios", "android", "web") for role in ("owner", "other", "visitor")]
            a_game_cells.append(("ios", "owner", False))
            game_cases = []
            for platform, role, native in a_game_cells:
                config = {"mode": "free", "role": role, "platform": platform, "native": native, "entry_enabled": True}
                for game in GAME_PATHS:
                    name = role + "-" + platform + ("-bridge" if native else "-no-bridge")
                    game_cases.append((config, game, name))
            # B: after entry removal, all five games still open for every signed-in matrix cell.
            for platform in ("ios", "android"):
                for role in ("owner", "other"):
                    config = {"mode": "free", "role": role, "platform": platform, "native": True, "entry_enabled": False}
                    for game in GAME_PATHS:
                        game_cases.append((config, game, "B-" + role + "-" + platform))
            selected_game_slice = game_slice or (0, len(game_cases))
            if run_existing_games:
                for case_index in range(*selected_game_slice):
                    config, game, name = game_cases[case_index]
                    results["games"].append(smoke_game(browser, config, game, name))
            # Join-by-code reaches a connected lobby through a local mock socket; no live room is opened.
            if preflight_existing:
                results["roomJoin"] = free_join_by_code(browser)
        finally:
            browser.close()
    results["finishedAt"] = datetime.now(timezone.utc).isoformat()
    results["productionRequests"] = len(EXTERNAL_REQUESTS)
    results["externalRequestUrls"] = EXTERNAL_REQUESTS
    assert not EXTERNAL_REQUESTS, "browser attempted external requests: " + repr(EXTERNAL_REQUESTS)
    results["ok"] = True
    for group in ("A", "B", "C", "D"):
        for row in results["matrices"][group]:
            assert row.get("http", 200) == 200, group + ": local home page status"
            if group in ("A", "B"):
                should_show = group == "A" and row["role"] == "owner" and row.get("native") and not row["name"].endswith("no-bridge")
                assert row["entry"] == should_show, row["name"] + ": purchase entry mismatch"
                if row["mode"] == "free":
                    assert row["notice"] == "" and not row["signInPrompt"] and not row["weekEnded"], row["name"] + ": free mode week UI"
            if group == "C" and row.get("name", "").startswith("C-"):
                expected_entry = row["platform"] == "ios" and row["role"] != "visitor"
                assert row["entry"] == expected_entry, row["name"] + ": today's entry mismatch"
            if group == "D":
                assert row["entry"], row["name"] + ": all mode purchase entry should be visible"
                assert row["purchaseSheetOpen"], row["name"] + ": purchase query should open the native purchase sheet"
                assert row["listedProducts"] == [row[1] for row in PASSES], row["name"] + ": expected all three passes in the sheet"
                assert row["nativeProductListsAfterQuery"][-1] == [row[0] for row in PASSES], row["name"] + ": native price request should contain all three pass ids"
        assert True
    if run_existing_games:
        expected_game_count = len(game_cases) if game_slice is None else game_slice[1] - game_slice[0]
        assert len(results["games"]) == expected_game_count
        assert all(row["trialCalls"] == 0 and row["consumeCalls"] == 0 for row in results["games"])
    if preflight_existing:
        assert results["roomJoin"] and results["roomJoin"]["joined"]
    results["ok"] = True
    evidence_name = "iap-launch-browser-evidence.json"
    if args.existing_setup_only: evidence_name = "iap-launch-browser-evidence-setup.json"
    elif game_slice: evidence_name = "iap-launch-browser-evidence-games-" + str(game_slice[0]) + "-" + str(game_slice[1]) + ".json"
    with open(os.path.join(OUT, evidence_name), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("A_HOME_CELLS=" + str(len(results["matrices"]["A"])) + " B_HOME_CELLS=" + str(len(results["matrices"]["B"])) + " C_HOME_CELLS=" + str(sum(1 for row in results["matrices"]["C"] if row.get("name", "").startswith("C-"))) + " C_LOCK_CASES=" + ("6" if preflight_existing else "0") + " D_ALL_HOME_CELLS=" + str(len(results["matrices"]["D"])) + " D_PURCHASE_SHEETS=" + str(sum(1 for row in results["matrices"]["D"] if row.get("purchaseSheetOpen"))))
    room_joined = bool(results["roomJoin"] and results["roomJoin"].get("joined"))
    print("GAME_FIRST_QUESTIONS=" + str(len(results["games"])) + "/" + str(len(game_cases)) + " ROOM_JOIN_LOCAL_SIMULATION=" + str(room_joined))
    for row in results["matrices"]["A"] + results["matrices"]["B"] + results["matrices"]["C"] + results["matrices"]["D"]:
        print(row.get("name", "game-lock") + " entry=" + str(row.get("entry", "")) + " notice=" + str(bool(row.get("notice", ""))) + " signIn=" + str(row.get("signInPrompt", "")))
    print("BROWSER_MATRIX=" + ("PASS" if results["ok"] else "FAIL"))
    server.shutdown()

if __name__ == "__main__":
    main()
