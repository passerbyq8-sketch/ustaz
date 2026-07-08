// apply-parental-gate-06.cjs
const fs = require('fs');
const FILE = process.argv[2] || 'index.html';
const b = (s) => Buffer.from(s, 'base64').toString('utf8');

const AR = {
  title:   b('2KrYo9mD2YrYryDZiNmE2Yog2KfZhNij2YXYsQ=='),
  sub:     b('2YfYsNinINin2YTZgtiz2YUg2YXYrti12ZHYtSDZhNmE2YPYqNin2LEuINmE2YTYqtij2YPZitivINij2YbZkSDZiNmE2YrZi9mR2Kcg2K3Yp9i22LHYjCDYp9it2LPYqCDYp9mE2YbYp9iq2Kw6'),
  place:   b('2KfZhNis2YjYp9io'),
  error:   b('2KzZiNin2Kgg2LrZitixINi12K3Zitit2Iwg2K3Yp9mI2YQg2YXYsdipINij2K7YsdmJ'),
  confirm: b('2KrYo9mD2YrYrw=='),
  back:    b('2LHYrNmI2Lk='),
  honesty: b('2KfYrtiq2LEg2LnZhdix2YMg2KfZhNit2YLZitmC2Yog2K3YqtmJINij2YLYr9mR2YUg2YTZgyDZhdinINmK2YbYp9iz2KjZgw=='),
};

let src = fs.readFileSync(FILE, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';
const N = (needle) => src.split(needle).length - 1;

if (src.includes('function AdultGate(')) {
  console.log('[skip] AdultGate already present - nothing to do (idempotent). No write.');
  process.exit(0);
}

const GATE =
'function AdultGate({ a, b, onPass, onCancel }) {' + EOL +
'  const [answer, setAnswer] = useState("");' + EOL +
'  const [error, setError] = useState(false);' + EOL +
'  const submit = () => {' + EOL +
'    const v = parseInt(String(answer).replace(/[\u0660-\u0669]/g, x => x.charCodeAt(0) - 0x0660), 10);' + EOL +
'    if (v === a * b) onPass();' + EOL +
'    else { setError(true); setTimeout(() => setError(false), 1500); }' + EOL +
'  };' + EOL +
'  return (' + EOL +
'    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(30,30,30,0.6)" }}>' + EOL +
'      <div style={{ ...s.onboardingCard, maxWidth: 360 }}>' + EOL +
'        <div style={s.bigEmoji}>\uD83D\uDD12</div>' + EOL +
'        <div style={s.onboardingTitle}>' + AR.title + '</div>' + EOL +
'        <div style={s.onboardingSubtitle}>' + AR.sub + '</div>' + EOL +
'        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "0.08em", margin: "12px 0", color: "#2C5F5D", direction: "ltr" }}>{a} \u00D7 {b}</div>' + EOL +
'        <input type="text" inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="' + AR.place + '" autoFocus style={{ ...s.onboardingInput, textAlign: "center", borderColor: error ? "#C44536" : "#E5DDD0" }} />' + EOL +
'        {error && <div style={{ color: "#C44536", fontSize: 14, marginTop: -4, marginBottom: 8 }}>' + AR.error + '</div>}' + EOL +
'        <button onClick={submit} style={s.primaryBtn}>' + AR.confirm + '</button>' + EOL +
'        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#7A7267", fontSize: 14, marginTop: 10, cursor: "pointer" }}>' + AR.back + '</button>' + EOL +
'      </div>' + EOL +
'    </div>' + EOL +
'  );' + EOL +
'}' + EOL + EOL;

const FUNNEL =
'const adultAgeValid = adultAgeNum >= 18 && adultAgeNum <= 99;' + EOL +
'  const [gate, setGate] = useState(null);' + EOL +
'  const requestStart = (n) => {' + EOL +
'    if (n >= 18) {' + EOL +
'      const a = 13 + Math.floor(Math.random() * 87);' + EOL +
'      const b = 3 + Math.floor(Math.random() * 7);' + EOL +
'      setGate({ a, b, age: n });' + EOL +
'    } else {' + EOL +
'      onStart(name, n, gender);' + EOL +
'    }' + EOL +
'  };';

const RENDER =
'{gate && <AdultGate a={gate.a} b={gate.b} onPass={() => onStart(name, gate.age, gender)} onCancel={() => setGate(null)} />}' + EOL +
'        {step === 0 && (';

const HONESTY =
'<div style={{ ...s.onboardingSubtitle, fontSize: 13, opacity: 0.85 }}>' + AR.honesty + '</div>' + EOL +
'            <div style={s.ageGrid}>';

const edits = [
  { name: 'A', anchor: 'function Onboarding({ onStart }) {', expect: 1,
    apply: (t) => t.replace('function Onboarding({ onStart }) {', GATE + 'function Onboarding({ onStart }) {') },
  { name: 'B', anchor: 'const adultAgeValid = adultAgeNum >= 18 && adultAgeNum <= 99;', expect: 1,
    apply: (t) => t.replace('const adultAgeValid = adultAgeNum >= 18 && adultAgeNum <= 99;', FUNNEL) },
  { name: 'D', anchor: '{step === 0 && (', expect: 1,
    apply: (t) => t.replace('{step === 0 && (', RENDER) },
  { name: 'E', anchor: '<div style={s.ageGrid}>', expect: 1,
    apply: (t) => t.replace('<div style={s.ageGrid}>', HONESTY) },
  { name: 'C1', anchor: 'setTimeout(() => onStart(name, n, gender), 250)', expect: 2,
    apply: (t) => t.split('setTimeout(() => onStart(name, n, gender), 250)').join('setTimeout(() => requestStart(n), 250)') },
  { name: 'C2', anchor: 'onStart(name, adultAgeNum, gender)', expect: 2,
    apply: (t) => t.split('onStart(name, adultAgeNum, gender)').join('requestStart(adultAgeNum)') },
];

let ok = true;
console.log('[counts] anchor validation against pristine ' + FILE + ':');
for (const e of edits) {
  const c = N(e.anchor);
  const good = c === e.expect;
  if (!good) ok = false;
  console.log('  ' + (good ? 'OK  ' : 'FAIL') + ' [' + c + '/' + e.expect + ']  ' + e.name);
}
if (!ok) { console.error('[abort] count mismatch - writing NOTHING.'); process.exit(1); }

let out = src;
for (const e of edits) out = e.apply(out);
fs.writeFileSync(FILE, out, 'utf8');
console.log('[done] Applied AdultGate + funnel + honesty to ' + FILE + '.');
