// infra/scripts/upload-apk.js
// Faz upload do APK para o Google Drive e atualiza firebase.config.js
import { readFile, writeFile } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root      = path.resolve(__dirname, '../..');

const APK_PATH       = path.join(root, 'apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk');
const CONFIG_PATH    = path.join(root, 'packages/services/firebase/firebase.config.js');
const TOKEN_PATH     = path.join(root, '.google-token.json');
const CREDS_PATH     = path.join(root, '.google-credentials.json');
const DRIVE_FOLDER   = '1kvjPcq5TMXYVbhwQwZ3BWzc7exLa-phi';
const APK_NAME       = 'WolfSource.apk';
const APK_MIME       = 'application/vnd.android.package-archive';

async function getAuth() {
  if (!existsSync(CREDS_PATH)) {
    console.error('❌ Credenciais não encontradas.');
    console.error('   Siga os passos em infra/scripts/setup-drive-auth.js para configurar.');
    process.exit(1);
  }
  if (!existsSync(TOKEN_PATH)) {
    console.error('❌ Token OAuth2 não encontrado.');
    console.error('   Execute: node infra/scripts/setup-drive-auth.js');
    process.exit(1);
  }

  const creds = JSON.parse(await readFile(CREDS_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = creds.installed ?? creds.web;
  const oAuth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const token = JSON.parse(await readFile(TOKEN_PATH, 'utf8'));
  oAuth2.setCredentials(token);

  // Salva token atualizado automaticamente quando renovado
  oAuth2.on('tokens', async (newToken) => {
    const merged = { ...token, ...newToken };
    await writeFile(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });

  return oAuth2;
}

async function main() {
  if (!existsSync(APK_PATH)) {
    console.error('❌ APK não encontrado:', APK_PATH);
    process.exit(1);
  }

  const apkSize = (await readFile(APK_PATH)).length;
  console.log(`📦 APK encontrado (${(apkSize / 1024 / 1024).toFixed(1)} MB)`);

  const auth  = await getAuth();
  const drive = google.drive({ version: 'v3', auth });

  // Procura arquivo existente na pasta para reutilizar o mesmo ID (URL não muda)
  console.log('🔍 Verificando arquivo existente no Drive...');
  const list = await drive.files.list({
    q: `name='${APK_NAME}' and '${DRIVE_FOLDER}' in parents and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
  });

  const existing = list.data.files?.[0];
  let fileId;

  if (existing) {
    // Atualiza conteúdo mantendo o mesmo ID → URL não muda
    console.log(`🔄 Atualizando arquivo existente (ID: ${existing.id})...`);
    const res = await drive.files.update({
      fileId: existing.id,
      media: { mimeType: APK_MIME, body: createReadStream(APK_PATH) },
      fields: 'id',
    });
    fileId = res.data.id;
  } else {
    // Cria arquivo novo na pasta
    console.log('🚀 Enviando APK para o Google Drive...');
    const res = await drive.files.create({
      requestBody: { name: APK_NAME, parents: [DRIVE_FOLDER] },
      media: { mimeType: APK_MIME, body: createReadStream(APK_PATH) },
      fields: 'id',
    });
    fileId = res.data.id;

    // Torna público (qualquer um com o link pode baixar)
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
    console.log('🔓 Permissão pública configurada.');
  }

  const apkUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  console.log('\n🔗 URL do APK:', apkUrl);

  let cfg = await readFile(CONFIG_PATH, 'utf8');
  cfg = cfg.replace(
    /export const APK_URL\s*=\s*'[^']*';/,
    `export const APK_URL = '${apkUrl}';`,
  );
  await writeFile(CONFIG_PATH, cfg, 'utf8');
  console.log('✏️  firebase.config.js atualizado.');
  console.log('\n✅ Pronto! Botão "Instalar App" vai baixar:', apkUrl);
}

main().catch(err => { console.error('❌', err.message || err); process.exit(1); });
