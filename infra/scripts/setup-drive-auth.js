// infra/scripts/setup-drive-auth.js
// Configuração única do OAuth2 para o Google Drive.
//
// PASSOS:
//   1. Acesse https://console.cloud.google.com/
//   2. Crie um projeto (ou selecione um existente)
//   3. Ative a "Google Drive API" no projeto
//   4. Vá em "APIs e Serviços" → "Credenciais" → "Criar credenciais" → "ID do cliente OAuth"
//   5. Tipo de aplicativo: "App para computador"
//   6. Baixe o JSON e salve como ".google-credentials.json" na raiz do projeto
//   7. Execute: node infra/scripts/setup-drive-auth.js
//
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { createServer } from 'http';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const root       = path.resolve(__dirname, '../..');
const CREDS_PATH = path.join(root, '.google-credentials.json');
const TOKEN_PATH = path.join(root, '.google-token.json');
const SCOPES     = ['https://www.googleapis.com/auth/drive.file'];

async function main() {
  if (!existsSync(CREDS_PATH)) {
    console.error('❌ Arquivo .google-credentials.json não encontrado na raiz do projeto.');
    console.error('   Siga os passos no topo deste arquivo para criar e baixar as credenciais.');
    process.exit(1);
  }

  const creds = JSON.parse(await readFile(CREDS_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = creds.installed ?? creds.web;

  // Usa redirect local para capturar o código automaticamente
  const redirectUri = 'http://localhost:3737/oauth2callback';
  const oAuth2 = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  const authUrl = oAuth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n🔑 Autorização do Google Drive\n');
  console.log('Abra este link no navegador:');
  console.log('\n  ' + authUrl + '\n');

  // Servidor local para capturar o redirect
  await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url  = new URL(req.url, 'http://localhost:3737');
        const code = url.searchParams.get('code');
        if (!code) { res.end('Sem código.'); return; }

        const { tokens } = await oAuth2.getToken(code);
        await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));

        res.end('<h2>✅ Autorizado! Pode fechar esta aba.</h2>');
        console.log('\n✅ Token salvo em .google-token.json');
        console.log('   Execute agora: node infra/scripts/release.js\n');
        server.close();
        resolve();
      } catch (err) {
        res.end('Erro: ' + err.message);
        reject(err);
      }
    });
    server.listen(3737, () => console.log('⏳ Aguardando autorização em http://localhost:3737 ...'));
    server.on('error', reject);
  });
}

main().catch(err => { console.error('❌', err.message || err); process.exit(1); });
