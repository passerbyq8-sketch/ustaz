// THE ONE SOURCE OF THE 110 IDENTITY TOKENS. The CSS blocks, the DESIGN-SYSTEM tables and the
// contrast report are all generated from this file, so they cannot disagree.
// Light values: measured from the boards' sources (design-ref/boards/*.html). Dark values:
// DERIVED (the boards drew no dark) and accepted only when the contrast script passes.
// Token names are the app's existing --vt-* set (index.html S100), plus --ez110-* extras that
// only the 110 stylesheet reads.
'use strict';
const ID = {
  b: {
    nameKey: 'ez110.id.b', fonts: { ui: "'IBM Plex Sans Arabic'", head: "'IBM Plex Sans Arabic'" },
    light: {
      page: '#FFFFFF', surface: '#FFFFFF', surface2: '#F5F9FE', soft: '#EAF3FD', ink: '#000000', muted: '#5B6576',
      accent: '#1D4ED8', deep: '#12327A', accent2: '#2AA6DE', accentInk: '#1D4ED8', accent2Ink: '#0B6A93',
      onAccent: '#FFFFFF', onAccent2: '#04202F', marker: '#2AA6DE', line: '#E7EDF5', hair: '#EEF2F8', faint: '#858FA0',
      focus: '#1D4ED8', iconA: '#F4F9FF', iconB: '#DCEBFC', field: '#F5F9FE',
      shadow: '0 1px 2px rgba(18,50,122,.06), 0 6px 18px rgba(18,50,122,.06)',
      shadowBar: '0 10px 30px rgba(18,50,122,.10), 0 1px 2px rgba(18,50,122,.06)',
      gradSend: 'linear-gradient(135deg,#2A66DE 0%,#1D4ED8 100%)',
      gradPrayer: 'linear-gradient(135deg,#2A66DE 0%,#1D4ED8 52%,#173C9E 100%)',
      navBg: 'rgba(255,255,255,.94)', headBg: 'rgba(255,255,255,.88)',
    },
    dark: {
      page: '#0B1220', surface: '#111A2B', surface2: '#16223A', soft: '#1A2A48', ink: '#EEF2F8', muted: '#A7B1C2',
      accent: '#7AA2FF', deep: '#C9D8FF', accent2: '#4CC3F0', accentInk: '#9DBBFF', accent2Ink: '#7FD4F5',
      onAccent: '#071330', onAccent2: '#04202F', marker: '#4CC3F0', line: '#24324D', hair: '#1C2840', faint: '#7C879B',
      focus: '#9DBBFF', iconA: '#1A2A48', iconB: '#14213A', field: '#16223A',
      shadow: '0 1px 2px rgba(0,0,0,.40), 0 6px 18px rgba(0,0,0,.35)',
      shadowBar: '0 10px 30px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.40)',
      gradSend: 'linear-gradient(135deg,#8DB0FF 0%,#7AA2FF 100%)',
      gradPrayer: 'linear-gradient(135deg,#2A4E9E 0%,#1F3E86 52%,#16306A 100%)',
      navBg: 'rgba(11,18,32,.94)', headBg: 'rgba(11,18,32,.88)',
    },
  },
  c: {
    nameKey: 'ez110.id.c', fonts: { ui: "'IBM Plex Sans Arabic'", head: "'El Messiri'" },
    light: {
      page: '#FFFFFF', surface: '#FFFFFF', surface2: '#F0F6FD', soft: '#E8F1FC', ink: '#000000', muted: '#55627A',
      accent: '#2563C9', deep: '#1E4FA8', accent2: '#7FBDF3', accentInk: '#1E4FA8', accent2Ink: '#1F5E96',
      onAccent: '#FFFFFF', onAccent2: '#0B2447', marker: '#7FBDF3', line: '#DCE8F8', hair: '#EAF1FB', faint: '#8491A8',
      focus: '#2563C9', iconA: '#FFFFFF', iconB: '#DCE8F8', field: '#F7FAFE',
      shadow: '0 2px 6px rgba(37,99,201,.12), 0 10px 24px rgba(37,99,201,.12)',
      shadowBar: '0 12px 30px rgba(37,99,201,.14), 0 1px 2px rgba(37,99,201,.10)',
      gradSend: 'radial-gradient(circle at 30% 25%,#7FBDF3 0%,#2563C9 55%,#1E4FA8 100%)',
      gradPrayer: 'radial-gradient(circle at 30% 20%,#7FBDF3 0%,#2563C9 50%,#1E4FA8 100%)',
      pearl: 'radial-gradient(circle at 35% 30%,#FFFFFF 0%,#F0F6FD 55%,#DCE8F8 100%)',
      shell: 'linear-gradient(135deg,#CFE3F8 0%,#E4DDF7 50%,#CDEBF5 100%)',
      navBg: 'rgba(255,255,255,.96)', headBg: 'rgba(255,255,255,.92)',
    },
    dark: {
      page: '#0C1322', surface: '#121C30', surface2: '#18253E', soft: '#1C2C4A', ink: '#EEF3FA', muted: '#A9B4C8',
      accent: '#82AEF5', deep: '#C6D9FA', accent2: '#7FBDF3', accentInk: '#A3C4F7', accent2Ink: '#9CCDF6',
      onAccent: '#08162E', onAccent2: '#08162E', marker: '#7FBDF3', line: '#26364F', hair: '#1D2A42', faint: '#7F8BA0',
      focus: '#A3C4F7', iconA: '#22324F', iconB: '#18253E', field: '#18253E',
      shadow: '0 2px 6px rgba(0,0,0,.40), 0 10px 24px rgba(0,0,0,.35)',
      shadowBar: '0 12px 30px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.40)',
      gradSend: 'radial-gradient(circle at 30% 25%,#B5D6F8 0%,#82AEF5 60%,#6C98E6 100%)',
      gradPrayer: 'radial-gradient(circle at 30% 20%,#2F5596 0%,#22427C 55%,#18325F 100%)',
      pearl: 'radial-gradient(circle at 35% 30%,#2A3B5C 0%,#1E2D49 60%,#18253E 100%)',
      shell: 'linear-gradient(135deg,#2B3F63 0%,#352F55 50%,#244757 100%)',
      navBg: 'rgba(12,19,34,.96)', headBg: 'rgba(12,19,34,.92)',
    },
  },
  d: {
    nameKey: 'ez110.id.d', fonts: { ui: "'IBM Plex Sans Arabic'", head: "'Amiri'" },
    light: {
      page: '#FFFFFF', surface: '#FFFFFF', surface2: '#F4F8FD', soft: '#F7FAFE', ink: '#000000', muted: '#53627A',
      accent: '#1E4FA8', deep: '#12327A', accent2: '#8DB8E6', accentInk: '#1E4FA8', accent2Ink: '#2E5F96',
      onAccent: '#FFFFFF', onAccent2: '#0B2447', marker: '#8DB8E6', line: '#D6E4F4', hair: '#EEF4FB', faint: '#8491A8',
      focus: '#1E4FA8', iconA: '#F7FAFE', iconB: '#EEF4FB', field: '#F7FAFE', frame: '#CFE0F3',
      shadow: '0 1px 2px rgba(18,50,122,.05), 0 4px 12px rgba(18,50,122,.05)',
      shadowBar: '0 8px 22px rgba(18,50,122,.08), 0 1px 2px rgba(18,50,122,.06)',
      double: 'inset 0 0 0 3px #FFFFFF, inset 0 0 0 4px #EEF4FB',
      gradSend: 'linear-gradient(180deg,#2A5DB8 0%,#1E4FA8 100%)',
      gradPrayer: 'linear-gradient(180deg,#1E4FA8 0%,#12327A 100%)',
      navBg: '#FFFFFF', headBg: '#FFFFFF',
    },
    dark: {
      page: '#0B1220', surface: '#101A2C', surface2: '#15223A', soft: '#182640', ink: '#EEF2F8', muted: '#A7B1C2',
      accent: '#8FB2F2', deep: '#C9D8FF', accent2: '#8DB8E6', accentInk: '#A7C3F5', accent2Ink: '#A9CAEE',
      onAccent: '#071330', onAccent2: '#071330', marker: '#8DB8E6', line: '#263753', hair: '#1C2A43', faint: '#7C879B',
      focus: '#A7C3F5', iconA: '#182640', iconB: '#15223A', field: '#15223A', frame: '#2C4060',
      shadow: '0 1px 2px rgba(0,0,0,.40), 0 4px 12px rgba(0,0,0,.30)',
      shadowBar: '0 8px 22px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.40)',
      double: 'inset 0 0 0 3px #101A2C, inset 0 0 0 4px #263753',
      gradSend: 'linear-gradient(180deg,#9DBDF5 0%,#8FB2F2 100%)',
      gradPrayer: 'linear-gradient(180deg,#22427C 0%,#172E5A 100%)',
      navBg: '#101A2C', headBg: '#101A2C',
    },
  },
  e: {
    nameKey: 'ez110.id.e', fonts: { ui: "'Readex Pro'", head: "'Readex Pro'" },
    light: {
      page: '#FFFFFF', surface: '#FFFFFF', surface2: '#F3F8FE', soft: '#E6F3FC', ink: '#000000', muted: '#56637A',
      accent: '#1D4ED8', deep: '#12327A', accent2: '#2AA6DE', accentInk: '#1D4ED8', accent2Ink: '#0B6A93',
      onAccent: '#FFFFFF', onAccent2: '#04202F', marker: '#2AA6DE', line: '#E2ECF7', hair: '#EDF3FA', faint: '#8590A3',
      focus: '#1D4ED8', iconA: '#FFFFFF', iconB: '#E6F3FC', field: '#F7FAFE',
      glass: 'rgba(255,255,255,.62)', glassEdge: 'rgba(255,255,255,.95)', glassSolid: '#F7FAFE',
      shadow: '0 2px 8px rgba(29,78,216,.08), 0 12px 28px rgba(29,78,216,.08)',
      shadowBar: '0 12px 32px rgba(29,78,216,.14), 0 1px 2px rgba(29,78,216,.08)',
      gradSend: 'linear-gradient(135deg,#2AA6DE 0%,#1D4ED8 72%)',
      gradPrayer: 'linear-gradient(135deg,#2AA6DE 0%,#1D4ED8 72%)',
      halo1: 'rgba(42,166,222,.18)', halo2: 'rgba(29,78,216,.14)',
      navBg: 'rgba(255,255,255,.62)', headBg: 'rgba(255,255,255,.62)',
    },
    dark: {
      page: '#0A1120', surface: '#101A2D', surface2: '#15233B', soft: '#152B45', ink: '#EEF3FA', muted: '#A8B3C6',
      accent: '#7AA2FF', deep: '#C9D8FF', accent2: '#4CC3F0', accentInk: '#9DBBFF', accent2Ink: '#7FD4F5',
      onAccent: '#071330', onAccent2: '#04202F', marker: '#4CC3F0', line: '#24344F', hair: '#1B2942', faint: '#7C879B',
      focus: '#9DBBFF', iconA: '#1A2C48', iconB: '#15233B', field: '#15233B',
      glass: '#101A2D', glassEdge: '#24344F', glassSolid: '#101A2D',
      shadow: '0 2px 8px rgba(0,0,0,.40), 0 12px 28px rgba(0,0,0,.35)',
      shadowBar: '0 12px 32px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.40)',
      gradSend: 'linear-gradient(135deg,#7FD4F5 0%,#7AA2FF 72%)',
      gradPrayer: 'linear-gradient(135deg,#1C5A86 0%,#22427C 72%)',
      halo1: 'transparent', halo2: 'transparent',
      navBg: '#101A2D', headBg: '#101A2D',
    },
  },
};

// the role -> --vt-* mapping this file supplies (the app's own S100 role map does the rest)
const VT = { page: 'page', surface: 'surface', surface2: 'surface2', ink: 'ink', muted: 'muted', accent: 'accent',
  accent2: 'accent2', line: 'line', focus: 'focus', onAccent: 'on-accent', accentInk: 'accent-ink',
  accent2Ink: 'accent2-ink', onAccent2: 'on-accent2', marker: 'marker', deep: 'deep', soft: 'soft', shadow: 'shadow' };

// text/background pairs whose contrast the design depends on: [fg, bg, kind] kind: text|large|ui
const PAIRS = [
  ['ink', 'page', 'text'], ['ink', 'surface', 'text'], ['ink', 'surface2', 'text'], ['ink', 'soft', 'text'], ['ink', 'field', 'text'],
  ['muted', 'page', 'text'], ['muted', 'surface', 'text'], ['muted', 'surface2', 'text'],
  ['accentInk', 'page', 'text'], ['accentInk', 'surface', 'text'], ['accentInk', 'soft', 'text'], ['accentInk', 'surface2', 'text'],
  ['deep', 'soft', 'text'], ['onAccent', 'accent', 'text'], ['onAccent2', 'accent2', 'text'], ['accent2Ink', 'surface', 'text'],
  ['accent', 'page', 'ui'], ['accent', 'surface', 'ui'], ['faint', 'surface', 'ui'], ['focus', 'page', 'ui'], ['focus', 'surface', 'ui'],
];

module.exports = { ID, VT, PAIRS };
