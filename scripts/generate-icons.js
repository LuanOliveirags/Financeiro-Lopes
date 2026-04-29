// Gera ícones Android idênticos ao PWA:
// fundo branco + logo centralizado com padding para safe zone (70% do canvas)
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC   = join(ROOT, 'frontend/assets/images/icon-any-512.png'); // maior resolução como fonte
const RES   = join(ROOT, 'android/app/src/main/res');

const DENSITIES = [
  { folder: 'mipmap-mdpi',    size: 48  },
  { folder: 'mipmap-hdpi',    size: 72  },
  { folder: 'mipmap-xhdpi',   size: 96  },
  { folder: 'mipmap-xxhdpi',  size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

for (const { folder, size } of DENSITIES) {
  const dest    = join(RES, folder);
  // Logo ocupa 72% do canvas — seguro para qualquer máscara Android (squircle, círculo, etc.)
  const logoSize = Math.round(size * 0.72);

  const logo = await sharp(SRC)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // ic_launcher e ic_launcher_round — fundo branco igual ao PWA instalado
  const withBg = await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer();

  await sharp(withBg).toFile(join(dest, 'ic_launcher.png'));
  await sharp(withBg).toFile(join(dest, 'ic_launcher_round.png'));

  // ic_launcher_foreground — transparente para o adaptive icon (API 26+)
  const foreground = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer();

  await sharp(foreground).toFile(join(dest, 'ic_launcher_foreground.png'));

  console.log(`✅ ${folder} (${size}px) — logo ${logoSize}px`);
}

console.log('\n✅ Ícones gerados — fundo branco, idêntico ao PWA.');
