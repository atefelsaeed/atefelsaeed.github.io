// A small template engine, just enough for this site and nothing more.
//
//   {{path}}              HTML-escaped value (missing value = build error)
//   {{{path}}}            raw value, for strings that deliberately hold markup
//   {{@json path}}        value as JSON, safe inside <script>
//   {{svg icon}}          inline src/templates/icons/<value of icon>.svg
//   {{svg "moon"}}        same, with a fixed icon name
//   {{#if path}}..{{else}}..{{/if}}
//   {{#each path}}..{{/each}}     {{@index}}, {{@first}}, {{@last}}, {{this}}
//   {{#with path}}..{{/with}}
//   {{> folder/name}}     include src/templates/folder/name.html
//   {{> *path}}           same, with the partial name taken from data (e.g. the case-study template of a page)
//   {{! comment }}
//
// A name is looked up on the current item only (inside #each/#with that is the item, otherwise the page).
// Reach page-level data from inside a loop with @root, e.g. {{@root.blog.readLabel}} or {{#if @root.rtl}}.
// Nothing climbs implicitly, so an optional key that is missing on an item stays missing.

const TAG = /\{\{\{([\s\S]+?)\}\}\}|\{\{([\s\S]+?)\}\}/g;
const MAX_DEPTH = 40;

export class TemplateError extends Error {}

function parse(src, name) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  const target = () => {
    const n = stack[stack.length - 1];
    return n.inElse ? n.otherwise : n.children;
  };
  const where = (i) => `${name}:${src.slice(0, i).split('\n').length}`;
  let last = 0;
  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(src))) {
    if (m.index > last) target().push({ type: 'text', value: src.slice(last, m.index) });
    last = TAG.lastIndex;
    const raw = m[1] !== undefined;
    const body = (m[1] ?? m[2]).trim();
    const at = where(m.index);
    let t;
    if (body.startsWith('!')) continue;
    if ((t = /^#(if|each|with)\s+(\S+)$/.exec(body))) {
      const node = { type: t[1], path: t[2], children: [], otherwise: [], inElse: false, at };
      target().push(node);
      stack.push(node);
    } else if (body === 'else') {
      const n = stack[stack.length - 1];
      if (n.type !== 'if' && n.type !== 'each') throw new TemplateError(`{{else}} outside if/each at ${at}`);
      n.inElse = true;
    } else if ((t = /^\/(if|each|with)$/.exec(body))) {
      const n = stack.pop();
      if (!n || n.type !== t[1]) throw new TemplateError(`Unexpected {{/${t[1]}}} at ${at}`);
    } else if ((t = /^>\s*(\*?)(\S+)$/.exec(body))) {
      target().push({ type: 'partial', name: t[2], dynamic: t[1] === '*', at });
    } else if ((t = /^@json\s+(\S+)$/.exec(body))) {
      target().push({ type: 'json', path: t[1], at });
    } else if ((t = /^svg\s+(\S+)$/.exec(body))) {
      target().push({ type: 'svg', path: t[1], at });
    } else if (/^[@\w.]+$/.test(body)) {
      target().push({ type: 'var', path: body, raw, at });
    } else {
      throw new TemplateError(`Cannot parse {{${body}}} at ${at}`);
    }
  }
  if (last < src.length) target().push({ type: 'text', value: src.slice(last) });
  if (stack.length > 1) throw new TemplateError(`Unclosed {{#${stack[stack.length - 1].type}}} at ${stack[stack.length - 1].at}`);
  return root.children;
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const isObject = (v) => v !== null && typeof v === 'object';

export function createEngine({ partials, icons }) {
  const parsed = new Map();
  const ast = (name, src) => {
    if (!parsed.has(name)) parsed.set(name, parse(src, name));
    return parsed.get(name);
  };

  // scopes: [{ value, index?, length? }, ...]; scopes[0] is the page root.
  function resolve(scopes, path, at, { strict }) {
    if (path === '@index' || path === '@first' || path === '@last') {
      for (let i = scopes.length - 1; i >= 0; i--) {
        const s = scopes[i];
        if (s.index === undefined) continue;
        return path === '@index' ? s.index : path === '@first' ? s.index === 0 : s.index === s.length - 1;
      }
      throw new TemplateError(`${path} used outside {{#each}} at ${at}`);
    }
    const parts = path.split('.');
    let cur;
    let from = 0;
    if (parts[0] === 'this') {
      cur = scopes[scopes.length - 1].value;
      from = 1;
    } else if (parts[0] === '@root') {
      cur = scopes[0].value;
      from = 1;
    } else {
      const frame = scopes[scopes.length - 1].value;
      if (!isObject(frame) || !Object.hasOwn(frame, parts[0])) {
        if (strict) throw new TemplateError(`Missing "${path}" at ${at}`);
        return undefined;
      }
      cur = frame[parts[0]];
      from = 1;
    }
    for (let i = from; i < parts.length; i++) {
      if (!isObject(cur) || !(parts[i] in cur)) {
        if (strict) throw new TemplateError(`Missing "${path}" at ${at}`);
        return undefined;
      }
      cur = cur[parts[i]];
    }
    return cur;
  }

  const truthy = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

  function render(nodes, scopes, depth) {
    if (depth > MAX_DEPTH) throw new TemplateError('Templates nest too deeply (recursive partial without an end?)');
    let out = '';
    for (const n of nodes) {
      switch (n.type) {
        case 'text':
          out += n.value;
          break;
        case 'var': {
          const v = resolve(scopes, n.path, n.at, { strict: true });
          if (v === null) break;
          if (isObject(v)) throw new TemplateError(`"${n.path}" is an object/array, not text, at ${n.at}`);
          out += n.raw ? String(v) : escapeHtml(String(v));
          break;
        }
        case 'json': {
          const v = resolve(scopes, n.path, n.at, { strict: true });
          out += JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
          break;
        }
        case 'svg': {
          const literal = /^"([\w-]+)"$/.exec(n.path);
          const name = literal ? literal[1] : resolve(scopes, n.path, n.at, { strict: true });
          if (!icons[name]) throw new TemplateError(`No icon "${name}" at ${n.at}`);
          out += icons[name];
          break;
        }
        case 'if':
          out += render(truthy(resolve(scopes, n.path, n.at, { strict: false })) ? n.children : n.otherwise, scopes, depth + 1);
          break;
        case 'with': {
          const v = resolve(scopes, n.path, n.at, { strict: true });
          out += render(n.children, [...scopes, { value: v }], depth + 1);
          break;
        }
        case 'each': {
          const list = resolve(scopes, n.path, n.at, { strict: true });
          if (!Array.isArray(list)) throw new TemplateError(`"${n.path}" is not a list at ${n.at}`);
          if (!list.length) out += render(n.otherwise, scopes, depth + 1);
          list.forEach((item, index) => {
            out += render(n.children, [...scopes, { value: item, index, length: list.length }], depth + 1);
          });
          break;
        }
        case 'partial': {
          const name = n.dynamic ? resolve(scopes, n.name, n.at, { strict: true }) : n.name;
          if (!(name in partials)) throw new TemplateError(`No partial "${name}" at ${n.at}`);
          out += render(ast(name, partials[name]), scopes, depth + 1);
          break;
        }
      }
    }
    return out;
  }

  return {
    renderString(src, data, name = 'template') {
      return render(ast(name, src), [{ value: data }], 0);
    },
  };
}

// Merge language-neutral data (shared.json) with one language file. Objects merge by key; lists merge by
// position (null in the language file keeps the shared entry). Entries that carry an `id` must line up.
export function merge(a, b, path = '') {
  if (b === undefined || b === null) return a;
  if (Array.isArray(a) && Array.isArray(b)) {
    return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => {
      const x = a[i];
      const y = b[i];
      if (isObject(x) && isObject(y) && 'id' in x && 'id' in y && x.id !== y.id) {
        throw new Error(`${path}[${i}]: "${x.id}" in shared.json does not line up with "${y.id}" in the language file`);
      }
      return merge(x, y, `${path}[${i}]`);
    });
  }
  if (isObject(a) && isObject(b) && !Array.isArray(a) && !Array.isArray(b)) {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = merge(a[k], b[k], path ? `${path}.${k}` : k);
    return out;
  }
  return b;
}
