#!/usr/bin/env node
// Local dev server: builds the site, serves dist/ and rebuilds when src/ or public/ change.
//
//   npm run dev            (PORT=3000 npm run dev to change the port)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { build, ROOT } from './build.mjs';

const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

async function rebuild() {
  const t0 = performance.now();
  try {
    await build({ outDir: DIST });
    console.log(`Rebuilt in ${Math.round(performance.now() - t0)} ms`);
  } catch (err) {
    console.error(`Build failed: ${err.message}`);
  }
}

await rebuild();

let timer;
for (const dir of ['src', 'public']) {
  watch(join(ROOT, dir), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 120);
  });
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(DIST, path.endsWith('/') ? `${path}index.html` : path));
  const send = async (target, status) => {
    const body = await readFile(target);
    res.writeHead(status, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  };
  try {
    if (file !== DIST && !file.startsWith(DIST + sep)) throw new Error('outside dist');
    if ((await stat(file)).isDirectory()) {
      // GitHub Pages sends /projects to /projects/
      res.writeHead(301, { location: `${path}/` });
      res.end();
      return;
    }
    await send(file, 200);
  } catch {
    await send(join(DIST, '404.html'), 404).catch(() => {
      res.writeHead(404);
      res.end('Not found');
    });
  }
}).listen(PORT, () => console.log(`Serving dist/ at http://localhost:${PORT}  (watching src/ and public/)`));
