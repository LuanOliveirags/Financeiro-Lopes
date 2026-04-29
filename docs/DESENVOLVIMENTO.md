# Guia de Desenvolvimento

## Rodar localmente

```bash
npm install
npm run dev        # monta www/ e serve em http://localhost:3000
```

> **Sempre use `http://localhost:3000`**, nunca o IP da máquina (ex: `192.168.x.x`).
> O login usa `crypto.subtle` para hash de senha — essa API só funciona em HTTPS ou `localhost`.
> Acessar via IP desabilita a API e o login quebra.

## Visualizar o fonte diretamente

Não abra `apps/web/public/index.html` pelo servidor do VS Code (porta 5503).
Os paths de CSS/JS são relativos à raiz do `www/` e não resolvem corretamente dessa forma.
Use sempre `npm run dev`.

## Estrutura dos arquivos editáveis

| O que editar | Onde |
|---|---|
| HTML principal | `apps/web/public/index.html` |
| Manifest PWA | `apps/web/public/manifest.json` |
| Service Worker | `apps/web/public/service-worker.js` |
| Imagens / ícones | `apps/web/public/assets/images/` |
| Telas (features) | `apps/web/src/features/<nome>/` |
| Estilos globais | `apps/web/src/styles/` |
| Navegação / header | `packages/ui/navigation/` |
| Firebase config | `packages/services/firebase/firebase.config.js` |
| Estado global | `packages/core/state/store.js` |

## Deploy

```bash
npm run deploy     # monta www/ e publica no GitHub Pages (branch gh-pages via Actions)
```

O GitHub Actions roda automaticamente a cada push no `main` — o deploy acontece sem precisar rodar o comando manualmente.

## Build Android (APK)

```bash
npm run sync       # monta www/ e sincroniza com o projeto Android
npm run open:android   # abre no Android Studio para gerar APK de release
```

APK de debug via terminal:
```bash
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" \
  ./apps/mobile/android/gradlew -p apps/mobile/android assembleDebug
```

APK gerado em: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

## Paths de assets

Todos os paths de imagens e ícones dentro do código usam `assets/images/` (sem prefixo).
Nunca usar `frontend/assets/images/` — esse era o path antigo e não existe mais.

## Observações

- O `www/` é gerado automaticamente — não editar arquivos dentro dele diretamente
- O branch `gh-pages` é gerenciado pelo GitHub Actions — não fazer commits manuais nele
