// Monta www/ para Capacitor e GitHub Pages deploy
// Estrutura de saída:
//   www/                   ← index.html, manifest.json, service-worker.js, assets/
//   www/apps/web/src/      ← features, app, styles
//   www/packages/          ← core, services, ui, utils

import { cpSync, rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DEST = join(ROOT, 'www');

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

// Flatten public/ para raiz de www/ (index.html, manifest, sw, assets)
cpSync(join(ROOT, 'apps/web/public'), DEST, { recursive: true });

// Preserva apps/web/src/ com mesmo path relativo dentro de www/
cpSync(join(ROOT, 'apps/web/src'), join(DEST, 'apps/web/src'), { recursive: true });

// Preserva packages/ com mesmo path relativo dentro de www/
cpSync(join(ROOT, 'packages'), join(DEST, 'packages'), { recursive: true });

console.log('✅ Web assets copiados para www/');
