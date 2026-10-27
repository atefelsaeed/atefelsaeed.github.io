// WCAG AA (4.5:1) for the text and button colors defined in src/css/tokens.css, in both themes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../scripts/build.mjs';

const tokens = await readFile(join(ROOT, 'src/css/tokens.css'), 'utf8');
const read = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2].toUpperCase()]));

const light = read(tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('@media')));
const darkMedia = read(tokens.slice(tokens.indexOf('@media'), tokens.indexOf(':root[data-theme="dark"]')));
const darkAttr = read(tokens.slice(tokens.indexOf(':root[data-theme="dark"]')));
const dark = { ...light, ...darkAttr };

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const PAIRS = [
  ['fg', 'bg'], ['fg', 'surface'], ['muted', 'bg'], ['muted', 'surface'],
  ['accent', 'bg'], ['accent', 'surface'], ['accent', 'accent-soft'],
  ['ok', 'bg'], ['ok', 'surface'],
  ['on-accent', 'accent'], ['on-wa', 'wa'],
];

for (const [name, theme] of [['light', light], ['dark', dark]]) {
  test(`${name} theme: text and button colors reach AA contrast`, () => {
    for (const [fg, bg] of PAIRS) {
      assert.ok(theme[fg] && theme[bg], `--${fg} or --${bg} is not defined as a hex color`);
      const r = ratio(theme[fg], theme[bg]);
      assert.ok(r >= 4.5, `--${fg} (${theme[fg]}) on --${bg} (${theme[bg]}) is ${r.toFixed(2)}:1, needs 4.5:1`);
    }
  });
}

test('the two dark theme blocks (system preference and manual toggle) define the same colors', () => {
  assert.deepEqual(darkMedia, darkAttr);
});
