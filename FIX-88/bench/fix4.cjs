'use strict';
// DEFECT 12 -- the adhkar opens on one group and the chest names the group and
// not the section, so the reader cannot tell where he is standing.
const fs = require('fs');
const P = 'C:/Users/passe/projects/ustaz-fix88/app.jsx';
let s = fs.readFileSync(P, 'utf8');
const before = s;
let n = 0;
function one(find, replace, label) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('anchor ' + label + ' occurs ' + c + ' times');
  s = s.replace(find, replace);
  n += 1;
}

// -- 1. THE SECTION'S NAME ABOVE THE GROUP'S ---------------------------------
one(
`          <span className="ezia-brand">
            <span className="ezia-brand-arch" aria-hidden="true" />
            <span style={s.eziaReadTitle}>{v.cat.title}</span>
          </span>`,
`          {/* DEFECT 12 (item 88) -- THE SECTION IS NAMED ABOVE THE GROUP.
              MEASURED: pressing «الأذكار» on the shelf lands on a chest that reads «أذكار
              المساء», because adhkarTimeDoor opens the group that belongs to the hour. That is
              the owner's behaviour and it is NOT changed here -- neither the group that opens
              nor the order of any group moved. What was missing is that the reader had no way
              to tell, from the top of the screen, that «أذكار المساء» is a group INSIDE الأذكار
              rather than the whole of what he pressed.
              So the section's name stands over the group's, in the smaller, dimmer weight the
              rest of this shell uses for a label above a title. The name is read from
              module.adhkar -- the very key the shelf tile draws -- so the tile and the chest
              cannot come to disagree, and no second Arabic string was authored for it. */}
          <span className="ezia-brand">
            <span className="ezia-brand-arch" aria-hidden="true" />
            <span style={s.eziaReadStack}>
              <span style={s.eziaReadSection}>{ezT('module.adhkar')}</span>
              <span style={s.eziaReadTitle}>{v.cat.title}</span>
            </span>
          </span>`,
  'brand');

// -- 2. THE TWO STYLE KEYS, beside the one they wrap -------------------------
one(
  "  eziaReadHead: { display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 6 },\n",
  "  // DEFECT 12 (item 88): the section's name over the group's, in one column inside the brand.\n"
  + "  // .ezia-brand is an inline-flex ROW that centres its children, so a column child stacks the\n"
  + "  // two lines without any rule in the sheet moving. minWidth 0 is what lets the title below\n"
  + "  // keep its ellipsis inside a flex parent.\n"
  + "  eziaReadStack: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, lineHeight: 1.15 },\n"
  + "  eziaReadSection: { fontSize: 11, fontWeight: 700, color: 'var(--a3-muted)', whiteSpace: 'nowrap' },\n"
  + "  eziaReadHead: { display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 6 },\n",
  'styles');

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'chars', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
