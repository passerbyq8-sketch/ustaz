'use strict';
const assert = require('node:assert/strict');
const { parseHTML } = require('linkedom');

// The 21 October device order intentionally changes paragraph direction. Keep the
// measured production HTML fixtures intact: assert the approved new properties,
// then remove precisely those properties before comparing every other HTML byte.
function withoutParagraphDirection(html) {
  const { document } = parseHTML('<div>' + html + '</div>');
  const blocks = [...document.querySelectorAll('.ez-prose div, .ez-prose p, .ez-prose pre, .ez-prose blockquote, .ez-prose li, .ez-prose th, .ez-prose td')];
  assert.ok(blocks.length > 0, 'fixture must exercise prose paragraphs');
  for (const block of blocks) {
    assert.equal(block.getAttribute('dir'), 'auto', 'each prose block selects its own direction');
    assert.equal(block.style.unicodeBidi, 'plaintext', 'each prose block isolates its base direction');
    assert.ok(['start', 'left', 'right', 'center'].includes(block.style.textAlign), 'paragraph alignment is explicit');
  }
  let normalized = html;
  for (const block of blocks) {
    const tag = block.outerHTML.match(/^<[^>]+>/)[0];
    const originalDirection = tag.replace(' dir="auto"', '')
      .replace(/;?unicode-bidi:plaintext(?=;|")/, '')
      .replace(/;?text-align:start(?=;|")/, '')
      .replace(' style=""', '');
    assert.notEqual(originalDirection, tag, 'the approved direction properties must be present');
    assert.ok(normalized.includes(tag), 'the measured prose opening tag must be present verbatim');
    normalized = normalized.replace(tag, originalDirection);
  }
  return normalized;
}
module.exports = { withoutParagraphDirection };
