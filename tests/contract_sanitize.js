const assert = require('assert');
const Resanitize = require('../src/resanitize');

const input = '<div id="x" onclick="evil()"><script>bad()</script><label>l</label><b>ok</b></div>';
const html = Resanitize.sanitizeNoteBody(input);
assert.ok(!/id=/.test(html), html);
assert.ok(!/onclick/.test(html), html);
assert.ok(!/<script/.test(html), html);
assert.ok(/<label>/.test(html), html);
assert.ok(/<b>ok<\/b>/.test(html), html);

const leanote = Resanitize.sanitizeNoteBody(input, ['label']);
assert.ok(/<label>/.test(leanote), leanote);
assert.ok(/<b>ok<\/b>/.test(leanote), leanote);

console.log('sanitize OK');
