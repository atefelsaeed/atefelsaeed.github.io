// Keeps the site light: no raw or oversized images can slip into public/ by accident.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { ROOT } from '../scripts/build.mjs';

const PUBLIC = join(ROOT, 'public');
const MAX_FILE_KB = 300; // largest single image
const MAX_WIDTH_PX = 1200; // wider than any place an image is shown, even at 2x
const MAX_TOTAL_KB = 3072; // all images together

async function images(dir = PUBLIC) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await images(full)));
    else if (['.png', '.jpg', '.jpeg'].includes(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

// Image width without a library: PNG header, or the first JPEG start-of-frame marker.
function width(buffer) {
  if (buffer.readUInt32BE(0) === 0x89504e47) return buffer.readUInt32BE(16);
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xff) { i++; continue; }
    const marker = buffer[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return buffer.readUInt16BE(i + 7);
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  throw new Error('no JPEG frame header');
}

test(`every image is at most ${MAX_FILE_KB} KB and ${MAX_WIDTH_PX}px wide`, async () => {
  const files = await images();
  assert.ok(files.length > 20, 'found the images');
  for (const file of files) {
    const name = relative(PUBLIC, file);
    const kb = (await stat(file)).size / 1024;
    assert.ok(kb <= MAX_FILE_KB, `${name} is ${Math.round(kb)} KB; run python3 scripts/optimize-image.py on the original`);
    const px = width(await readFile(file));
    assert.ok(px <= MAX_WIDTH_PX, `${name} is ${px}px wide; it looks like an unprocessed original`);
  }
});

test(`all images together stay under ${MAX_TOTAL_KB / 1024} MB`, async () => {
  let total = 0;
  for (const file of await images()) total += (await stat(file)).size;
  assert.ok(total / 1024 <= MAX_TOTAL_KB, `images total ${Math.round(total / 1024)} KB`);
});
