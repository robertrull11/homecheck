// Build: bundles React app with esbuild, compiles Tailwind v4, copies public assets.
// Usage: node scripts/build.mjs [--single]   (--single also writes dist-single/index.html with everything inlined)
import { build } from 'esbuild';
import { compile } from 'tailwindcss';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const twDir = path.join(root, 'node_modules', 'tailwindcss');
const version = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(jsx?|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

async function buildCss() {
  const input = await fs.readFile(path.join(src, 'styles.css'), 'utf8');
  const compiler = await compile(input, {
    base: src,
    loadStylesheet: async (id, base) => {
      let file;
      if (id === 'tailwindcss') file = path.join(twDir, 'index.css');
      else if (id.startsWith('tailwindcss/')) file = path.join(twDir, id.slice('tailwindcss/'.length));
      else file = path.resolve(base, id);
      return { path: file, base: path.dirname(file), content: await fs.readFile(file, 'utf8') };
    },
  });
  const candidates = new Set();
  for (const f of await walk(src)) {
    const text = await fs.readFile(f, 'utf8');
    for (const m of text.matchAll(/[^\s"'`{}<>()\\,;]+/g)) candidates.add(m[0]);
    // clases con valores arbitrarios que llevan paréntesis o comas: bg-[var(--accent)], shadow-[0_1px_2px_rgba(0,0,0,.1)]
    for (const m of text.matchAll(/[^\s"'`{}<>\\;]+/g)) candidates.add(m[0]);
  }
  return compiler.build([...candidates]);
}

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

const result = await build({
  entryPoints: [path.join(src, 'main.jsx')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  write: false,
  define: { 'process.env.NODE_ENV': '"production"', __APP_VERSION__: JSON.stringify(version) },
  nodePaths: [path.join(root, 'node_modules')],
  logLevel: 'warning',
});
const js = result.outputFiles[0].text;
const css = await buildCss();

await fs.writeFile(path.join(dist, 'app.js'), js);
await fs.writeFile(path.join(dist, 'app.css'), css);
await fs.cp(path.join(root, 'public'), dist, { recursive: true });

const html = (await fs.readFile(path.join(src, 'index.html'), 'utf8')).replaceAll('__VERSION__', version);
await fs.writeFile(
  path.join(dist, 'index.html'),
  html
    .replace('<!--CSS-->', `<link rel="stylesheet" href="./app.css?v=${version}">`)
    .replace('<!--JS-->', `<script type="module" src="./app.js?v=${version}"></script>`)
);
const sw = await fs.readFile(path.join(dist, 'sw.js'), 'utf8');
await fs.writeFile(path.join(dist, 'sw.js'), sw.replaceAll('__VERSION__', version));

if (process.argv.includes('--single')) {
  const single = path.join(root, 'dist-single');
  await fs.rm(single, { recursive: true, force: true });
  await fs.mkdir(single, { recursive: true });
  const iconUri = 'data:image/png;base64,' + (await fs.readFile(path.join(root, 'public', 'icons', 'icon-192.png'))).toString('base64');
  const safeJs = js.replaceAll('</script', '<\\/script').replaceAll('./icons/icon-192.png', iconUri);
  await fs.writeFile(
    path.join(single, 'index.html'),
    html
      .replace(/<link rel="manifest"[^>]*>/, '')
      .replace(/<link rel="apple-touch-icon"[^>]*>/, '')
      .replace('href="./icons/icon-192.png" data-icon', `href="${iconUri}"`)
      .replace('<!--CSS-->', `<style>${css}</style>`)
      .replace('<!--JS-->', `<script>window.__PREVIEW__=true;</script><script type="module">${safeJs}</script>`)
  );
}
console.log(`OK build ${version}: js ${(js.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB`);
