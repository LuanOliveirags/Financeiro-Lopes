// scripts/generate-android-icons.js
// Gera ícones Android profissionais: fundo sólido navy + logo centralizado com alpha
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// icon-maskable-512.png: logo + fundo navy, composição igual ao PWA (ícones legados)
// icon-512.png: logo com alpha transparente (foreground do ícone adaptativo)
const MASKABLE_SRC = path.join(root, 'frontend/assets/images/icon-maskable-512.png');
const LOGO_SRC     = path.join(root, 'frontend/assets/images/icon-512.png');
const MIPMAP_DIR   = path.join(root, 'android/app/src/main/res');

const DENSITIES = [
  { folder: 'mipmap-mdpi',    launcher: 48,  foreground: 108 },
  { folder: 'mipmap-hdpi',    launcher: 72,  foreground: 162 },
  { folder: 'mipmap-xhdpi',   launcher: 96,  foreground: 216 },
  { folder: 'mipmap-xxhdpi',  launcher: 144, foreground: 324 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Ícone legado: usa o maskable diretamente — mesma composição do ícone PWA
async function makeLegacy(dest, canvasSize) {
  await sharp(MASKABLE_SRC)
    .resize(canvasSize, canvasSize, { fit: 'cover' })
    .png()
    .toFile(dest);
  console.log(`  ✓ ${path.relative(root, dest)} (${canvasSize}px)`);
}

// Foreground adaptativo: logo transparente a 62% do canvas (dentro do safe zone 66.67%)
// A camada de background (#162134 via XML) aparece nas bordas → visual idêntico ao maskable
async function makeForeground(dest, canvasSize) {
  const logoSize = Math.round(canvasSize * 0.62);
  const pad = Math.round((canvasSize - logoSize) / 2);

  const logo = await sharp(LOGO_SRC)
    .resize(logoSize, logoSize, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();

  await sharp({ create: { width: canvasSize, height: canvasSize, channels: 4, background: TRANSPARENT } })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(dest);
  console.log(`  ✓ ${path.relative(root, dest)} (${canvasSize}px foreground)`);
}

async function main() {
  if (!existsSync(MASKABLE_SRC) || !existsSync(LOGO_SRC)) {
    console.error('❌ Ícone fonte não encontrado');
    process.exit(1);
  }

  const meta = await sharp(MASKABLE_SRC).metadata();
  console.log(`🎨 Legado:     icon-maskable-512.png (${meta.width}×${meta.height})`);
  const meta2 = await sharp(LOGO_SRC).metadata();
  console.log(`🎨 Foreground: icon-512.png (${meta2.width}×${meta2.height}, alpha: ${meta2.hasAlpha})\n`);

  for (const { folder, launcher, foreground } of DENSITIES) {
    const dir = path.join(MIPMAP_DIR, folder);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });

    await makeLegacy(path.join(dir, 'ic_launcher.png'),       launcher);
    await makeLegacy(path.join(dir, 'ic_launcher_round.png'), launcher);
    await makeForeground(path.join(dir, 'ic_launcher_foreground.png'), foreground);
  }

  console.log('\n✅ Ícones gerados! Rebuild o APK no Android Studio para aplicar.');
}

main().catch(err => { console.error('❌', err); process.exit(1); });
