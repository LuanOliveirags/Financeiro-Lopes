// Gera ícones Android em todas as densidades a partir do logo principal
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC   = join(ROOT, 'frontend/assets/images/lopes-logo-opt.png');
const RES   = join(ROOT, 'android/app/src/main/res');

const DENSITIES = [
  { folder: 'mipmap-mdpi',    size: 48  },
  { folder: 'mipmap-hdpi',    size: 72  },
  { folder: 'mipmap-xhdpi',   size: 96  },
  { folder: 'mipmap-xxhdpi',  size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

for (const { folder, size } of DENSITIES) {
  const dest = join(RES, folder);

  // ic_launcher — fundo branco + logo redimensionado com padding
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(join(dest, 'ic_launcher.png'));

  // ic_launcher_foreground — transparente (para ícone adaptativo API 26+)
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(dest, 'ic_launcher_foreground.png'));

  // ic_launcher_round — fundo branco, mesmo conteúdo (Android aplica o recorte circular)
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(join(dest, 'ic_launcher_round.png'));

  console.log(`✅ ${folder} (${size}px)`);
}

console.log('\n✅ Todos os ícones gerados com sucesso.');
