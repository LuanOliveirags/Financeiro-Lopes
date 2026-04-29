// scripts/generate-android-icons.js
// Gera todos os ícones Android (mipmap-*) a partir do ícone PWA maskable
import sharp from 'sharp';
import { copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root      = path.resolve(__dirname, '..');

// Fonte: ícone maskable 512px (maior = melhor qualidade)
const SOURCE_MASKABLE = path.join(root, 'frontend/assets/images/icon-maskable-512.png');
const SOURCE_ANY      = path.join(root, 'frontend/assets/images/icon-any-512.png');
const MIPMAP_BASE     = path.join(root, 'android/app/src/main/res');

const DENSITIES = [
  { folder: 'mipmap-mdpi',    launcher: 48,  foreground: 108 },
  { folder: 'mipmap-hdpi',    launcher: 72,  foreground: 162 },
  { folder: 'mipmap-xhdpi',   launcher: 96,  foreground: 216 },
  { folder: 'mipmap-xxhdpi',  launcher: 144, foreground: 324 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

async function resize(src, dest, size) {
  await sharp(src)
    .resize(size, size, { fit: 'fill' })
    .png()
    .toFile(dest);
  console.log(`  ✓ ${path.relative(root, dest)} (${size}×${size})`);
}

async function main() {
  const src = existsSync(SOURCE_MASKABLE) ? SOURCE_MASKABLE : SOURCE_ANY;
  if (!existsSync(src)) {
    console.error('❌ Ícone fonte não encontrado:', src);
    process.exit(1);
  }
  console.log('🎨 Fonte:', path.relative(root, src));
  console.log('');

  for (const { folder, launcher, foreground } of DENSITIES) {
    const dir = path.join(MIPMAP_BASE, folder);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });

    await resize(src, path.join(dir, 'ic_launcher.png'),            launcher);
    await resize(src, path.join(dir, 'ic_launcher_round.png'),      launcher);
    await resize(src, path.join(dir, 'ic_launcher_foreground.png'), foreground);
  }

  console.log('\n✅ Ícones Android gerados com sucesso!');
  console.log('   Rebuild o APK no Android Studio para aplicar as mudanças.');
}

main().catch(err => { console.error('❌', err); process.exit(1); });
