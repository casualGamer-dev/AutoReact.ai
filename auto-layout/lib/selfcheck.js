// ponytail: smallest runnable check, not a test suite. Run with `node lib/selfcheck.js`.
const assert = require('assert');
const { sortIntoRows } = require('./layoutSort');
const { generateCode } = require('./codeGen');

const predictions = [
  { object: 'Button', x0: 120, y0: 10, x1: 220, y1: 50, width: 100, height: 40 },
  { object: 'Text', x0: 10, y0: 10, x1: 100, y1: 50, width: 90, height: 40 },
  { object: 'Image', x0: 10, y0: 80, x1: 110, y1: 180, width: 100, height: 100 },
];

const rows = sortIntoRows(predictions);
assert.strictEqual(rows.length, 2, 'expected two rows (y0=10 pair + y0=80 image)');
assert.strictEqual(rows[0].length, 2, 'first row should hold Text+Button');
assert.strictEqual(rows[0][0].object, 'Text', 'Text (x0=10) should sort before Button (x0=120)');
assert.strictEqual(rows[0][1].object, 'Button');
assert.strictEqual(rows[1][0].object, 'Image');

const code = generateCode(rows, { name: 'my_test_sketch' });
assert.ok(code.includes('<Text style={styles.label}>Text</Text>'), 'missing Text element');
assert.ok(code.includes('TouchableOpacity'), 'missing Button element');
assert.ok(code.includes('Image'), 'missing Image element');
assert.ok(!code.includes("require('yourImage.png')"), 'Image source should be a runnable placeholder, not a nonexistent require()');
assert.ok(code.startsWith("import React from 'react';"), 'missing imports header');
assert.ok(code.includes('export default function MyTestSketch()'), 'component name should derive from the sketch name');
assert.ok(code.trim().endsWith('});'), 'missing trailing styles block');
assert.ok(code.includes('\n'), 'generated code should be multi-line, not crammed onto one line');

const unnamed = generateCode(rows);
assert.ok(unnamed.includes('export default function GeneratedLayout()'), 'missing name should fall back to GeneratedLayout');

console.log('layoutSort + codeGen selfcheck: OK');
