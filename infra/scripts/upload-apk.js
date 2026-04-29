// infra/scripts/upload-apk.js
// Faz upload do APK para catbox.moe e atualiza firebase.config.js
import { readFile, writeFile } from 'fs/promises';
import { existsSync }          from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root      = path.resolve(__dirname, '../..');

const APK_PATH    = path.join(root, 'apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk');
const CONFIG_PATH = path.join(root, 'packages/services/firebase/firebase.config.js');
const APK_NAME    = 'WolfSource.apk';

async function main() {
  if (!existsSync(APK_PATH)) {
    console.error('❌ APK não encontrado:', APK_PATH);
    process.exit(1);
  }

  const apkBytes = await readFile(APK_PATH);
  console.log(`📦 APK encontrado (${(apkBytes.length / 1024 / 1024).toFixed(1)} MB)`);

  // catbox.moe — hospedagem permanente, link direto para download
  console.log('🚀 Enviando para catbox.moe...');
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload',
    new Blob([apkBytes], { type: 'application/vnd.android.package-archive' }),
    APK_NAME
  );

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upload falhou: ${res.status} ${t}`);
  }

  const apkUrl = (await res.text()).trim();
  if (!apkUrl.startsWith('http')) throw new Error(`Resposta inesperada: ${apkUrl}`);

  console.log('\n🔗 URL do APK:', apkUrl);

  let cfg = await readFile(CONFIG_PATH, 'utf8');
  cfg = cfg.replace(
    /export const APK_URL\s*=\s*'[^']*';/,
    `export const APK_URL = '${apkUrl}';`
  );
  await writeFile(CONFIG_PATH, cfg, 'utf8');
  console.log('✏️  firebase.config.js atualizado.');
  console.log('\n✅ Pronto! Botão "Instalar App" vai baixar:', apkUrl);
}

main().catch(err => { console.error('❌', err.message || err); process.exit(1); });
