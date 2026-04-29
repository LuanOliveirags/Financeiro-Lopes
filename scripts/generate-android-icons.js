// scripts/generate-android-icons.js
// Gera ícones Android profissionais: fundo sólido navy + logo centralizado com alpha
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// icon-512.png: logo com canal alpha, sem fundo, 512×512
const LOGO_SRC   = path.join(root, 'frontend/assets/images/icon-512.png');
const MIPMAP_DIR = path.join(root, 'android/app/src/main/res');

// Cor de fundo que combina com o tema do app
const BG = { r: 22, g: 33, b: 52, alpha: 1 }; // #162134

const DENSITIES = [
  { folder: 'mipmap-mdpi',    launcher: 48,  foreground: 108 },
  { folder: 'mipmap-hdpi',    launcher: 72,  foreground: 162 },
  { folder: 'mipmap-xhdpi',   launcher: 96,  foreground: 216 },
  { folder: 'mipmap-xxhdpi',  launcher: 144, foreground: 324 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function resizeLogo(size, bg = TRANSPARENT) {
  return sharp(LOGO_SRC)
    .resize(size, size, { fit: 'contain', background: bg })
    .png()
    .toBuffer();
}

// Ícone legado: fundo navy sólido + logo a 84% do canvas
async function makeLegacy(dest, canvasSize) {
  const logoSize = Math.round(canvasSize * 0.84);
  const pad = Math.round((canvasSize - logoSize) / 2);

  const logo = await resizeLogo(logoSize);
  await sharp({ create: { width: canvasSize, height: canvasSize, channels: 4, background: BG } })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(dest);
  console.log(`  ✓ ${path.relative(root, dest)} (${canvasSize}px)`);
}

// Foreground adaptativo: logo a 62% do canvas em fundo transparente
// O Android garante visibilidade apenas do centro 66.67% → logo cabe dentro do safe zone
async function makeForeground(dest, canvasSize) {
  const logoSize = Math.round(canvasSize * 0.62);
  const pad = Math.round((canvasSize - logoSize) / 2);

  const logo = await resizeLogo(logoSize);
  await sharp({ create: { width: canvasSize, height: canvasSize, channels: 4, background: TRANSPARENT } })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(dest);
  console.log(`  ✓ ${path.relative(root, dest)} (${canvasSize}px foreground)`);
}

async function main() {
  if (!existsSync(LOGO_SRC)) {
    console.error('❌ Logo não encontrado:', LOGO_SRC);
    process.exit(1);
  }

  const meta = await sharp(LOGO_SRC).metadata();
  if (!meta.hasAlpha) {
    console.warn('⚠️  Logo sem canal alpha — resultado pode ter bordas visíveis');
  }
  console.log(`🎨 Fonte: icon-512.png (${meta.width}×${meta.height}, alpha: ${meta.hasAlpha})\n`);

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
