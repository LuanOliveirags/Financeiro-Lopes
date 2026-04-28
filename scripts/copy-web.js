// Copia os assets web para www/ antes do cap sync
// Exclui backend/, docs/, android/, node_modules/, scripts/, .git/

import { cpSync, rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'www');

const INCLUDE = ['index.html', 'manifest.json', 'service-worker.js', 'frontend'];

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

for (const item of INCLUDE) {
  cpSync(join(ROOT, item), join(DEST, item), { recursive: true });
}

console.log('✅ Web assets copiados para www/');
