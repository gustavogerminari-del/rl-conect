import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
const output = resolve(root, 'app/api/master/developer-assistant/sourceCatalog.generated.ts');
const allowedRoots = ['app', 'src', 'scripts', 'firebase', 'tests'];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.css', '.rules', '.md', '.sh']);
const excluded = new Set(['node_modules', 'dist', '.git', '.sites-runtime', '.wrangler', 'generated']);
const maxFileBytes = 180_000;
const maxCatalogBytes = 4_500_000;

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.startsWith('.env')) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, files);
    else if (allowedExtensions.has(extname(entry.name)) || entry.name.endsWith('.rules')) files.push(absolute);
  }
  return files;
}

const files = [];
for (const directory of allowedRoots) await walk(resolve(root, directory), files);
for (const name of ['package.json', 'tsconfig.json', 'vite.config.ts', 'README.md']) {
  files.push(resolve(root, name));
}

let total = 0;
const catalog = [];
for (const absolute of [...new Set(files)].sort()) {
  const content = await readFile(absolute, 'utf8');
  const size = Buffer.byteLength(content);
  if (size > maxFileBytes || total + size > maxCatalogBytes) continue;
  total += size;
  catalog.push({ path: relative(root, absolute).split(sep).join('/'), content });
}

await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, `// Gerado por scripts/generate-source-catalog.mjs. Não editar manualmente.\nexport const SOURCE_CATALOG = ${JSON.stringify(catalog)} as const;\n`);
console.log(`[source-catalog] ${catalog.length} arquivos, ${total} bytes, segredos excluídos.`);
